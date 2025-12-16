import mongoose from 'mongoose';
import Redis from 'ioredis';

class Database {
  private static instance: Database;
  private mongoConnection: mongoose.Connection | null = null;
  private redisClient: Redis | null = null;
  private redisConnected: boolean = false;

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connectMongo(): Promise<mongoose.Connection> {
    if (this.mongoConnection) {
      return this.mongoConnection;
    }

    try {
      const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app';
      
      await mongoose.connect(MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.mongoConnection = mongoose.connection;

      this.mongoConnection.on('error', (error) => {
        console.error('MongoDB connection error:', error);
      });

      this.mongoConnection.on('disconnected', () => {
        console.log('MongoDB disconnected');
        this.mongoConnection = null;
      });

      console.log('MongoDB connected successfully');
      return this.mongoConnection;
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async connectRedis(): Promise<Redis> {
    if (this.redisClient && this.redisConnected) {
      return this.redisClient;
    }

    try {
      const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.redisClient = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: true, // Don't connect immediately
      });

      // Connect manually
      await this.redisClient.connect();
      this.redisConnected = true;

      this.redisClient.on('connect', () => {
        console.log('Redis connected successfully');
        this.redisConnected = true;
      });

      this.redisClient.on('error', (error) => {
        console.error('Redis connection error:', error);
        this.redisConnected = false;
      });

      this.redisClient.on('end', () => {
        console.log('Redis connection closed');
        this.redisConnected = false;
      });

      return this.redisClient;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.redisConnected = false;
      throw error;
    }
  }

  getMongoConnection(): mongoose.Connection {
    if (!this.mongoConnection) {
      throw new Error('MongoDB not connected. Call connectMongo() first.');
    }
    return this.mongoConnection;
  }

  getRedisClient(): Redis {
    if (!this.redisClient || !this.redisConnected) {
      throw new Error('Redis not connected. Call connectRedis() first.');
    }
    return this.redisClient;
  }

  isRedisConnected(): boolean {
    return this.redisConnected;
  }

  async disconnect(): Promise<void> {
    try {
      if (this.mongoConnection) {
        await mongoose.disconnect();
        this.mongoConnection = null;
        console.log('MongoDB disconnected');
      }

      if (this.redisClient) {
        await this.redisClient.quit();
        this.redisClient = null;
        this.redisConnected = false;
        console.log('Redis disconnected');
      }
    } catch (error) {
      console.error('Error disconnecting databases:', error);
    }
  }
}

export default Database.getInstance();