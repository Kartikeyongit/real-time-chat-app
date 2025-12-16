import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  avatar?: string;
  online: boolean;
  lastSeen: Date;
  socketId?: string;
    // Encryption keys - ADDED
  publicKey: string;
  encryptedPrivateKey?: string; // Encrypted with user's password
  keySalt?: string;
  
  // Security settings
  twoFactorEnabled: boolean;
  encryptionEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatar: {
      type: String,
      default: '',
    },
    online: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    socketId: {
      type: String,
      default: '',
    },
    // Encryption keys - ADDED
    publicKey: {
      type: String,
      default: '',
    },
    encryptedPrivateKey: {
      type: String,
      default: '',
    },
    keySalt: {
      type: String,
      default: '',
    },
    
    // Security settings - ADDED
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    encryptionEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  const nextFn = next as any; // Type assertion to fix the issue
  
  if (!this.isModified('password')) {
    if (typeof nextFn === 'function') {
      return nextFn();
    }
    return;
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    if (typeof nextFn === 'function') {
      nextFn();
    }
  } catch (error: any) {
    if (typeof nextFn === 'function') {
      nextFn(error);
    } else {
      throw error;
    }
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON response
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = mongoose.model<IUser>('User', userSchema);