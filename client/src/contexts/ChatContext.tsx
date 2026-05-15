import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { chatAPI } from '../services/api';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { getEncryptionService } from '../services/encryption';

export interface ChatRoom {
  _id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  isBotRoom?: boolean;
  createdBy: {
    _id: string;
    username: string;
    avatar?: string;
  };
  members: Array<{
    _id: string;
    username: string;
    avatar?: string;
    online: boolean;
    publicKey?: string; // ADDED: For encryption
  }>;
  lastMessage?: {
    _id: string;
    content: string;
    sender: {
      _id: string;
      username: string;
      avatar?: string;
    };
    createdAt: string;
    deleted?: boolean;
    type?: 'text' | 'image' | 'file' | 'system';
    fileUrl?: string;
    fileName?: string;
    // ADDED: Encryption fields
    isEncrypted?: boolean;
    encryptedContent?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  roomId: string;
  sender: {
    _id: string;
    username: string;
    avatar?: string;
    publicKey?: string; // ADDED
  };
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  deletedAt?: string;
  // ADDED: Encryption fields
  isEncrypted?: boolean;
  encryptedContent?: string;
  encryptionIv?: string;
  encryptionKeyId?: string;
  signature?: string;
  // ADDED: For encrypted files
  encryptionKey?: string;
}

interface TypingUser {
  userId: string;
  username: string;
  isTyping: boolean;
}

interface ChatContextType {
  // Rooms
  rooms: ChatRoom[];
  currentRoom: ChatRoom | null;
  isLoadingRooms: boolean;
  
  // Messages
  messages: Message[];
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
  
  // UI State
  isSidebarOpen: boolean;
  showNewRoomModal: boolean;
  showUserSearchModal: boolean;
  
  // Typing indicators
  typingUsers: TypingUser[];
  
  // Encryption
  encryptionService: any;
  isEncryptionSupported: boolean;
  isEncryptionInitialized: boolean;
  
  // Actions
  fetchRooms: () => Promise<void>;
  selectRoom: (roomId: string) => Promise<void>;
  fetchMessages: (loadMore?: boolean) => Promise<void>;
  sendMessage: (content: string, type?: 'text' | 'image' | 'file', file?: File) => Promise<void>;
  createRoom: (roomData: { name: string; description?: string; isPrivate?: boolean; memberIds?: string[] }) => Promise<void>;
  addMembersToRoom: (roomId: string, userIds: string[]) => Promise<void>;
  
  // UI Actions
  toggleSidebar: () => void;
  setShowNewRoomModal: (show: boolean) => void;
  setShowUserSearchModal: (show: boolean) => void;
  
  // Typing actions
  startTyping: () => void;
  stopTyping: () => void;
  
  // Delete message action
  deleteMessage: (messageId: string) => Promise<void>;
  
  // ADDED: Encryption actions
  initiateKeyExchange: (targetUserId?: string) => Promise<void>;
  initializeEncryption: () => Promise<void>;
  getEncryptionStatus: () => {
    supported: boolean;
    initialized: boolean;
    ready: boolean;
  };
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  
  // State
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [showUserSearchModal, setShowUserSearchModal] = useState(false);
  
  // Loading states
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Encryption
  const [encryptionService, setEncryptionService] = useState<any>(null);
  const [isEncryptionSupported, setIsEncryptionSupported] = useState(false);
  const [isEncryptionInitialized, setIsEncryptionInitialized] = useState(false);
  
  // Typing timeout
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Initialize encryption service
  useEffect(() => {
    if (socket && !encryptionService && user?._id) {
      try {
        const service = getEncryptionService(socket);
        setEncryptionService(service);
        setIsEncryptionSupported(service.isEncryptionSupported());
      } catch (error) {
        console.error('Failed to initialize encryption service:', error);
        setIsEncryptionSupported(false);
      }
    }
  }, [socket]);

  // Initialize encryption for user
  const initializeEncryption = async () => {
    if (!encryptionService || !user?._id) return;
    
    try {
      // Generate and store user's key pair
      const publicKey = await encryptionService.initialize(user._id);
      
      // Broadcast public key to all rooms
      rooms.forEach(room => {
        encryptionService.startKeyExchange(room._id, user._id);
      });
      
      setIsEncryptionInitialized(true);
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      setIsEncryptionInitialized(false);
    }
  };

  // Fetch rooms on mount
  useEffect(() => {
    if (user) {
      fetchRooms();
    }
  }, [user]);

  // Initialize encryption when rooms are loaded
  useEffect(() => {
    if (rooms.length > 0 && encryptionService && user?._id && !isEncryptionInitialized && isConnected) {
      initializeEncryption();
    }
  }, [rooms, encryptionService, user, isEncryptionInitialized, isConnected]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected || !currentRoom) return;

    // Join room when selected
    socket.emit('join-room', currentRoom._id);

    // ADDED: Handle key exchange
    const handleKeyReceived = async (data: any) => {
      console.log('Key received from:', data.fromUsername);
      // Key is automatically handled by encryption service
      
      // Update user's public key in room members
      if (currentRoom?._id === data.roomId) {
        setCurrentRoom(prev => prev ? {
          ...prev,
          members: prev.members.map(member => 
            member._id === data.from 
              ? { ...member, publicKey: data.publicKey }
              : member
          )
        } : prev);
      }
    };

    // ADDED: Handle encryption required notification
    const handleEncryptionRequired = (data: any) => {
      console.warn('Encryption required:', data);
      // You could show a notification to the user
    };

    // Modified handleNewMessage to handle decryption
    const handleNewMessage = async (message: Message) => {
      if (message.roomId === currentRoom?._id) {
        let processedMessage = { ...message };
        
        // Decrypt message if encrypted
        if (message.isEncrypted && encryptionService && currentRoom._id) {
          try {
            const decryptedContent = await encryptionService.decryptMessage(
              currentRoom._id,
              {
                isEncrypted: message.isEncrypted,
                encryptedContent: message.encryptedContent,
                encryptionIv: message.encryptionIv,
                signature: message.signature,
                content: message.content
              }
            );
            processedMessage.content = decryptedContent;
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            processedMessage.content = '[Encrypted message - decryption failed]';
          }
        }
        
        setMessages(prev => [...prev, {
          ...processedMessage,
          createdAt: processedMessage.createdAt || new Date().toISOString()
        }]);
        
        // Mark as read
        socket.emit('mark-messages-read', {
          roomId: currentRoom._id,
          messageIds: [message._id],
        });
      }

      // Update rooms list with last message
      setRooms(prev => prev.map(room => {
        if (room._id === message.roomId) {
          return {
            ...room,
            lastMessage: {
              _id: message._id,
              content: message.isEncrypted ? '[Encrypted message]' : message.content,
              sender: message.sender,
              createdAt: message.createdAt,
              isEncrypted: message.isEncrypted,
              encryptedContent: message.encryptedContent,
            },
          };
        }
        return room;
      }));
    };

    const handleRoomUpdated = (data: {
      roomId: string;
      lastMessage?: {
        _id: string;
        content: string;
        sender: {
          _id: string;
          username: string;
          avatar?: string;
        };
        createdAt: string;
        type?: 'text' | 'image' | 'file' | 'system';
        deleted?: boolean;
        fileUrl?: string;
        fileName?: string;
        isEncrypted?: boolean;
        encryptedContent?: string;
      };
      updatedAt: string;
    }) => {
      // Update the rooms list
      setRooms(prev => prev.map(room => {
        if (room._id === data.roomId) {
          return {
            ...room,
            lastMessage: data.lastMessage,
            updatedAt: data.updatedAt,
          };
        }
        return room;
      }));
    };

    // Setup typing indicator listener
    const handleUserTyping = (data: { 
      roomId: string; 
      userId: string; 
      username: string; 
      isTyping: boolean;
    }) => {
      if (data.roomId === currentRoom._id) {
        setTypingUsers(prev => {
          const existing = prev.find(u => u.userId === data.userId);
          if (existing) {
            if (data.isTyping) {
              return prev.map(u => u.userId === data.userId ? { ...u, isTyping: true } : u);
            } else {
              return prev.filter(u => u.userId !== data.userId);
            }
          } else if (data.isTyping) {
            return [...prev, { 
              userId: data.userId, 
              username: data.username, 
              isTyping: true 
            }];
          }
          return prev;
        });
      }
    };

    // Setup messages read listener
    const handleMessagesRead = (data: {
      roomId: string;
      userId: string;
      messageIds: string[];
    }) => {
      if (data.roomId === currentRoom._id && data.userId !== user?._id) {
        setMessages(prev => prev.map(msg => 
          data.messageIds.includes(msg._id)
            ? { ...msg, readBy: [...msg.readBy, data.userId] }
            : msg
        ));
      }
    };

    // Setup user joined/left listeners
    const handleUserJoinedRoom = (data: {
      roomId: string;
      userId: string;
      username: string;
    }) => {
      if (data.roomId === currentRoom._id) {
        // Update room members
        setCurrentRoom(prev => prev ? {
          ...prev,
          members: [...prev.members, {
            _id: data.userId,
            username: data.username,
            online: true,
          }]
        } : prev);
        
        // Initiate key exchange with new member
        if (encryptionService && isEncryptionInitialized) {
          encryptionService.startKeyExchange(currentRoom._id, data.userId);
        }
      }
    };

    const handleUserLeftRoom = (data: {
      roomId: string;
      userId: string;
      username: string;
    }) => {
      if (data.roomId === currentRoom._id) {
        // Remove user from room members
        setCurrentRoom(prev => prev ? {
          ...prev,
          members: prev.members.filter(member => member._id !== data.userId)
        } : prev);
      }
    };

    // Setup online status listeners
    const handleUserOnline = (data: { userId: string; username: string }) => {
      setRooms(prev => prev.map(room => ({
        ...room,
        members: room.members.map(member =>
          member._id === data.userId ? { ...member, online: true } : member
        )
      })));
      
      if (currentRoom) {
        setCurrentRoom(prev => prev ? {
          ...prev,
          members: prev.members.map(member =>
            member._id === data.userId ? { ...member, online: true } : member
          )
        } : prev);
      }
    };

    const handleUserOffline = (data: { userId: string }) => {
      setRooms(prev => prev.map(room => ({
        ...room,
        members: room.members.map(member =>
          member._id === data.userId ? { ...member, online: false } : member
        )
      })));
      
      if (currentRoom) {
        setCurrentRoom(prev => prev ? {
          ...prev,
          members: prev.members.map(member =>
            member._id === data.userId ? { ...member, online: false } : member
          )
        } : prev);
      }
    };

    // Handle message deletion
    const handleMessageDeleted = (data: { 
      messageId: string; 
      roomId: string;
      deletedAt: string;
    }) => {
      if (data.roomId === currentRoom._id) {
        setMessages(prev => prev.map(msg => 
          msg._id === data.messageId 
            ? { ...msg, deleted: true, deletedAt: data.deletedAt }
            : msg
        ));
        
        // Update last message in rooms if needed
        setRooms(prev => prev.map(room => {
          if (room._id === data.roomId && room.lastMessage?._id === data.messageId) {
            // Find the latest non-deleted message
            const latestMessage = messages
              .filter(msg => msg.roomId === data.roomId && !msg.deleted)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            
            if (latestMessage) {
              return {
                ...room,
                lastMessage: {
                  _id: latestMessage._id,
                  content: latestMessage.isEncrypted ? '[Encrypted message]' : latestMessage.content,
                  sender: latestMessage.sender,
                  createdAt: latestMessage.createdAt,
                  isEncrypted: latestMessage.isEncrypted,
                }
              };
            } else {
              return {
                ...room,
                lastMessage: undefined
              };
            }
          }
          return room;
        }));
      }
    };

    // Register listeners
    socket.on('key-received', handleKeyReceived);
    socket.on('encryption-required', handleEncryptionRequired);
    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleUserTyping);
    socket.on('messages-read', handleMessagesRead);
    socket.on('user-joined-room', handleUserJoinedRoom);
    socket.on('user-left-room', handleUserLeftRoom);
    socket.on('user-online', handleUserOnline);
    socket.on('user-offline', handleUserOffline);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('room-updated', handleRoomUpdated);

    // Cleanup
    return () => {
      socket.off('key-received', handleKeyReceived);
      socket.off('encryption-required', handleEncryptionRequired);
      socket.off('new-message', handleNewMessage);
      socket.off('user-typing', handleUserTyping);
      socket.off('messages-read', handleMessagesRead);
      socket.off('user-joined-room', handleUserJoinedRoom);
      socket.off('user-left-room', handleUserLeftRoom);
      socket.off('user-online', handleUserOnline);
      socket.off('user-offline', handleUserOffline);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('room-updated', handleRoomUpdated);
      
      if (currentRoom) {
        socket.emit('leave-room', currentRoom._id);
      }
    };
  }, [socket, isConnected, currentRoom, user, messages, encryptionService, isEncryptionInitialized]);

  // Auto-clear typing indicators after 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTypingUsers(prev => prev.filter(user => {
        // In a real app, you'd check last typing timestamp
        return true;
      }));
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  // Actions
  const fetchRooms = async () => {
    try {
      setIsLoadingRooms(true);
      const response = await chatAPI.getRooms();
      setRooms(response.data.rooms);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const selectRoom = async (roomId: string) => {
    try {
      // Clear previous room data
      setMessages([]);
      setTypingUsers([]);
      setCurrentPage(1);
      setHasMoreMessages(true);
      
      // Fetch room details and messages in parallel
      const [roomResponse, messagesResponse] = await Promise.all([
        chatAPI.getRoom(roomId),
        chatAPI.getMessages(roomId, 1)
      ]);
      
      const room = roomResponse.data.room;
      let messagesData = messagesResponse.data.messages;
      
      // Decrypt encrypted messages
      if (encryptionService && roomId) {
        messagesData = await Promise.all(
          messagesData.map(async (message: Message) => {
            if (message.isEncrypted) {
              try {
                const decrypted = await encryptionService.decryptMessage(roomId, {
                  isEncrypted: message.isEncrypted,
                  encryptedContent: message.encryptedContent,
                  encryptionIv: message.encryptionIv,
                  signature: message.signature,
                  content: message.content
                });
                return { ...message, content: decrypted };
              } catch (error) {
                console.error('Failed to decrypt message:', error);
                return { ...message, content: '[Encrypted message]' };
              }
            }
            return message;
          })
        );
      }
      
      setCurrentRoom(room);
      setMessages(messagesData);
      setHasMoreMessages(messagesResponse.data.pagination.page < messagesResponse.data.pagination.pages);
    } catch (error) {
      console.error('Failed to select room:', error);
    }
  };

  const fetchMessages = async (loadMore = false) => {
    if (!currentRoom || isLoadingMessages) return;

    try {
      setIsLoadingMessages(true);
      const page = loadMore ? currentPage + 1 : 1;
      const response = await chatAPI.getMessages(currentRoom._id, page);
      
      let messagesData = response.data.messages;
      
      // Decrypt encrypted messages
      if (encryptionService && currentRoom._id) {
        messagesData = await Promise.all(
          messagesData.map(async (message: Message) => {
            if (message.isEncrypted) {
              try {
                const decrypted = await encryptionService.decryptMessage(currentRoom._id, {
                  isEncrypted: message.isEncrypted,
                  encryptedContent: message.encryptedContent,
                  encryptionIv: message.encryptionIv,
                  signature: message.signature,
                  content: message.content
                });
                return { ...message, content: decrypted };
              } catch (error) {
                console.error('Failed to decrypt message:', error);
                return { ...message, content: '[Encrypted message]' };
              }
            }
            return message;
          })
        );
      }
      
      if (loadMore) {
        setMessages(prev => [...messagesData, ...prev]);
        setCurrentPage(page);
      } else {
        setMessages(messagesData);
        setCurrentPage(1);
      }
      
      setHasMoreMessages(response.data.pagination.page < response.data.pagination.pages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const sendMessage = async (content: string, type: 'text' | 'image' | 'file' = 'text', file?: File) => {
    if (!socket || !currentRoom || !content.trim()) return;

    try {
      let messageData: any = {
        roomId: currentRoom._id,
        content: content.trim(),
        type,
      };
      
      // Encrypt text messages for normal rooms only.
      if (
        type === 'text' &&
        !currentRoom.isBotRoom &&
        encryptionService &&
        currentRoom._id &&
        isEncryptionInitialized
      ) {
        try {
          const encrypted = await encryptionService.encryptMessage(currentRoom._id, content.trim());
          messageData = {
            ...messageData,
            ...encrypted,
          };
        } catch (error) {
          console.error('Encryption failed, sending plaintext:', error);
        }
      }
      
      // Handle file upload (if implemented)
      if (file && type !== 'text') {
        // TODO: Implement file upload with encryption
        console.log('File upload with encryption will be implemented');
        // For now, we'll just send text
      }

      socket.emit('send-message', messageData);

      // Stop typing indicator
      stopTyping();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Delete message function
  const deleteMessage = async (messageId: string) => {
    if (!socket || !currentRoom) {
      throw new Error('Socket not connected or no room selected');
    }
    
    return new Promise<void>((resolve, reject) => {
      socket.emit('delete-message', { 
        messageId, 
        roomId: currentRoom._id 
      }, (response: any) => {
        if (response?.success) {
          // Update local state immediately
          setMessages(prev => prev.map(msg => 
            msg._id === messageId 
              ? { ...msg, deleted: true, deletedAt: new Date().toISOString() }
              : msg
          ));
          
          // Update last message in rooms if needed
          setRooms(prev => prev.map(room => {
            if (room._id === currentRoom._id && room.lastMessage?._id === messageId) {
              // Find the latest non-deleted message
              const latestMessage = messages
                .filter(msg => msg.roomId === currentRoom._id && !msg.deleted)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
              
              if (latestMessage) {
                return {
                  ...room,
                  lastMessage: {
                    _id: latestMessage._id,
                    content: latestMessage.isEncrypted ? '[Encrypted message]' : latestMessage.content,
                    sender: latestMessage.sender,
                    createdAt: latestMessage.createdAt,
                    isEncrypted: latestMessage.isEncrypted,
                  }
                };
              } else {
                return {
                  ...room,
                  lastMessage: undefined
                };
              }
            }
            return room;
          }));
          
          resolve();
        } else {
          reject(new Error(response?.error || 'Failed to delete message'));
        }
      });
    });
  };

  const createRoom = async (roomData: { 
    name: string; 
    description?: string; 
    isPrivate?: boolean; 
    memberIds?: string[] 
  }) => {
    try {
      const response = await chatAPI.createRoom(roomData);
      const newRoom = response.data.room;
      
      setRooms(prev => [newRoom, ...prev]);
      setShowNewRoomModal(false);
      
      // Initiate key exchange with all members
      if (encryptionService && isEncryptionInitialized && newRoom.members) {
        newRoom.members.forEach((member: any) => {
          if (member._id !== user?._id) {
            encryptionService.startKeyExchange(newRoom._id, member._id);
          }
        });
      }
      
      // Select the new room
      await selectRoom(newRoom._id);
    } catch (error) {
      console.error('Failed to create room:', error);
      throw error;
    }
  };

  const addMembersToRoom = async (roomId: string, userIds: string[]) => {
    try {
      const response = await chatAPI.addMembers(roomId, userIds);
      // Update current room if it's the one we're adding to
      if (currentRoom?._id === roomId) {
        setCurrentRoom(response.data.room);
        
        // Initiate key exchange with new members
        if (encryptionService && isEncryptionInitialized) {
          userIds.forEach(userId => {
            encryptionService.startKeyExchange(roomId, userId);
          });
        }
      }
      // Refresh rooms list
      await fetchRooms();
    } catch (error : any) {
      console.error('Failed to add members:', error);
      throw new Error(error.response?.data?.error || 'Failed to add members');
    }
  };

  // ADDED: Initiate key exchange
  const initiateKeyExchange = async (targetUserId?: string) => {
    if (!encryptionService || !currentRoom?._id || !isEncryptionInitialized) return;
    
    try {
      await encryptionService.startKeyExchange(currentRoom._id, targetUserId);
    } catch (error) {
      console.error('Key exchange failed:', error);
    }
  };

  // ADDED: Get encryption status
  const getEncryptionStatus = () => ({
    supported: isEncryptionSupported,
    initialized: isEncryptionInitialized,
    ready: isEncryptionSupported && isEncryptionInitialized
  });

  // Typing actions
  const startTyping = () => {
    if (!socket || !currentRoom || !user) return;

    socket.emit('typing', { roomId: currentRoom._id, isTyping: true });
    
    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set new timeout to stop typing after 2 seconds
    const timeout = setTimeout(() => {
      stopTyping();
    }, 2000);
    
    setTypingTimeout(timeout);
  };

  const stopTyping = () => {
    if (!socket || !currentRoom || !user) return;

    socket.emit('typing', { roomId: currentRoom._id, isTyping: false });
    
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
    }
  };

  // UI Actions
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const value: ChatContextType = {
    // State
    rooms,
    currentRoom,
    isLoadingRooms,
    messages,
    isLoadingMessages,
    hasMoreMessages,
    isSidebarOpen,
    showNewRoomModal,
    showUserSearchModal,
    typingUsers,
    
    // Encryption
    encryptionService,
    isEncryptionSupported,
    isEncryptionInitialized,
    
    // Actions
    fetchRooms,
    selectRoom,
    fetchMessages,
    sendMessage,
    createRoom,
    addMembersToRoom,
    deleteMessage,
    
    // Encryption actions
    initiateKeyExchange,
    initializeEncryption,
    getEncryptionStatus,
    
    // UI Actions
    toggleSidebar,
    setShowNewRoomModal,
    setShowUserSearchModal,
    
    // Typing actions
    startTyping,
    stopTyping,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};