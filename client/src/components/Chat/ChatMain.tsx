// components/Chat/ChatMain.tsx
import React from 'react';
import { useChat } from '../../contexts/ChatContext';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

const ChatMain: React.FC = () => {
  const { currentRoom } = useChat();

  if (!currentRoom) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 flex items-center justify-center mb-6 mx-auto">
              <svg className="w-12 h-12 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">Welcome to ChatApp</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Select a conversation from the sidebar or create a new one to start messaging.
              You can share files, images, and have real-time conversations with emojis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {currentRoom.isBotRoom && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-b border-gray-200 dark:border-gray-700 text-sm text-slate-700 dark:text-slate-300">
          <strong className="font-semibold">AI Assistant</strong> is available in this room. Messages here are not end-to-end encrypted, so the assistant can read and respond to your chat.
        </div>
      )}

      {/* Message List - Takes available space */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MessageList />
      </div>
      
      {/* Message Input - Fixed at bottom with emoji support */}
      <div className="flex-shrink-0">
        <MessageInput />
      </div>
    </div>
  );
};

export default ChatMain;