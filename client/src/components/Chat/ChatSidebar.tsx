import React, { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import DarkModeToggle from '../Common/DarkModeToggle';

const ChatSidebar: React.FC = () => {
  const { 
    rooms, 
    currentRoom, 
    isLoadingRooms, 
    selectRoom, 
    setShowNewRoomModal 
  } = useChat();
  const { user, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
  
    try {
      const date = new Date(dateString);
    
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '';
      }
    
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffHours < 48) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      return '';
    }
  };

  // Helper function to check if a message is deleted (safe check)
  const isMessageDeleted = (message: any): boolean => {
    return !!message?.deleted;
  };

  // Helper function to get message type (safe check)
  const getMessageType = (message: any): string => {
    return message?.type || 'text';
  };

  // Helper function to render last message content with deletion handling
  const renderLastMessageContent = (room: any) => {
    if (!room.lastMessage) {
      return <p className="text-sm text-gray-500 dark:text-gray-500 italic mt-1">No messages yet</p>;
    }

    const { lastMessage } = room;
    
    // Check if message is deleted
    if (isMessageDeleted(lastMessage)) {
      return (
        <div className="flex items-center gap-2 mt-1">
          <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <p className="text-sm text-gray-400 dark:text-gray-500 italic truncate">
            Message deleted
          </p>
        </div>
      );
    }

    // Handle file messages
    const messageType = getMessageType(lastMessage);
    if (messageType !== 'text') {
      let fileType = '';
      let icon = '';
      
      switch (messageType) {
        case 'image':
          fileType = 'Image';
          icon = '🖼️';
          break;
        case 'file':
          fileType = 'File';
          icon = '📎';
          break;
        case 'audio':
          fileType = 'Audio';
          icon = '🎵';
          break;
        case 'video':
          fileType = 'Video';
          icon = '🎬';
          break;
        default:
          fileType = 'File';
          icon = '📎';
      }
      
      return (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm">{icon}</span>
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {lastMessage.sender?.username || 'Unknown'}:
            </span>{' '}
            Sent a {fileType}
          </p>
        </div>
      );
    }

    // Regular text message
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {lastMessage.sender?.username || 'Unknown'}:
        </span>{' '}
        {lastMessage.content || ''}
      </p>
    );
  };

  // Helper function to get room online count
  const getOnlineCount = (room: any) => {
    return room.members?.filter((member: any) => member.online).length || 0;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-10 h-10 rounded-xl"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{user?.username}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <DarkModeToggle />
            <button
              onClick={logout}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search - Fixed dark mode */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
          />
          <div className="absolute left-3 top-2.5">
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* New Chat Button - Fixed dark mode */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setShowNewRoomModal(true)}
          className="w-full py-3 bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-xl font-medium flex items-center justify-center space-x-2 hover:shadow-lg transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Chat</span>
        </button>
      </div>

      {/* Rooms List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingRooms ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 p-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-center">No chats found</p>
            <button
              onClick={() => setShowNewRoomModal(true)}
              className="mt-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium text-sm"
            >
              Start a conversation
            </button>
          </div>
        ) : (
          <div className="p-2">
            <div className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Recent Chats ({filteredRooms.length})
            </div>
            {filteredRooms.map((room) => (
              <button
                key={room._id}
                onClick={() => selectRoom(room._id)}
                className={`w-full p-3 rounded-xl mb-2 text-left transition-all duration-200 ${
                  currentRoom?._id === room._id
                    ? 'bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border border-primary-200 dark:border-primary-700 shadow-sm'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="relative">
                    <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center
                      ${room.isPrivate 
                        ? 'bg-gradient-to-br from-purple-500 to-purple-600' 
                        : 'bg-gradient-to-br from-primary-500 to-blue-600'
                      }
                    `}>
                      {room.isPrivate ? (
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      )}
                    </div>
                    
                    {/* Online indicator - show count instead of single dot */}
                    {getOnlineCount(room) > 0 && (
                      <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900">
                        <span className="text-[10px] font-bold text-white">
                          {getOnlineCount(room)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                        {room.name}
                        {room.isPrivate && (
                          <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full flex-shrink-0">
                            Private
                          </span>
                        )}
                      </h4>
                      {room.lastMessage && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2 flex-shrink-0">
                          {formatTime(room.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    
                    {/* Last message content with deletion handling */}
                    {renderLastMessageContent(room)}
                    
                    {/* Members preview */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex -space-x-2">
                        {room.members?.slice(0, 3).map((member: any, index: number) => (
                          <div key={member._id || index} className="relative">
                            {member.avatar ? (
                              <img
                                src={member.avatar}
                                alt={member.username}
                                className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {member.username?.charAt(0).toUpperCase() || '?'}
                                </span>
                              </div>
                            )}
                            {member.online && (
                              <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-green-500 rounded-full border border-white dark:border-gray-900"></div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {room.members && room.members.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            +{room.members.length - 3} more
                          </span>
                        )}
                        {/* Safe check for deleted message */}
                        {room.lastMessage && isMessageDeleted(room.lastMessage) && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Connected</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">ChatApp v1.0 • Real-time</p>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;