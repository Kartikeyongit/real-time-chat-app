export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  online: boolean;
  lastSeen?: Date;
}

export interface Message {
  id: string;
  roomId: string;
  sender: User;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'document' | 'system';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  
  // Delete functionality fields
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string; // User ID of who deleted the message
  canDelete?: boolean; // Client-side flag if user can delete this message
  
  // Read receipts
  readBy?: string[]; // Array of user IDs who have read the message
  deliveredTo?: string[]; // Array of user IDs who have received the message
  
  // Edit functionality (optional for future)
  edited?: boolean;
  editedAt?: Date;
  originalContent?: string;
}

export interface FileAttachment {
  id: string;
  originalName: string;
  fileName: string;
  url: string;
  type: 'image' | 'file' | 'audio' | 'video' | 'document';
  mimeType: string;
  size: number;
  uploadDate: Date;
  userId: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  members: User[];
  isPrivate: boolean;
  createdAt: Date;
  lastMessage?: Message;
  
  // Room metadata
  createdBy?: string;
  adminIds?: string[]; // For private rooms
  settings?: {
    allowMessageDeletion?: boolean;
    deletionTimeLimit?: number; // In minutes
    allowMessageEditing?: boolean;
    editTimeLimit?: number; // In minutes
  };
}

export interface TypingStatus {
  roomId: string;
  userId: string;
  username: string;
  isTyping: boolean;
  lastTypingAt?: Date;
}

// Socket event types for delete functionality
export interface DeleteMessagePayload {
  messageId: string;
  roomId: string;
  userId: string;
  timestamp?: Date;
}

export interface MessageDeletedEvent {
  messageId: string;
  roomId: string;
  deletedAt: Date;
  deletedBy: string;
  lastMessage?: Message; // Updated last message for the room
}

// Server response types
export interface DeleteMessageResponse {
  success: boolean;
  messageId: string;
  roomId: string;
  error?: string;
  deletedAt?: Date;
}

// Time limit configuration
export interface MessageDeletionConfig {
  enabled: boolean;
  timeLimit: number; // In minutes
  allowAdminDeletion: boolean; // Admins can delete any message
  allowSenderDeletion: boolean; // Sender can delete their own messages
  deletionMode: 'soft' | 'hard'; // 'soft' marks as deleted, 'hard' removes from DB
}

// System message types for deletion notifications
export interface SystemMessage extends Message {
  type: 'system';
  systemType: 'message_deleted' | 'message_edited' | 'user_joined' | 'user_left' | 'room_created';
  metadata?: {
    deletedMessageId?: string;
    deletedByUserId?: string;
    originalContent?: string;
    newContent?: string;
    userId?: string;
    username?: string;
  };
}

// Utility functions for message operations
export const canDeleteMessage = (
  message: Message, 
  currentUserId: string, 
  config: MessageDeletionConfig = {
    enabled: true,
    timeLimit: 15,
    allowAdminDeletion: true,
    allowSenderDeletion: true,
    deletionMode: 'soft'
  }
): boolean => {
  if (!config.enabled) return false;
  
  // Check if message is already deleted
  if (message.deleted) return false;
  
  // System messages cannot be deleted
  if (message.type === 'system') return false;
  
  // Calculate time difference in minutes
  const messageTime = new Date(message.timestamp).getTime();
  const currentTime = new Date().getTime();
  const timeDiffMinutes = (currentTime - messageTime) / (1000 * 60);
  
  // Check if within time limit
  if (timeDiffMinutes > config.timeLimit) return false;
  
  // Check if user is sender
  const isSender = message.sender.id === currentUserId;
  if (isSender && config.allowSenderDeletion) return true;
  
  // TODO: Add admin check logic if needed
  // const isAdmin = /* check if user is admin of the room */;
  // if (isAdmin && config.allowAdminDeletion) return true;
  
  return false;
};

// Helper to create a deleted message placeholder
export const createDeletedMessagePlaceholder = (originalMessage: Message, deletedByUserId: string): Message => {
  return {
    ...originalMessage,
    content: 'This message was deleted',
    deleted: true,
    deletedAt: new Date(),
    deletedBy: deletedByUserId,
    fileUrl: undefined, // Remove file URLs for deleted messages
    thumbnailUrl: undefined,
  };
};

// Helper to check if message content should be shown
export const getMessageContent = (message: Message): string => {
  if (message.deleted) {
    return 'This message was deleted';
  }
  return message.content;
};

// Helper to check if file should be accessible
export const isFileAccessible = (message: Message): boolean => {
  if (message.deleted) {
    return false; // Don't allow access to files of deleted messages
  }
  return !!message.fileUrl;
};

// Add to existing types
export interface CallRoom {
  id: string;
  roomId: string;
  participants: string[]; // User IDs
  creator: string;
  type: 'audio' | 'video';
  status: 'active' | 'ended' | 'waiting';
  startTime: Date;
  endTime?: Date;
  settings?: {
    maxParticipants?: number;
    recordingAllowed?: boolean;
    screenSharingAllowed?: boolean;
  };
}

export interface CallParticipant {
  userId: string;
  username: string;
  avatar?: string;
  streamId?: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  joinedAt: Date;
}

export interface WebRTCOffer {
  from: string;
  to: string;
  roomId: string;
  callId: string;
  type: 'video' | 'audio';
  sdp: RTCSessionDescriptionInit;
  metadata?: {
    username: string;
    avatar?: string;
  };
}

export interface WebRTCAnswer {
  from: string;
  to: string;
  roomId: string;
  callId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface ICECandidate {
  from: string;
  to: string;
  roomId: string;
  callId: string;
  candidate: RTCIceCandidateInit;
}

export interface CallInvitation {
  callId: string;
  roomId: string;
  from: string;
  fromUsername: string;
  fromAvatar?: string;
  type: 'video' | 'audio';
  timestamp: Date;
}

export interface CallStatus {
  callId: string;
  roomId: string;
  status: 'ringing' | 'answered' | 'rejected' | 'ended' | 'missed';
  participants: string[];
  timestamp: Date;
}

// Socket events for WebRTC
export interface WebRTCEvents {
  'call-invite': CallInvitation;
  'call-accept': { callId: string; roomId: string; userId: string };
  'call-reject': { callId: string; roomId: string; userId: string; reason?: string };
  'call-end': { callId: string; roomId: string; userId: string; reason?: string };
  'call-join': { callId: string; roomId: string; userId: string };
  'call-leave': { callId: string; roomId: string; userId: string };
  'webrtc-offer': WebRTCOffer;
  'webrtc-answer': WebRTCAnswer;
  'webrtc-ice-candidate': ICECandidate;
  'participant-muted': { callId: string; userId: string; isMuted: boolean };
  'participant-camera-off': { callId: string; userId: string; isCameraOff: boolean };
  'participant-screen-sharing': { callId: string; userId: string; isScreenSharing: boolean };
}

