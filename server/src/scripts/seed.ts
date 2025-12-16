import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { ChatRoom } from '../models/ChatRoom';
import { Message } from '../models/Message';

dotenv.config();

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app');
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await ChatRoom.deleteMany({});
    await Message.deleteMany({});
    console.log('Cleared existing data');

    // Create test users
    const users = await User.create([
      {
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
        online: true,
      },
      {
        username: 'bob',
        email: 'bob@example.com',
        password: 'password123',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
        online: true,
      },
      {
        username: 'charlie',
        email: 'charlie@example.com',
        password: 'password123',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
        online: false,
      },
    ]);
    console.log(`Created ${users.length} users`);

    // Create chat rooms
    const generalRoom = await ChatRoom.create({
      name: 'General Chat',
      description: 'A place for general discussions',
      isPrivate: false,
      createdBy: users[0]._id,
      members: users.map(user => user._id),
    });

    const privateRoom = await ChatRoom.create({
      name: 'Private Room',
      description: 'Secret discussions',
      isPrivate: true,
      createdBy: users[1]._id,
      members: [users[0]._id, users[1]._id],
    });
    console.log('Created chat rooms');

    // Create some initial messages
    const messages = await Message.create([
      {
        roomId: generalRoom._id,
        sender: users[0]._id,
        content: 'Hello everyone! 👋',
        type: 'text',
        readBy: [users[0]._id, users[1]._id],
      },
      {
        roomId: generalRoom._id,
        sender: users[1]._id,
        content: 'Hi Alice! How are you?',
        type: 'text',
        readBy: [users[1]._id],
      },
      {
        roomId: privateRoom._id,
        sender: users[0]._id,
        content: 'This is a private message',
        type: 'text',
        readBy: [users[0]._id],
      },
    ]);
    console.log(`Created ${messages.length} messages`);

    // Update rooms with last message
    generalRoom.lastMessage = messages[1]._id;
    privateRoom.lastMessage = messages[2]._id;
    await generalRoom.save();
    await privateRoom.save();

    console.log('Database seeded successfully!');
    console.log('\nTest credentials:');
    console.log('Alice: alice@example.com / password123');
    console.log('Bob: bob@example.com / password123');
    console.log('Charlie: charlie@example.com / password123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();