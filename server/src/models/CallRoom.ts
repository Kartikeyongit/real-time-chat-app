import mongoose, { Schema, Document } from 'mongoose';

export interface ICallRoom extends Document {
  callId: string;
  roomId: string;
  participants: Array<{
    userId: string;
    username: string;
    joinedAt: Date;
    leftAt?: Date;
  }>;
  type: 'audio' | 'video';
  status: 'active' | 'ended' | 'missed' | 'rejected';
  creator: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
  metadata?: {
    maxParticipants?: number;
    recordingUrl?: string;
    screenSharingEnabled?: boolean;
  };
}

const CallRoomSchema: Schema = new Schema({
  callId: {
    type: String,
    required: true,
    unique: true,
  },
  roomId: {
    type: String,
    required: true,
  },
  participants: [{
    userId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    joinedAt: {
      type: Date,
      required: true,
    },
    leftAt: {
      type: Date,
    },
  }],
  type: {
    type: String,
    enum: ['audio', 'video'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'missed', 'rejected'],
    default: 'active',
  },
  creator: {
    type: String,
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
  },
  duration: {
    type: Number,
  },
  metadata: {
    maxParticipants: {
      type: Number,
      default: 10,
    },
    recordingUrl: {
      type: String,
    },
    screenSharingEnabled: {
      type: Boolean,
      default: true,
    },
  },
}, {
  timestamps: true,
});

// Change the pre-save hook:
CallRoomSchema.pre('save', function(next) {
  const callRoom = this as any; // Type assertion
  if (callRoom.endTime && callRoom.startTime) {
    const endTime = new Date(callRoom.endTime);
    const startTime = new Date(callRoom.startTime);
    callRoom.duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  }
});

export const CallRoom = mongoose.model<ICallRoom>('CallRoom', CallRoomSchema);