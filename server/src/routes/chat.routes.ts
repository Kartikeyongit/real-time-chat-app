import express from 'express';
import { authenticateToken } from '../utils/auth';
import { ChatRoom } from '../models/ChatRoom';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { upload, getFileUrl } from '../utils/fileUpload';
import mongoose from 'mongoose';

const router = express.Router();

// Get all chat rooms for current user
router.get('/rooms', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    let botRoom = await ChatRoom.findOne({
      members: userId,
      isBotRoom: true,
    })
      .populate('createdBy', 'username avatar email')
      .populate('members', 'username avatar email online')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username avatar',
        },
      });

    if (!botRoom) {
      botRoom = new ChatRoom({
        name: 'AI Assistant',
        description: 'Chat with the AI assistant',
        isPrivate: true,
        createdBy: userId,
        members: [userId],
        isBotRoom: true,
      });
      await botRoom.save();
      await botRoom.populate('createdBy', 'username avatar email');
      await botRoom.populate('members', 'username avatar email online');
    }

    const otherRooms = await ChatRoom.find({
      members: userId,
      _id: { $ne: botRoom._id },
    })
      .populate('createdBy', 'username avatar email')
      .populate('members', 'username avatar email online')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username avatar',
        },
      })
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      rooms: [botRoom, ...otherRooms],
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rooms',
    });
  }
});

// Get a specific chat room
router.get('/rooms/:roomId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { roomId } = req.params;

    const room = await ChatRoom.findOne({
      _id: roomId,
      members: user.userId,
    })
      .populate('members', '-password')
      .populate('createdBy', '-password');

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found or access denied',
      });
    }

    res.json({
      success: true,
      room,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch room',
    });
  }
});

// Create a new chat room
router.post('/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPrivate = false, memberIds = [] } = req.body;
    const userId = (req as any).user.userId;

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Room name is required',
      });
    }

    // Create room
    const room = new ChatRoom({
      name: name.trim(),
      description: description?.trim(),
      isPrivate,
      createdBy: userId,
      members: [userId, ...memberIds], // Add creator and any other members
    });

    await room.save();

    // Populate room data
    await room.populate([
      { path: 'createdBy', select: 'username avatar email' },
      { path: 'members', select: 'username avatar email online' },
    ]);

    res.json({
      success: true,
      room,
    });
  } catch (error: any) {
    console.error('Error creating room:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create room',
    });
  }
});

// Search users
router.get('/users/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    const currentUserId = (req as any).user.userId;

    if (!q || typeof q !== 'string') {
      return res.json({ users: [] });
    }

    // Search users by username or email, excluding current user
    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } },
        {
          $or: [
            { username: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
          ],
        },
      ],
    })
      .select('username email avatar online lastSeen')
      .limit(20);

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search users',
    });
  }
});

// Add members to room
router.post('/rooms/:roomId/members', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userIds } = req.body;
    const currentUserId = (req as any).user.userId;

    // Check if room exists
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found',
      });
    }

    // Check if current user is a member (only members can add others)
    if (!room.members.includes(currentUserId)) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this room',
      });
    }

    // Validate user IDs
    const validUsers = await User.find({ _id: { $in: userIds } });
    const validUserIds = validUsers.map(user => user._id.toString());

    // Add users to room (avoid duplicates)
    const newMembers = validUserIds.filter(userId => 
      !room.members.some(memberId => 
        memberId.toString() === userId
      )
    );

    // Convert string IDs to ObjectIds
    room.members.push(
      ...newMembers.map(id => new mongoose.Types.ObjectId(id))
    );
    await room.save();

    // Populate room data
    await room.populate([
      { path: 'createdBy', select: 'username avatar email' },
      { path: 'members', select: 'username avatar email online' },
    ]);

    res.json({
      success: true,
      room,
    });
  } catch (error) {
    console.error('Error adding members to room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add members to room',
    });
  }
});

// Get messages for a room
router.get('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check if user is a member of the room
    const room = await ChatRoom.findOne({
      _id: roomId,
      members: user.userId,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found or access denied',
      });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const messages = await Message.find({ roomId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalMessages = await Message.countDocuments({ roomId });

    res.json({
      success: true,
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalMessages,
        pages: Math.ceil(totalMessages / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch messages',
    });
  }
});

// Mark messages as read
router.post('/messages/read', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { messageIds, roomId } = req.body;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ error: 'Message IDs array is required' });
    }

    await Message.updateMany(
      {
        _id: { $in: messageIds },
        roomId,
        readBy: { $ne: user.userId },
      },
      {
        $addToSet: { readBy: user.userId },
      }
    );

    res.json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark messages as read',
    });
  }
});

// File upload endpoint
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileUrl = getFileUrl(req, file.filename);

    // Determine file type
    let fileType: 'image' | 'file' = 'file';
    if (file.mimetype.startsWith('image/')) {
      fileType = 'image';
    }

    res.json({
      success: true,
      file: {
        originalName: file.originalname,
        fileName: file.filename,
        url: fileUrl,
        type: fileType,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'File upload failed',
    });
  }
});

export default router;