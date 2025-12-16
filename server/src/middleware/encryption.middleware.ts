import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { EncryptionService } from '../utils/crypto';

export const requireEncryption = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await User.findById((req as any).user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.encryptionEnabled) {
      return next();
    }
    
    // Check if client supports encryption
    const encryptionHeader = req.headers['x-encryption-supported'];
    if (encryptionHeader !== 'true') {
      return res.status(400).json({ 
        error: 'Encryption required but client does not support it',
        requiresEncryption: true
      });
    }
    
    next();
  } catch (error) {
    console.error('Encryption middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const encryptMessageContent = async (
  message: any,
  senderPublicKey: string,
  recipientPublicKey: string
) => {
  try {
    // Derive shared secret
    const sharedSecret = EncryptionService.deriveSharedSecret(
      senderPublicKey, // In practice, you'd use private key
      recipientPublicKey
    );
    
    // Encrypt the message
    const { encrypted, iv, authTag } = EncryptionService.encrypt(
      message.content,
      sharedSecret
    );
    
    // Create signature for integrity
    const signature = EncryptionService.hash(
      `${encrypted}${iv}${authTag}`
    );
    
    return {
      isEncrypted: true,
      encryptedContent: encrypted,
      encryptionIv: iv,
      signature,
      originalContent: undefined // Don't store plaintext
    };
  } catch (error) {
    console.error('Message encryption error:', error);
    throw error;
  }
};

export const verifyMessageSignature = (
  message: any
): boolean => {
  try {
    if (!message.isEncrypted || !message.signature) {
      return true; // Non-encrypted messages don't need verification
    }
    
    const calculatedHash = EncryptionService.hash(
      `${message.encryptedContent}${message.encryptionIv}`
    );
    
    return calculatedHash === message.signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};