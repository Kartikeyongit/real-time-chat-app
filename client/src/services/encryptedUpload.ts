import { getEncryptionService } from './encryption';
import api from './api';

export const uploadEncryptedFile = async (
  file: File,
  roomId: string,
  onProgress?: (progress: number) => void
): Promise<{
  url: string;
  fileName: string;
  fileSize: number;
  encryptionKey?: string;
}> => {
  const encryptionService = getEncryptionService();
  
  if (!encryptionService.isEncryptionSupported()) {
    // Fall back to regular upload
    return uploadFile(file, roomId, onProgress);
  }

  try {
    // Encrypt the file
    const { encryptedFile, key } = await encryptionService.encryptFile(file);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', encryptedFile, file.name);
    formData.append('roomId', roomId);
    formData.append('isEncrypted', 'true');
    formData.append('originalType', file.type);
    
    // Upload
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    
    return {
      ...response.data,
      encryptionKey: key
    };
  } catch (error) {
    console.error('Encrypted upload failed:', error);
    throw error;
  }
};

export const downloadAndDecryptFile = async (
  fileUrl: string,
  encryptionKey?: string
): Promise<Blob> => {
  try {
    const response = await fetch(fileUrl);
    const encryptedBlob = await response.blob();
    
    if (!encryptionKey) {
      // File wasn't encrypted
      return encryptedBlob;
    }
    
    const encryptionService = getEncryptionService();
    return await encryptionService.decryptFile(encryptedBlob, encryptionKey);
  } catch (error) {
    console.error('File download/decryption failed:', error);
    throw error;
  }
};

// Helper function for regular upload (fallback)
const uploadFile = async (
  file: File,
  roomId: string,
  onProgress?: (progress: number) => void
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('roomId', roomId);
  
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });
  
  return response.data;
};