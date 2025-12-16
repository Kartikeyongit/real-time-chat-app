import mongoose, { Document, Schema } from 'mongoose';
import { Model, Query } from 'mongoose';

export interface IMessage extends Document {
  roomId: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  readBy: mongoose.Types.ObjectId[];
  
  // Delete functionality - ADDED
  deleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;

    // Encryption fields - ADDED
  isEncrypted: boolean;
  encryptedContent?: string;
  encryptionIv?: string;
  encryptionKeyId?: string;
  signature?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

// Define the custom query interface
interface MessageQueryHelpers {
  withDeleted(): Query<any, Document<IMessage>> & MessageQueryHelpers;
  onlyDeleted(): Query<any, Document<IMessage>> & MessageQueryHelpers;
}

// Define the model interface with static methods
interface MessageModel extends Model<IMessage, MessageQueryHelpers> {
  canUserDelete(messageId: string, userId: string): Promise<boolean>;
  softDelete(messageId: string, userId: string): Promise<IMessage | null>;
  getLastMessageForRoom(roomId: string): Promise<IMessage | null>;
}

const messageSchema = new Schema<IMessage, MessageModel, {}, MessageQueryHelpers>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: function (this: IMessage) {
        return this.type === 'text' || this.type === 'system';
      },
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'system'],
      default: 'text',
    },
    fileUrl: {
      type: String,
      required: function (this: IMessage) {
        return this.type === 'image' || this.type === 'file';
      },
    },
    fileName: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    
    // Delete functionality - ADDED
    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    // Encryption fields - ADDED
    isEncrypted: {
      type: Boolean,
      default: false,
      index: true,
    },
    encryptedContent: {
      type: String,
    },
    encryptionIv: {
      type: String,
    },
    encryptionKeyId: {
      type: String,
    },
    signature: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster message retrieval by room and timestamp
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

// ADDED: Index for querying non-deleted messages efficiently
messageSchema.index({ roomId: 1, deleted: 1, createdAt: -1 });
messageSchema.index({ deleted: 1, createdAt: -1 });

// ADDED: Virtual property to check if message can be deleted (within 15 minutes)
messageSchema.virtual('canDelete').get(function(this: IMessage) {
  const messageTime = this.createdAt.getTime();
  const currentTime = Date.now();
  const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds
  return !this.deleted && (currentTime - messageTime <= fifteenMinutes);
});

// ADDED: Query helper to include deleted messages
messageSchema.query.withDeleted = function() {
  return (this as any).where({ deleted: { $in: [true, false] } });
};

// ADDED: Query helper to get only deleted messages
messageSchema.query.onlyDeleted = function() {
  return (this as any).where({ deleted: true });
};

// ADDED: Static method to check if user can delete message
messageSchema.statics.canUserDelete = async function(
  messageId: string,
  userId: string
): Promise<boolean> {
  try {
    const message = await this.findById(messageId);
    if (!message) return false;
    
    // Check if message is already deleted
    if (message.deleted) return false;
    
    // Check if user is the sender
    if (message.sender.toString() !== userId.toString()) return false;
    
    // Check time limit (15 minutes)
    const messageTime = message.createdAt.getTime();
    const currentTime = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    
    return currentTime - messageTime <= fifteenMinutes;
  } catch (error) {
    console.error('Error checking delete permission:', error);
    return false;
  }
};

// ADDED: Static method to soft delete message
messageSchema.statics.softDelete = async function(
  messageId: string,
  userId: string
): Promise<IMessage | null> {
  try {
    const message = await this.findById(messageId);
    if (!message) return null;
    
    // Check if already deleted
    if (message.deleted) return message;
    
    // Check if user can delete
    const canDelete = await this.canUserDelete(messageId, userId);
    if (!canDelete) {
      throw new Error('User cannot delete this message');
    }
    
    // Perform soft delete
    message.deleted = true;
    message.deletedAt = new Date();
    message.deletedBy = new mongoose.Types.ObjectId(userId);
    
    // Clear file information for deleted messages
    if (message.type !== 'text') {
      message.fileUrl = undefined;
      message.fileName = undefined;
      message.fileSize = undefined;
    }
    
    await message.save();
    return message;
  } catch (error) {
    console.error('Error in softDelete:', error);
    throw error;
  }
};

// ADDED: Static method to get last non-deleted message in a room
messageSchema.statics.getLastMessageForRoom = async function(
  roomId: string
): Promise<IMessage | null> {
  return this.findOne({
    roomId,
    deleted: { $ne: true }
  })
    .sort({ createdAt: -1 })
    .populate('sender', 'username avatar email')
    .exec();
};

export const Message = mongoose.model<IMessage, MessageModel>('Message', messageSchema);