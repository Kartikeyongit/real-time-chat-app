import express from 'express';
import { userService } from '../services/UserService';
import { authenticateToken } from '../utils/auth';
import { User } from '../models/User';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const { user, token } = await userService.register({
      username,
      email,
      password,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
      token,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { user, token } = await userService.login({
      email,
      password,
    });

    res.json({
      success: true,
      message: 'Login successful',
      user,
      token,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message || 'Invalid credentials',
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const profile = await userService.getUserProfile(user.userId);
    
    res.json({
      success: true,
      user: profile,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message || 'User not found',
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { username, avatar } = req.body;

    const updatedUser = await userService.updateUserProfile(user.userId, {
      username,
      avatar,
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update profile',
    });
  }
});

router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById((req as any).user.userId)
      .select('-password -encryptedPrivateKey -keySalt');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const users = await userService.searchUsers(q, user.userId);
    
    res.json({
      success: true,
      users,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Search failed',
    });
  }
});

// Validate token
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const profile = await userService.getUserProfile(user.userId);
    
    res.json({
      success: true,
      valid: true,
      user: profile,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      valid: false,
      error: 'Invalid token',
    });
  }
});

export default router;