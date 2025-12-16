import Redis from 'ioredis';
import database from '../config/database';

export interface FileMetadata {
  id: string;
  userId: string;
  originalName: string;
  fileName: string;
  url: string;
  path: string;
  type: 'image' | 'file';
  mimeType: string;
  size: number;
  uploadDate: Date;
}

export class RedisService {
  private redis: Redis | null = null;

  constructor() {
    // Don't get client immediately, get it when needed
  }

  private async ensureConnected(): Promise<Redis> {
    if (!this.redis || !database.isRedisConnected()) {
      this.redis = await database.connectRedis();
    }
    return this.redis;
  }

  // User status management
  async setUserOnline(userId: string, socketId: string): Promise<void> {
    const redis = await this.ensureConnected();
    const userKey = `user:${userId}`;
    const socketKey = `socket:${socketId}`;
    
    const pipeline = redis.pipeline();
    pipeline.hmset(userKey, {
      online: 'true',
      socketId,
      lastSeen: new Date().toISOString(),
    });
    pipeline.expire(userKey, 86400); // 24 hours
    pipeline.set(socketKey, userId);
    pipeline.expire(socketKey, 86400);
    
    await pipeline.exec();
  }

  async setUserOffline(socketId: string): Promise<string | null> {
    try {
      const redis = await this.ensureConnected();
      const socketKey = `socket:${socketId}`;
      const userId = await redis.get(socketKey);
      
      if (userId) {
        const userKey = `user:${userId}`;
        await redis.hmset(userKey, {
          online: 'false',
          lastSeen: new Date().toISOString(),
        });
        await redis.del(socketKey);
      }
      
      return userId;
    } catch (error) {
      console.error('Error in setUserOffline:', error);
      return null;
    }
  }

  async getUserStatus(userId: string): Promise<{
    online: boolean;
    socketId?: string;
    lastSeen: string;
  } | null> {
    try {
      const redis = await this.ensureConnected();
      const userKey = `user:${userId}`;
      const data = await redis.hgetall(userKey);
      
      if (!data || Object.keys(data).length === 0) {
        return null;
      }
      
      return {
        online: data.online === 'true',
        socketId: data.socketId || undefined,
        lastSeen: data.lastSeen,
      };
    } catch (error) {
      console.error('Error in getUserStatus:', error);
      return null;
    }
  }

  // Room management
  async addUserToRoom(userId: string, roomId: string): Promise<void> {
    const redis = await this.ensureConnected();
    const roomKey = `room:${roomId}:users`;
    const userRoomsKey = `user:${userId}:rooms`;
    
    const pipeline = redis.pipeline();
    pipeline.sadd(roomKey, userId);
    pipeline.sadd(userRoomsKey, roomId);
    pipeline.expire(roomKey, 86400);
    pipeline.expire(userRoomsKey, 86400);
    
    await pipeline.exec();
  }

  async removeUserFromRoom(userId: string, roomId: string): Promise<void> {
    const redis = await this.ensureConnected();
    const roomKey = `room:${roomId}:users`;
    const userRoomsKey = `user:${userId}:rooms`;
    
    await redis.srem(roomKey, userId);
    await redis.srem(userRoomsKey, roomId);
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    const redis = await this.ensureConnected();
    const roomKey = `room:${roomId}:users`;
    return redis.smembers(roomKey);
  }

  async getUserRooms(userId: string): Promise<string[]> {
    const redis = await this.ensureConnected();
    const userRoomsKey = `user:${userId}:rooms`;
    return redis.smembers(userRoomsKey);
  }

  // Message caching
  async cacheMessage(roomId: string, message: any): Promise<void> {
    const redis = await this.ensureConnected();
    const cacheKey = `room:${roomId}:messages`;
    const messageStr = JSON.stringify(message);
    
    const pipeline = redis.pipeline();
    pipeline.lpush(cacheKey, messageStr);
    pipeline.ltrim(cacheKey, 0, 99); // Keep only last 100 messages
    pipeline.expire(cacheKey, 3600); // Expire after 1 hour
    
    await pipeline.exec();
  }

  async getCachedMessages(roomId: string, limit: number = 50): Promise<any[]> {
    try {
      const redis = await this.ensureConnected();
      const cacheKey = `room:${roomId}:messages`;
      const messages = await redis.lrange(cacheKey, 0, limit - 1);
      
      return messages.map(msg => JSON.parse(msg)).reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error in getCachedMessages:', error);
      return [];
    }
  }

  // ADDED: Update cached message when deleted
  async updateCachedMessage(roomId: string, messageId: string, updates: any): Promise<void> {
    try {
      const redis = await this.ensureConnected();
      const cacheKey = `room:${roomId}:messages`;
      
      // Get all cached messages
      const messages = await redis.lrange(cacheKey, 0, -1);
      
      // Find and update the specific message
      const updatedMessages = messages.map(msg => {
        try {
          const parsed = JSON.parse(msg);
          if (parsed._id === messageId) {
            return JSON.stringify({ ...parsed, ...updates });
          }
          return msg;
        } catch {
          return msg;
        }
      });

      // Update the list in Redis
      if (updatedMessages.length > 0) {
        await redis.del(cacheKey);
        await redis.rpush(cacheKey, ...updatedMessages);
      }
    } catch (error) {
      console.error('Error in updateCachedMessage:', error);
      throw error;
    }
  }

  // ADDED: Remove cached message completely
  async removeCachedMessage(roomId: string, messageId: string): Promise<void> {
    try {
      const redis = await this.ensureConnected();
      const cacheKey = `room:${roomId}:messages`;
      
      // Get all cached messages
      const messages = await redis.lrange(cacheKey, 0, -1);
      
      // Filter out the deleted message
      const filteredMessages = messages.filter(msg => {
        try {
          const parsed = JSON.parse(msg);
          return parsed._id !== messageId;
        } catch {
          return true;
        }
      });

      // Update the list in Redis
      if (filteredMessages.length > 0) {
        await redis.del(cacheKey);
        await redis.rpush(cacheKey, ...filteredMessages);
      } else {
        await redis.del(cacheKey);
      }
    } catch (error) {
      console.error('Error in removeCachedMessage:', error);
      throw error;
    }
  }

  // ADDED: Cache message deletion status
  async cacheMessageDeletion(messageId: string, roomId: string, userId: string): Promise<void> {
    try {
      const redis = await this.ensureConnected();
      const deletionKey = `message:${messageId}:deletion`;
      
      await redis.hmset(deletionKey, {
        messageId,
        roomId,
        deletedBy: userId,
        deletedAt: new Date().toISOString(),
      });
      await redis.expire(deletionKey, 86400); // 24 hours
    } catch (error) {
      console.error('Error in cacheMessageDeletion:', error);
      throw error;
    }
  }

  // ADDED: Get message deletion status
  async getMessageDeletionStatus(messageId: string): Promise<{
    messageId: string;
    roomId: string;
    deletedBy: string;
    deletedAt: string;
  } | null> {
    try {
      const redis = await this.ensureConnected();
      const deletionKey = `message:${messageId}:deletion`;
      const data = await redis.hgetall(deletionKey);
      
      if (!data || !data.messageId) {
        return null;
      }
      
      return {
        messageId: data.messageId,
        roomId: data.roomId,
        deletedBy: data.deletedBy,
        deletedAt: data.deletedAt,
      };
    } catch (error) {
      console.error('Error in getMessageDeletionStatus:', error);
      return null;
    }
  }

  // Typing indicators
  async setTypingStatus(
    roomId: string,
    userId: string,
    username: string,
    isTyping: boolean
  ): Promise<void> {
    const redis = await this.ensureConnected();
    const typingKey = `room:${roomId}:typing`;
    
    if (isTyping) {
      await redis.hset(typingKey, userId, username);
      await redis.expire(typingKey, 30); // Auto expire after 30 seconds
    } else {
      await redis.hdel(typingKey, userId);
    }
  }

  async getTypingUsers(roomId: string): Promise<{ [userId: string]: string }> {
    try {
      const redis = await this.ensureConnected();
      const typingKey = `room:${roomId}:typing`;
      return redis.hgetall(typingKey);
    } catch (error) {
      console.error('Error in getTypingUsers:', error);
      return {};
    }
  }

  // Rate limiting
  async isRateLimited(key: string, limit: number, windowInSeconds: number): Promise<boolean> {
    const redis = await this.ensureConnected();
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, windowInSeconds);
    }
    
    return current > limit;
  }

  // Clear all data for a user (on logout)
  async clearUserData(userId: string): Promise<void> {
    const redis = await this.ensureConnected();
    const userKey = `user:${userId}`;
    const userRoomsKey = `user:${userId}:rooms`;
    
    // Get all rooms user is in
    const rooms = await this.getUserRooms(userId);
    
    const pipeline = redis.pipeline();
    pipeline.del(userKey);
    pipeline.del(userRoomsKey);
    
    // Remove user from all rooms
    for (const roomId of rooms) {
      pipeline.srem(`room:${roomId}:users`, userId);
    }
    
    await pipeline.exec();
  }

  async cacheFileMetadata(file: FileMetadata): Promise<void> {
    const redis = await this.ensureConnected();
    const key = `file:${file.id}`;
    const userFilesKey = `user:${file.userId}:files`;
    
    const pipeline = redis.pipeline();
    pipeline.hmset(key, {
      id: file.id,
      userId: file.userId,
      originalName: file.originalName,
      fileName: file.fileName,
      url: file.url,
      path: file.path,
      type: file.type,
      mimeType: file.mimeType,
      size: file.size.toString(),
      uploadDate: file.uploadDate.toISOString(),
    });
    pipeline.expire(key, 30 * 24 * 60 * 60); // 30 days
    
    pipeline.zadd(userFilesKey, Date.now(), file.id);
    pipeline.expire(userFilesKey, 30 * 24 * 60 * 60); // 30 days
    
    await pipeline.exec();
  }

  async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    const redis = await this.ensureConnected();
    const key = `file:${fileId}`;
    const data = await redis.hgetall(key);
    
    if (!data || !data.id) {
      return null;
    }
    
    return {
      id: data.id,
      userId: data.userId,
      originalName: data.originalName,
      fileName: data.fileName,
      url: data.url,
      path: data.path,
      type: data.type as 'image' | 'file',
      mimeType: data.mimeType,
      size: parseInt(data.size),
      uploadDate: new Date(data.uploadDate),
    };
  }

  async getUserFiles(userId: string): Promise<FileMetadata[]> {
    const redis = await this.ensureConnected();
    const userFilesKey = `user:${userId}:files`;
    const fileIds = await redis.zrange(userFilesKey, 0, -1);
    
    const files: FileMetadata[] = [];
    for (const fileId of fileIds) {
      const file = await this.getFileMetadata(fileId);
      if (file) {
        files.push(file);
      }
    }
    
    return files.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
  }

  async deleteFileMetadata(fileId: string, userId: string): Promise<void> {
    const redis = await this.ensureConnected();
    const key = `file:${fileId}`;
    const userFilesKey = `user:${userId}:files`;
    
    await redis.del(key);
    await redis.zrem(userFilesKey, fileId);
  }
  
  // ADDED: Delete all cached messages for a room (useful for room cleanup)
  async clearRoomMessages(roomId: string): Promise<void> {
    const redis = await this.ensureConnected();
    const cacheKey = `room:${roomId}:messages`;
    await redis.del(cacheKey);
  }
  
  // ADDED: Get message count in cache for a room
  async getCachedMessageCount(roomId: string): Promise<number> {
    const redis = await this.ensureConnected();
    const cacheKey = `room:${roomId}:messages`;
    return redis.llen(cacheKey);
  }
  
}

export const redisService = new RedisService();