import React, { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

const FACE_EMOJIS = [
  '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊',
  '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗',
  '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥',
  '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝',
  '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁',
  '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩',
  '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '🥴',
  '😠', '😡', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇',
  '🥳', '🥺', '🤠', '🤡', '🤥', '🤫', '🤭', '🧐', '🤓', '😈',
  '👿', '💀', '☠️', '💩', '🤖', '👹', '👺', '👻', '👽', '👾',
  '🤴', '👸', '🦸', '🦹', '🧙', '🧛', '🧝', '🧞', '🧟', '🧚'
];

const EmojiPicker: React.FC<{ 
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ onEmojiSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const emojiGridRef = useRef<HTMLDivElement>(null);

  // Filter emojis based on search
  const filteredEmojis = FACE_EMOJIS.filter(emoji => {
    return searchTerm === '' || emoji.includes(searchTerm);
  });

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
  };

  // Focus on search input when picker opens
  useEffect(() => {
    const searchInput = pickerRef.current?.querySelector('input[type="text"]');
    if (searchInput) {
      (searchInput as HTMLInputElement).focus();
    }
  }, []);

  return (
    <div 
      ref={pickerRef}
      className="absolute bottom-full mb-2 left-0 w-80 h-[420px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden backdrop-blur-lg bg-white/95 dark:bg-gray-800/95 flex flex-col"
      style={{ transform: 'translateY(-10px)' }}
    >
      {/* Header with close button */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Face Emojis ({filteredEmojis.length})</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Close emoji picker"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search faces..."
            className="w-full px-4 py-2.5 pl-10 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <svg 
            className="absolute left-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Emoji Grid */}
      <div 
        ref={emojiGridRef}
        className="flex-1 p-3 overflow-y-auto custom-scrollbar min-h-0"
      >
        {filteredEmojis.length > 0 ? (
          <div className="grid grid-cols-8 gap-1 auto-rows-min">
            {filteredEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => handleEmojiClick(emoji)}
                className="w-10 h-10 flex items-center justify-center text-2xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95 transform"
                title="Click to add"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <span className="text-4xl mb-2">😕</span>
            <p className="text-sm">No matching faces found</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{filteredEmojis.length} faces</span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Scroll to see more
          </span>
        </div>
      </div>
    </div>
  );
};

const MessageInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { sendMessage, currentRoom, startTyping, stopTyping } = useChat();
  const { user } = useAuth();
  const { socket } = useSocket();

  // Reset when room changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
    setShowEmojiPicker(false);
  }, [currentRoom?._id]);

  // Quick access emojis
  const quickEmojis = ['😀', '😂', '😍', '😊', '🥰', '😎', '🤔', '😭', '😡', '🥺'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || !currentRoom || !socket) return;
    
    await sendMessage(message);
    setMessage('');
    setUploadError(null);
    
    // Reset textarea height immediately
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
    
    // Don't close emoji picker on send
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // Handle typing indicators
    if (value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
    
    // Debounced textarea resizing
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      if (textareaRef.current) {
        // Reset height to auto first to get correct scrollHeight
        textareaRef.current.style.height = 'auto';
        const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
        textareaRef.current.style.height = `${newHeight}px`;
      }
    }, 16); // ~1 frame at 60fps
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  const handleFileClick = () => {
    fileInputRef.current?.click();
    // Don't close emoji picker when clicking file button
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentRoom || !socket || !user) {
      setUploadError('Setup incomplete. Please try again.');
      return;
    }

    setUploadError(null);
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File size too large. Maximum size is 10MB.');
      e.target.value = '';
      return;
    }

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

    if (!allowedTypes.includes(file.type)) {
      setUploadError('File type not supported. Please upload an image, PDF, document, audio, or video file.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const apiUrl = process.env.REACT_APP_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      const response = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Upload failed with status ${response.status}`);
      }

      const fileData = data.file;

      socket.emit('send-message', {
        roomId: currentRoom._id,
        content: `Shared a ${fileData.type}: ${fileData.originalName}`,
        type: fileData.type,
        fileUrl: fileData.url,
        fileName: fileData.originalName,
        fileSize: fileData.fileSize,
      }, (response: any) => {
        if (response?.success) {
          setUploadError(null);
        } else {
          setUploadError('File uploaded but message failed to send. Please try again.');
        }
      });
      
    } catch (error: any) {
      setUploadError(error.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMessage = message.substring(0, start) + emoji + message.substring(end);
    
    setMessage(newMessage);
    
    // Resize after emoji insertion
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      startTyping();
      
      // Resize textarea after emoji is inserted
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${newHeight}px`;
    }, 0);
  };

  const handleQuickEmojiClick = (emoji: string) => {
    setMessage(prev => prev + emoji);
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      startTyping();
      
      // Resize after quick emoji
      setTimeout(() => {
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 120);
        textarea.style.height = `${newHeight}px`;
      }, 10);
    }
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  // Close emoji picker ONLY when clicking outside the entire picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isOutsidePicker = !containerRef.current?.contains(event.target as Node);
      const isEmojiButton = emojiButtonRef.current?.contains(event.target as Node);
      
      if (showEmojiPicker && isOutsidePicker && !isEmojiButton) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  if (!currentRoom) {
    return (
      <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 text-center text-gray-500 dark:text-gray-400">
        Select a chat to start messaging
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Emoji Picker - Positioned above the input area */}
      {showEmojiPicker && (
        <div className="absolute bottom-full mb-2 left-4 z-50">
          <EmojiPicker 
            onEmojiSelect={handleEmojiSelect} 
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        {/* Quick Emoji Bar */}
        <div className="flex items-center gap-1 px-4 pt-3 overflow-x-auto pb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium mr-2 whitespace-nowrap">
            Quick faces:
          </span>
          {quickEmojis.map((emoji, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleQuickEmojiClick(emoji)}
              disabled={isUploading}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              title={`Add ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Error message display */}
        {uploadError && (
          <div className="mx-4 mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-start justify-between">
            <span>{uploadError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="ml-2 text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 p-4 pt-0">
          {/* Attachments Button */}
          <button
            type="button"
            onClick={handleFileClick}
            disabled={isUploading}
            className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
              isUploading 
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-105'
            }`}
            title={isUploading ? "Uploading..." : "Attach file"}
          >
            {isUploading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt,audio/*,video/*"
            disabled={isUploading}
          />

          {/* Emoji Button */}
          <div className="relative">
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={toggleEmojiPicker}
              disabled={isUploading}
              className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
                showEmojiPicker
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-105'
              } disabled:opacity-50`}
              title={showEmojiPicker ? "Close emoji picker" : "Open emoji picker"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          {/* Message Input - Optimized for smooth resizing */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setIsFocused(true);
              }}
              onBlur={() => setIsFocused(false)}
              placeholder={`Message ${currentRoom.name}...`}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white disabled:opacity-50 transition-[height] duration-150 ease-out"
              style={{ 
                minHeight: '44px',
                maxHeight: '120px',
                overflow: 'hidden',
                lineHeight: '1.4',
              }}
              disabled={isUploading}
              rows={1}
            />
            
            {/* Character counter */}
            {message.length > 1500 && (
              <div className="absolute bottom-2 right-3 text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {message.length}/2000
              </div>
            )}
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!message.trim() || isUploading}
            className={`
              flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200
              ${!isUploading && message.trim()
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:shadow-lg hover:scale-105 active:scale-95'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }
            `}
            title={isUploading ? "Uploading file..." : "Send message"}
          >
            {isUploading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        
        
      </form>
    </div>
  );
};

export default MessageInput;