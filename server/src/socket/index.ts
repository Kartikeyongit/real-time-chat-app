import { Server, Socket } from 'socket.io';
import { socketAuthenticate } from '../utils/auth';
import { redisService } from '../services/RedisService';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { ChatRoom } from '../models/ChatRoom';
import { CallRoom } from '../models/CallRoom'; // We'll create this model
import { v4 as uuidv4 } from 'uuid';
import { encryptMessageContent, verifyMessageSignature } from '../middleware/encryption.middleware';
import { EncryptionService } from '../utils/crypto';
import { getAssistantReply, getOrCreateAssistantUser } from '../services/aiService';
import mongoose from 'mongoose';

const activeCalls = new Map<string, ActiveCall>();

interface ActiveCall {
  id: string;
  roomId: string;
  participants: Set<string>;
  type: 'audio' | 'video';
  creator: string;
  startTime: Date;
}

interface UserSocket extends Socket {
  userId?: string;
  username?: string;
  email?: string;
}

export const setupSocketHandlers = (io: Server) => {
  // Use authentication middleware
  io.use(socketAuthenticate);

  io.on('connection', (socket: UserSocket) => {
    console.log('New client connected:', socket.id, socket.userId);

    if (!socket.userId) {
      console.log('Unauthenticated connection, disconnecting');
      socket.disconnect();
      return;
    }

    // Set user online
    redisService.setUserOnline(socket.userId, socket.id)
      .then(() => {
        // Update user in database
        User.findByIdAndUpdate(socket.userId, {
          online: true,
          lastSeen: new Date(),
          socketId: socket.id,
        }).catch(console.error);

        // Notify others in the same rooms
        socket.broadcast.emit('user-online', {
          userId: socket.userId,
          username: socket.username,
        });
      })
      .catch(console.error);

    // Join user to their rooms
    const joinUserRooms = async () => {
      try {
        const rooms = await redisService.getUserRooms(socket.userId!);
        rooms.forEach(roomId => {
          socket.join(roomId);
          redisService.addUserToRoom(socket.userId!, roomId).catch(console.error);
        });
      } catch (error) {
        console.error('Error joining rooms:', error);
      }
    };

    joinUserRooms();

    // Join a specific room
    socket.on('join-room', async (roomId: string) => {
      try {
        socket.join(roomId);
        await redisService.addUserToRoom(socket.userId!, roomId);
        
        console.log(`User ${socket.userId} joined room ${roomId}`);
        
        // Notify room members
        socket.to(roomId).emit('user-joined-room', {
          userId: socket.userId,
          username: socket.username,
          roomId,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Leave a room
    socket.on('leave-room', async (roomId: string) => {
      try {
        socket.leave(roomId);
        await redisService.removeUserFromRoom(socket.userId!, roomId);
        
        console.log(`User ${socket.userId} left room ${roomId}`);
        
        // Notify room members
        socket.to(roomId).emit('user-left-room', {
          userId: socket.userId,
          username: socket.username,
          roomId,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    // Send message (supports text, images, and files)
    socket.on('send-message', async (data: {
      roomId: string;
      content: string;
      type?: 'text' | 'image' | 'file';
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      isEncrypted?: boolean; // ADDED
      encryptedContent?: string; // ADDED
      encryptionIv?: string; // ADDED
      encryptionKeyId?: string; // ADDED
      signature?: string; // ADDED
    }, callback?: (response: any) => void) => {
      try {
        const { roomId, content, type = 'text', fileUrl, fileName, fileSize, isEncrypted = false, encryptedContent, encryptionIv, encryptionKeyId, signature } = data;

        // Validate room and message
        if (!roomId || (!content.trim() && !encryptedContent)) {
          if (callback) callback({ success: false, error: 'Invalid message' });
          return;
        }

         // Verify signature if encrypted
        if (isEncrypted && signature) {
          const isValid = verifyMessageSignature({
            isEncrypted,
            encryptedContent,
            encryptionIv,
            signature
          });
      
          if (!isValid) {
            if (callback) callback({ success: false, error: 'Invalid message signature' });
            return;
          }
        }

        // Create message in database
        const message = new Message({
          roomId,
          sender: socket.userId,
          content: isEncrypted ? '' : content.trim(),
          type,
          fileUrl: type !== 'text' ? fileUrl : undefined,
          fileName: type !== 'text' ? fileName : undefined,
          fileSize: type !== 'text' ? fileSize : undefined,
          readBy: [socket.userId],
          // Encryption fields
          isEncrypted,
          encryptedContent: isEncrypted ? encryptedContent : undefined,
          encryptionIv: isEncrypted ? encryptionIv : undefined,
          encryptionKeyId: isEncrypted ? encryptionKeyId : undefined,
          signature: isEncrypted ? signature : undefined,
        });

        await message.save();

        // Populate sender info
        await message.populate('sender', 'username avatar email');

        // Update room's last message and timestamp
        await ChatRoom.findByIdAndUpdate(roomId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        });

        // Prepare message object for emission
        const messageObject = {
          _id: message._id.toString(),
          roomId,
          sender: {
            _id: socket.userId,
            username: socket.username || 'Unknown User',
            avatar: (message.sender as any)?.avatar || null,
          },
          content: isEncrypted ? '' : message.content,
          type: message.type,
          isEncrypted: message.isEncrypted,
          encryptedContent: message.encryptedContent,
          encryptionIv: message.encryptionIv,
          encryptionKeyId: message.encryptionKeyId,
          signature: message.signature,
          ...(type !== 'text' && {
            fileUrl,
            fileName,
            fileSize,
          }),
          timestamp: message.createdAt,
          readBy: [socket.userId],
        };

        // Cache message in Redis for quick access
        try {
          await redisService.cacheMessage(roomId, messageObject);
        } catch (redisError) {
          console.warn('Failed to cache message in Redis:', redisError);
          // Continue even if Redis fails
        }

        // Broadcast to room
        io.to(roomId).emit('new-message', messageObject);

        // If this room is the AI assistant room, generate a bot reply
        const room = await ChatRoom.findById(roomId);
        if (room?.isBotRoom && type === 'text') {
          try {
            const assistantUser = await getOrCreateAssistantUser();
            const aiResponse = await getAssistantReply(roomId, content.trim());

            const botMessage = new Message({
              roomId,
              sender: assistantUser._id,
              content: aiResponse,
              type: 'text',
              readBy: [assistantUser._id],
            });
            await botMessage.save();
            await botMessage.populate('sender', 'username avatar');

            const botMessageObject = {
              _id: botMessage._id.toString(),
              roomId,
              sender: {
                _id: assistantUser._id.toString(),
                username: assistantUser.username,
                avatar: assistantUser.avatar || null,
              },
              content: botMessage.content,
              type: botMessage.type,
              isEncrypted: botMessage.isEncrypted,
              encryptedContent: botMessage.encryptedContent,
              encryptionIv: botMessage.encryptionIv,
              encryptionKeyId: botMessage.encryptionKeyId,
              signature: botMessage.signature,
              timestamp: botMessage.createdAt,
              readBy: [assistantUser._id.toString()],
            };

            await ChatRoom.findByIdAndUpdate(roomId, {
              lastMessage: botMessage._id,
              updatedAt: new Date(),
            });

            io.to(roomId).emit('new-message', botMessageObject);
            io.to(roomId).emit('room-updated', {
              roomId,
              lastMessage: {
                _id: botMessage._id.toString(),
                content: botMessage.content,
                sender: {
                  _id: assistantUser._id.toString(),
                  username: assistantUser.username,
                  avatar: assistantUser.avatar || null,
                },
                createdAt: botMessage.createdAt,
                type: botMessage.type,
              },
              updatedAt: new Date(),
            });
          } catch (botError) {
            console.error('AI assistant reply failed:', botError);
          }
        }

        // Send success callback to sender
        if (callback) {
          callback({ success: true, messageId: message._id });
        }
        
        console.log(`Message sent to room ${roomId} by ${socket.userId}`);
      } catch (error) {
        console.error('Error sending message:', error);
        if (callback) {
          callback({ success: false, error: 'Failed to send message' });
        }
        socket.emit('message-error', { error: 'Failed to send message' });
      }
    });

    // Add new socket event for key exchange
    socket.on('key-exchange', async (data: {
      roomId: string;
      publicKey: string;
      targetUserId?: string;
    }, callback?: (response: any) => void) => {
      try {
        const { roomId, publicKey, targetUserId } = data;
    
        // Store/update user's public key
        await User.findByIdAndUpdate(socket.userId, {
          publicKey,
          encryptionEnabled: true
        });
    
        // If targetUserId is specified, send key to that user
        if (targetUserId) {
          io.to(targetUserId).emit('key-received', {
            from: socket.userId,
            fromUsername: socket.username,
            publicKey,
            roomId,
            timestamp: new Date()
          });
        } else {
          // Broadcast to room
          socket.to(roomId).emit('key-received', {
            from: socket.userId,
            fromUsername: socket.username,
            publicKey,
            roomId,
            timestamp: new Date()
          });
        }
    
        if (callback) {
          callback({ success: true });
        }
      } catch (error) {
        console.error('Key exchange error:', error);
        if (callback) {
          callback({ success: false, error: 'Key exchange failed' });
        }
      }
    });

    // ADDED: Delete message handler
    socket.on('delete-message', async (data: {
      messageId: string;
      roomId: string;
    }, callback?: (response: any) => void) => {
      try {
        const { messageId, roomId } = data;
        
        console.log(`Delete message request: ${messageId} in room ${roomId} by user ${socket.userId}`);

        // Validate inputs
        if (!messageId || !roomId) {
          if (callback) {
            callback({ success: false, error: 'Message ID and Room ID are required' });
          }
          return;
        }

        // Find the message
        const message = await Message.findById(messageId);
        if (!message) {
          if (callback) {
            callback({ success: false, error: 'Message not found' });
          }
          return;
        }

        // Check if message belongs to the specified room
        if (message.roomId.toString() !== roomId) {
          if (callback) {
            callback({ success: false, error: 'Message does not belong to this room' });
          }
          return;
        }

        // Check if user owns the message
        if (message.sender.toString() !== socket.userId) {
          if (callback) {
            callback({ success: false, error: 'You can only delete your own messages' });
          }
          return;
        }

        // Check time limit (15 minutes = 15 * 60 * 1000 milliseconds)
        const messageTime = new Date(message.createdAt).getTime();
        const currentTime = new Date().getTime();
        const fifteenMinutes = 15 * 60 * 1000;
        
        if (currentTime - messageTime > fifteenMinutes) {
          if (callback) {
            callback({ success: false, error: 'Messages can only be deleted within 15 minutes' });
          }
          return;
        }

        // Check if message is already deleted
        if (message.deleted) {
          if (callback) {
            callback({ success: false, error: 'Message is already deleted' });
          }
          return;
        }

        // Soft delete the message (don't remove from database)
        message.deleted = true;
        message.deletedAt = new Date();
        message.deletedBy = new mongoose.Types.ObjectId(socket.userId!);
        
        // Clear file information for deleted messages
        if (message.type !== 'text') {
          message.fileUrl = undefined;
          message.fileName = undefined;
          message.fileSize = undefined;
        }
        
        await Message.findByIdAndUpdate(messageId, { 
          $set: { deleted: true, deletedAt: new Date() } 
        }, { new: true });

        // Find the new last message for the room
        const lastMessage = await Message.findOne({
          roomId,
          deleted: { $ne: true }
        }).sort({ createdAt: -1 }).populate('sender', 'username avatar');

        // Prepare deletion event data
        const deletionData = {
          messageId: message._id.toString(),
          roomId,
          deletedAt: message.deletedAt,
          deletedBy: socket.userId,
          lastMessage: lastMessage ? {
            _id: lastMessage._id.toString(),
            content: lastMessage.content,
            sender: {
              _id: lastMessage.sender._id.toString(),
              username: (lastMessage.sender as any).username,
              avatar: (lastMessage.sender as any).avatar,
            },
            createdAt: lastMessage.createdAt,
            type: lastMessage.type,
            deleted: lastMessage.deleted || false,
          } : undefined
        };

        // Broadcast to all users in the room
        io.to(roomId).emit('message-deleted', deletionData);

        // ALSO broadcast a room update event specifically for sidebar
        io.to(roomId).emit('room-updated', {
          roomId,
          lastMessage: lastMessage ? {
            _id: lastMessage._id.toString(),
            content: lastMessage.content,
            sender: {
              _id: lastMessage.sender._id.toString(),
              username: (lastMessage.sender as any).username,
              avatar: (lastMessage.sender as any).avatar,
            },
            createdAt: lastMessage.createdAt,
            type: lastMessage.type,
            deleted: lastMessage.deleted || false,
          } : null,
          updatedAt: new Date(),
        });

        // Update room's last message if needed
        if (lastMessage) {
          await ChatRoom.findByIdAndUpdate(roomId, {
            lastMessage: lastMessage._id,
            updatedAt: new Date(),
          });
        }

        // Remove from Redis cache
        try {
          await redisService.removeCachedMessage(roomId, messageId);
        } catch (redisError) {
          console.warn('Failed to remove message from Redis cache:', redisError);
        }

        // Send success response
        if (callback) {
          callback({ 
            success: true, 
            messageId: message._id,
            deletedAt: message.deletedAt 
          });
        }

        console.log(`Message ${messageId} deleted successfully by user ${socket.userId}`);

      } catch (error: any) {
        console.error('Error deleting message:', error);
        if (callback) {
          callback({ 
            success: false, 
            error: error.message || 'Failed to delete message' 
          });
        }
        socket.emit('message-error', { error: 'Failed to delete message' });
      }
    });

    // Typing indicator
    socket.on('typing', async (data: { roomId: string; isTyping: boolean }) => {
      try {
        const { roomId, isTyping } = data;

        await redisService.setTypingStatus(
          roomId,
          socket.userId!,
          socket.username!,
          isTyping
        );

        // Broadcast typing status to room except sender
        socket.to(roomId).emit('user-typing', {
          roomId,
          userId: socket.userId,
          username: socket.username,
          isTyping,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error updating typing status:', error);
      }
    });

    // Get typing users in a room
    socket.on('get-typing-users', async (roomId: string) => {
      try {
        const typingUsers = await redisService.getTypingUsers(roomId);
        socket.emit('typing-users', { roomId, users: typingUsers });
      } catch (error) {
        console.error('Error getting typing users:', error);
      }
    });

    // Mark messages as read
    socket.on('mark-messages-read', async (data: { roomId: string; messageIds: string[] }) => {
      try {
        const { roomId, messageIds } = data;

        await Message.updateMany(
          {
            _id: { $in: messageIds },
            roomId,
            readBy: { $ne: socket.userId },
          },
          {
            $addToSet: { readBy: socket.userId },
          }
        );

        // Notify room that messages were read
        socket.to(roomId).emit('messages-read', {
          roomId,
          userId: socket.userId,
          messageIds,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // WebRTC Call Invitation
    socket.on('call-invite', async (data: {
      callId: string;
      roomId: string;
      type: 'video' | 'audio';
      participants: string[];
    }) => {
      try {
        const { callId, roomId, type, participants } = data;

        // Create active call record
        activeCalls.set(callId, {
          id: callId,
          roomId,
          participants: new Set([socket.userId!]),
          type,
          creator: socket.userId!,
          startTime: new Date(),
        });

        // Notify invited participants
        participants.forEach(participantId => {
          if (participantId !== socket.userId) {
            io.to(participantId).emit('call-invite', {
              callId,
              roomId,
              from: socket.userId,
              fromUsername: socket.username,
              type,
              timestamp: new Date(),
            });
          }
        });

        // Join the call room
        socket.join(`call:${callId}`);

      } catch (error) {
        console.error('Error sending call invitation:', error);
        socket.emit('call-error', { error: 'Failed to start call' });
      }
    });

    // Accept call invitation
    socket.on('call-accept', (data: { callId: string; roomId: string }) => {
      try {
        const { callId, roomId } = data;
        const call = activeCalls.get(callId);

        if (!call) {
          socket.emit('call-error', { error: 'Call not found' });
          return;
        }

        // Add participant to call
        call.participants.add(socket.userId!);
        socket.join(`call:${callId}`);

        // Notify all participants about new participant
        io.to(`call:${callId}`).emit('call-participant-joined', {
          callId,
          roomId,
          userId: socket.userId,
          username: socket.username,
          timestamp: new Date(),
        });

        // Send list of existing participants to the new joiner
        const participants = Array.from(call.participants).filter(id => id !== socket.userId);
        socket.emit('call-participants-list', {
          callId,
          roomId,
          participants,
        });

      } catch (error) {
        console.error('Error accepting call:', error);
      }
    });

    // Reject call invitation
    socket.on('call-reject', (data: { callId: string; roomId: string; reason?: string }) => {
      try {
        const { callId, roomId, reason } = data;
        const call = activeCalls.get(callId);

        if (!call) return;

        // Notify call creator
        io.to(call.creator).emit('call-rejected', {
          callId,
          roomId,
          userId: socket.userId,
          username: socket.username,
          reason,
          timestamp: new Date(),
        });

      } catch (error) {
        console.error('Error rejecting call:', error);
      }
    });

    // Join an active call
    socket.on('call-join', (data: { callId: string; roomId: string }) => {
      try {
        const { callId, roomId } = data;
        const call = activeCalls.get(callId);

        if (!call) {
          socket.emit('call-error', { error: 'Call not found' });
          return;
        }

        // Add participant to call
        call.participants.add(socket.userId!);
        socket.join(`call:${callId}`);

        // Notify all participants about new participant
        io.to(`call:${callId}`).emit('call-participant-joined', {
          callId,
          roomId,
          userId: socket.userId,
          username: socket.username,
          timestamp: new Date(),
        });

        // Send list of existing participants to the new joiner
        const participants = Array.from(call.participants).filter(id => id !== socket.userId);
        socket.emit('call-participants-list', {
          callId,
          roomId,
          participants,
        });

      } catch (error) {
        console.error('Error joining call:', error);
      }
    });

    // Leave a call
    socket.on('call-leave', (data: { callId: string; roomId: string }) => {
      try {
        const { callId, roomId } = data;
        const call = activeCalls.get(callId);

        if (!call) return;

        // Remove participant from call
        call.participants.delete(socket.userId!);
        socket.leave(`call:${callId}`);

        // Notify remaining participants
        io.to(`call:${callId}`).emit('call-participant-left', {
          callId,
          roomId,
          userId: socket.userId,
          username: socket.username,
          timestamp: new Date(),
        });

        // If no participants left or only creator left, end call
        if (call.participants.size === 0 || 
            (call.participants.size === 1 && call.participants.has(call.creator))) {
          io.to(`call:${callId}`).emit('call-ended', {
            callId,
            roomId,
            endedBy: socket.userId,
            reason: 'All participants left',
            timestamp: new Date(),
          });
          activeCalls.delete(callId);
        }

      } catch (error) {
        console.error('Error leaving call:', error);
      }
    });

    // End a call (by creator)
    socket.on('call-end', (data: { callId: string; roomId: string; reason?: string }) => {
      try {
        const { callId, roomId, reason } = data;
        const call = activeCalls.get(callId);

        if (!call) return;

        // Check if user is the creator
        if (call.creator !== socket.userId) {
          socket.emit('call-error', { error: 'Only call creator can end the call' });
          return;
        }

        // Notify all participants
        io.to(`call:${callId}`).emit('call-ended', {
          callId,
          roomId,
          endedBy: socket.userId,
          reason,
          timestamp: new Date(),
        });

        // Clean up
        activeCalls.delete(callId);

      } catch (error) {
        console.error('Error ending call:', error);
      }
    });

    // WebRTC Signaling: Offer
    socket.on('webrtc-offer', (data: {
      to: string;
      roomId: string;
      callId: string;
      sdp: RTCSessionDescriptionInit;
      type: 'video' | 'audio';
    }) => {
      try {
        const { to, roomId, callId, sdp, type } = data;
    
        // Forward offer to target user
        io.to(to).emit('webrtc-offer', {
          from: socket.userId,
          to,
          roomId,
          callId,
          type,
          sdp,
          metadata: {
            username: socket.username,
          },
        });
      } catch (error) {
        console.error('Error forwarding WebRTC offer:', error);
      }
    });

    // WebRTC Signaling: Answer
    socket.on('webrtc-answer', (data: {
      to: string;
      roomId: string;
      callId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      try {
        const { to, roomId, callId, sdp } = data;
    
        // Forward answer to target user
        io.to(to).emit('webrtc-answer', {
          from: socket.userId,
          to,
          roomId,
          callId,
          sdp,
        });
      } catch (error) {
        console.error('Error forwarding WebRTC answer:', error);
      }
    });

    // WebRTC Signaling: ICE Candidate
    socket.on('webrtc-ice-candidate', (data: {
      to: string;
      roomId: string;
      callId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      try {
        const { to, roomId, callId, candidate } = data;
    
        // Forward ICE candidate to target user
        io.to(to).emit('webrtc-ice-candidate', {
          from: socket.userId,
          to,
          roomId,
          callId,
          candidate,
        });
      } catch (error) {
        console.error('Error forwarding ICE candidate:', error);
      }
    });

    // Participant status updates
    socket.on('participant-muted', (data: { callId: string; roomId: string; isMuted: boolean }) => {
      const { callId, roomId, isMuted } = data;
      io.to(`call:${callId}`).except(socket.id).emit('participant-muted', {
        callId,
        roomId,
        userId: socket.userId,
        isMuted,
      });
    });

    socket.on('participant-camera-off', (data: { callId: string; roomId: string; isCameraOff: boolean }) => {
      const { callId, roomId, isCameraOff } = data;
      io.to(`call:${callId}`).except(socket.id).emit('participant-camera-off', {
        callId,
        roomId,
        userId: socket.userId,
        isCameraOff,
      });
    });

    socket.on('participant-screen-sharing', (data: { callId: string; roomId: string; isScreenSharing: boolean }) => {
      const { callId, roomId, isScreenSharing } = data;
      io.to(`call:${callId}`).except(socket.id).emit('participant-screen-sharing', {
        callId,
        roomId,
        userId: socket.userId,
        isScreenSharing,
      });
    });

    // Disconnect handler
    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id, socket.userId);

      try {
        const userId = await redisService.setUserOffline(socket.id);
        
        if (userId) {
          // Update user in database
          await User.findByIdAndUpdate(userId, {
            online: false,
            lastSeen: new Date(),
            socketId: '',
          });

          // Notify others
          socket.broadcast.emit('user-offline', { 
            userId,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }

      activeCalls.forEach((call, callId) => {
        if (call.participants.has(socket.userId!)) {
          call.participants.delete(socket.userId!);
      
          // Notify other participants
          socket.to(`call:${callId}`).emit('call-participant-disconnected', {
            callId,
            userId: socket.userId,
            username: socket.username,
            timestamp: new Date(),
          });

          // Clean up empty calls
          if (call.participants.size === 0) {
            activeCalls.delete(callId);
          }
        }
      });

    });

    // Error handler
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
};