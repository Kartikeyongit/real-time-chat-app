import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

const router = express.Router();

// Add a GET endpoint for testing
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Upload endpoint is working. Use POST /api/upload to upload files.',
    timestamp: new Date().toISOString()
  });
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory:', uploadsDir);
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      // Check if user is authenticated
      const user = (req as any).user;
      if (!user || !user.userId) {
        console.error('❌ No user found in request');
        return cb(new Error('User not authenticated'), '');
      }
      
      // Create user-specific directory
      const userDir = path.join(uploadsDir, user.userId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
        console.log('📁 Created user directory:', userDir);
      }
      cb(null, userDir);
    } catch (error: any) {
      console.error('❌ Error creating upload directory:', error);
      cb(error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    console.log('📄 Generated filename:', uniqueName);
    cb(null, uniqueName);
  },
});

// File filter for security
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  console.log('📋 File upload attempt:', {
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'video/webm',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    console.log('✅ File type allowed:', file.mimetype);
    cb(null, true);
  } else {
    console.log('❌ File type not allowed:', file.mimetype);
    cb(new Error(`File type "${file.mimetype}" not allowed`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// FIXED: Changed from '/upload' to '/' since router is already mounted at '/api/upload'
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  console.log('⬆️  Upload request received at:', new Date().toISOString());
  
  try {
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const user = (req as any).user;
    const file = req.file;

    console.log('📄 File uploaded:', {
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      destination: file.destination,
      filename: file.filename
    });

    // Determine file type
    let fileType: 'image' | 'file' = 'file';
    if (file.mimetype.startsWith('image/')) {
      fileType = 'image';
    } else if (file.mimetype.startsWith('audio/')) {
      fileType = 'file';
    } else if (file.mimetype.startsWith('video/')) {
      fileType = 'file';
    }

    // Construct URL
    const fileUrl = `/uploads/${user.userId}/${file.filename}`;
    const protocol = req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}${fileUrl}`;

    console.log('🔗 File accessible at:', fullUrl);
    console.log('📂 File saved at:', file.path);

    // Try to cache file metadata in Redis (optional - can fail silently)
    try {
      const { redisService } = await import('../services/RedisService');
      await redisService.cacheFileMetadata({
        id: uuidv4(),
        userId: user.userId,
        originalName: file.originalname,
        fileName: file.filename,
        url: fullUrl,
        path: file.path,
        type: fileType,
        mimeType: file.mimetype,
        size: file.size,
        uploadDate: new Date(),
      });
      console.log('✅ File metadata cached in Redis');
    } catch (redisError: any) {
      console.log('⚠️  Redis caching failed (optional):', redisError?.message || 'Unknown error');
      // Continue without Redis cache - this is not critical
    }

    res.json({
      success: true,
      file: {
        id: uuidv4(),
        originalName: file.originalname,
        fileName: file.filename,
        url: fullUrl,
        type: fileType,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadDate: new Date(),
      },
    });
    
    console.log('✅ Upload completed successfully');
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File size exceeds 10MB limit',
      });
    }
    
    if (error.message.includes('File type not allowed')) {
      return res.status(415).json({
        success: false,
        error: 'File type not supported',
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file',
    });
  }
});

// Get uploaded files for user - FIXED path
router.get('/files', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { redisService } = await import('../services/RedisService');
    
    const files = await redisService.getUserFiles(user.userId);
    
    res.json({
      success: true,
      files,
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch files',
    });
  }
});

// Delete a file - FIXED path
router.delete('/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const { fileId } = req.params;
    const { redisService } = await import('../services/RedisService');
    
    const file = await redisService.getFileMetadata(fileId);
    
    if (!file || file.userId !== user.userId) {
      return res.status(404).json({
        success: false,
        error: 'File not found or access denied',
      });
    }
    
    // Delete from filesystem
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    // Delete from Redis
    await redisService.deleteFileMetadata(fileId, user.userId);
    
    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file',
    });
  }
});

export default router;