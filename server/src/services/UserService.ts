import { User, IUser } from '../models/User';
import { generateToken } from '../utils/auth';

export class UserService {
  async register(userData: {
    username: string;
    email: string;
    password: string;
  }): Promise<{ user: IUser; token: string }> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: userData.email }, { username: userData.username }]
      });

      if (existingUser) {
        throw new Error('User with this email or username already exists');
      }

      // Create new user
      const user = new User({
        username: userData.username,
        email: userData.email,
        password: userData.password,
        online: false,
        lastSeen: new Date(),
      });

      await user.save();

      // Generate JWT token
      const token = generateToken({
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
      });

      return { user: user.toJSON() as IUser, token };
    } catch (error) {
      throw error;
    }
  }

  async login(credentials: {
    email: string;
    password: string;
  }): Promise<{ user: IUser; token: string }> {
    try {
      // Find user by email
      const user = await User.findOne({ email: credentials.email });
      
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check password
      const isPasswordValid = await user.comparePassword(credentials.password);
      
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Update last seen
      user.lastSeen = new Date();
      await user.save();

      // Generate JWT token
      const token = generateToken({
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
      });

      return { user: user.toJSON() as IUser, token };
    } catch (error) {
      throw error;
    }
  }

  async getUserProfile(userId: string): Promise<IUser> {
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      throw new Error('User not found');
    }

    return user.toJSON() as IUser;
  }

  async updateUserProfile(
    userId: string,
    updates: {
      username?: string;
      avatar?: string;
    }
  ): Promise<IUser> {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Check if username is being changed and if it's available
    if (updates.username && updates.username !== user.username) {
      const existingUser = await User.findOne({ username: updates.username });
      if (existingUser) {
        throw new Error('Username already taken');
      }
      user.username = updates.username;
    }

    if (updates.avatar !== undefined) {
      user.avatar = updates.avatar;
    }

    await user.save();
    return user.toJSON() as IUser;
  }

  async searchUsers(query: string, excludeUserId: string): Promise<IUser[]> {
    const users = await User.find({
      $and: [
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ]
        },
        { _id: { $ne: excludeUserId } }
      ]
    })
    .select('-password')
    .limit(20);

    return users.map(user => user.toJSON() as IUser);
  }

  async getUsersByIds(userIds: string[]): Promise<IUser[]> {
    const users = await User.find({
      _id: { $in: userIds }
    }).select('-password');

    return users.map(user => user.toJSON() as IUser);
  }
}

export const userService = new UserService();