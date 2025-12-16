import React, { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { downloadAndDecryptFile } from '../../services/encryptedUpload';

// Define a local interface with encryption fields
interface ExtendedMessage {
  _id: string;
  roomId: string;
  sender: {
    _id: string;
    username: string;
    avatar?: string;
  };
  content: string;
  type: 'text' | 'image' | 'file' | 'system' | 'audio' | 'video';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  deletedAt?: string;
  
  // Encryption fields
  isEncrypted?: boolean;
  encryptedContent?: string;
  encryptionIv?: string;
  encryptionKeyId?: string;
  signature?: string;
  encryptionKey?: string;
}

interface FileMessageProps {
  message: ExtendedMessage;
  isOwnMessage?: boolean;
}

const FileMessage: React.FC<FileMessageProps> = ({ message, isOwnMessage = false }) => {
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const { encryptionService } = useChat();

  if (!message.fileUrl) return null;

  // Fix the file URL - ensure it's absolute
  const getFileUrl = () => {
    if (message.fileUrl?.startsWith('http')) {
      return message.fileUrl;
    }
    // If it's a relative path, prepend the API URL
    return `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${message.fileUrl}`;
  };

  const fileUrl = getFileUrl();
  
  const isImage = message.type === 'image' || message.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isAudio = message.type === 'audio' || message.fileUrl.match(/\.(mp3|wav|ogg|m4a)$/i);
  const isVideo = message.type === 'video' || message.fileUrl.match(/\.(mp4|webm|mov|avi)$/i);
  const isPDF = message.fileUrl.match(/\.pdf$/i);
  const isDocument = message.fileUrl.match(/\.(doc|docx|txt)$/i);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    if (isImage) return '🖼️';
    if (isPDF) return '📄';
    if (isDocument) return '📝';
    if (isAudio) return '🎵';
    if (isVideo) return '🎬';
    return '📎';
  };

  // Handle encrypted file download
  const handleDownload = async () => {
    if (!message.fileUrl) return;
    
    setIsDownloading(true);
    
    try {
      let blob: Blob;
      
      // Check if file is encrypted
      if (message.isEncrypted && message.encryptionKey) {
        setIsDecrypting(true);
        try {
          blob = await downloadAndDecryptFile(message.fileUrl, message.encryptionKey);
          setIsDecrypting(false);
        } catch (error) {
          console.error('Failed to decrypt file:', error);
          setIsDecrypting(false);
          setIsDownloading(false);
          alert('Failed to decrypt file. Please try again.');
          return;
        }
      } else {
        // Regular download
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Download failed: ${response.status}`);
        }
        blob = await response.blob();
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = message.fileName || 'download';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setIsDownloading(false);
      }, 100);
      
    } catch (error) {
      console.error('Download failed:', error);
      setIsDownloading(false);
      setIsDecrypting(false);
      alert('Failed to download file. Please try again.');
    }
  };

  // Render encrypted file indicator
  const renderEncryptionIndicator = () => {
    if (message.isEncrypted) {
      return (
        <div className="flex items-center gap-1 text-xs mb-2">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-green-700 dark:text-green-300">End-to-end encrypted</span>
        </div>
      );
    }
    return null;
  };

  const renderPreview = () => {
    // Show encrypted indicator for encrypted files
    if (message.isEncrypted && message.encryptedContent) {
      return (
        <div className={`p-4 rounded-lg ${isOwnMessage ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
          {renderEncryptionIndicator()}
          <div className="flex items-center gap-3">
            <div className="text-2xl">{getFileIcon()}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {message.fileName || 'Encrypted file'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Encrypted • {formatFileSize(message.fileSize)}
              </p>
            </div>
            <button
              onClick={handleDownload}
              disabled={isDownloading || isDecrypting}
              className={`p-2 rounded-full hover:bg-opacity-20 transition-colors ${isOwnMessage ? 'text-white hover:bg-white' : 'text-primary-600 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              title="Download file"
            >
              {isDecrypting ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isDownloading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
            </button>
          </div>
          {isDecrypting && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Decrypting...
            </div>
          )}
        </div>
      );
    }

    if (isImage && !imageError) {
      return (
        <div className="relative group cursor-pointer" onClick={() => window.open(fileUrl, '_blank')}>
          {renderEncryptionIndicator()}
          <img
            src={fileUrl}
            alt={message.fileName || 'Image'}
            className="max-w-full max-h-96 rounded-lg"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="text-white text-sm bg-black bg-opacity-50 px-3 py-2 rounded-lg">
              Click to view full size
            </span>
          </div>
        </div>
      );
    }

    if (isVideo && !videoError) {
      return (
        <div className="relative">
          {renderEncryptionIndicator()}
          <video
            controls
            className="max-w-full max-h-96 rounded-lg"
            onError={() => setVideoError(true)}
          >
            <source src={fileUrl} type="video/mp4" />
            <source src={fileUrl} type="video/webm" />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (isAudio) {
      return (
        <div className={`rounded-lg p-4 ${isOwnMessage ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
          {renderEncryptionIndicator()}
          <audio controls className="w-full">
            <source src={fileUrl} type="audio/mpeg" />
            <source src={fileUrl} type="audio/wav" />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    // Generic file display
    return (
      <div className={`flex items-center gap-3 p-4 rounded-lg hover:opacity-90 transition-colors ${
        isOwnMessage 
          ? 'bg-white/20 text-white' 
          : 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
      }`}>
        {renderEncryptionIndicator()}
        <div className="text-2xl">{getFileIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {message.fileName || 'Download file'}
          </p>
          <p className={`text-sm ${isOwnMessage ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
            {formatFileSize(message.fileSize)}
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className={`p-2 rounded-full hover:bg-opacity-20 transition-colors ${isOwnMessage ? 'text-white hover:bg-white' : 'text-primary-600 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          title="Download file"
        >
          {isDownloading ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="mt-2">
      {renderPreview()}
      
      {/* Show encrypted content indicator */}
      {message.isEncrypted && message.encryptedContent && !message.fileUrl && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Encrypted message</span>
        </div>
      )}
      
      {/* Show message content if different from file name */}
      {message.content && message.content !== message.fileName && (
        <p className={`mt-2 ${isOwnMessage ? 'text-white/90' : 'text-gray-700 dark:text-gray-300'}`}>
          {message.content}
        </p>
      )}
      
      {/* Show file info */}
      {message.fileName && (
        <p className={`text-xs mt-1 ${isOwnMessage ? 'text-white/70' : 'text-gray-500'}`}>
          {message.fileName} • {formatFileSize(message.fileSize)}
        </p>
      )}
      
      {/* Show downloading/decrypting status */}
      {(isDownloading || isDecrypting) && (
        <div className="flex items-center gap-2 text-xs mt-2">
          <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600 dark:text-gray-400">
            {isDecrypting ? 'Decrypting...' : 'Downloading...'}
          </span>
        </div>
      )}
    </div>
  );
};

export default FileMessage;