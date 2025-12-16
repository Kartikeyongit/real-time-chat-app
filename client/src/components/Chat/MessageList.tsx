import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import FileMessage from './FileMessage';
import MessageSkeleton from './MessageSkeleton';

const MessageList: React.FC = () => {
  const { 
    messages, 
    isLoadingMessages, 
    hasMoreMessages, 
    fetchMessages, 
    typingUsers, 
    currentRoom, 
    deleteMessage 
  } = useChat();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Memoize grouped messages
  const { groupedMessages, dateHeaders } = useMemo(() => {
    if (!messages.length) return { groupedMessages: {}, dateHeaders: [] };

    const groups: { [key: string]: any[] } = {};
    const headers: string[] = [];

    messages.forEach((message) => {
      const date = new Date(message.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
        headers.push(date);
      }
      groups[date].push(message);
    });

    return { groupedMessages: groups, dateHeaders: headers };
  }, [messages]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAutoScroll(isNearBottom);
    
    // Load more messages when scrolling near top
    if (scrollTop < 100 && hasMoreMessages && !isLoadingMessages) {
      fetchMessages(true);
    }
  }, [hasMoreMessages, isLoadingMessages, fetchMessages]);

  // Setup scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Auto-scroll to bottom on new messages when at bottom
  useEffect(() => {
    if (isAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Reset auto-scroll when messages count increases (new message)
    if (messages.length > prevMessageCountRef.current && !isAutoScroll) {
      const container = containerRef.current;
      if (container) {
        const { scrollHeight, clientHeight } = container;
        // If user is within 200px of bottom, auto-scroll them down
        if (scrollHeight - container.scrollTop - clientHeight < 200) {
          setIsAutoScroll(true);
        }
      }
    }
    
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isAutoScroll]);

  // Initial scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current && !isLoadingMessages) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    }
  }, [currentRoom?._id, isLoadingMessages]);

  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString([], { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Handle message deletion
  const handleDeleteMessage = async (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(messageId);
    try {
      await deleteMessage(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message. Please try again.');
    } finally {
      setIsDeleting(null);
      setHoveredMessageId(null);
    }
  };

  // Render message content based on type
  const renderMessageContent = (message: any, isOwnMessage: boolean) => {
    switch (message.type) {
      case 'image':
      case 'file':
      case 'audio':
      case 'video':
        return <FileMessage message={message} isOwnMessage={isOwnMessage} />;
      case 'system':
        return (
          <div className="text-center py-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
              {message.content}
            </span>
          </div>
        );
      default:
        return (
          <p className={`whitespace-pre-wrap break-words ${isOwnMessage ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-gray-100'}`}>
            {message.content}
          </p>
        );
    }
  };

  // Check if message can be deleted (user is sender and within time limit)
  const canDeleteMessage = (message: any) => {
    if (!user || message.sender._id !== user._id) return false;
    
    // Allow deletion within 15 minutes (900000 ms)
    const messageTime = new Date(message.createdAt).getTime();
    const currentTime = new Date().getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    
    return (currentTime - messageTime) <= fifteenMinutes;
  };

  if (!currentRoom) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 flex items-center justify-center mb-6">
          <svg className="w-12 h-12 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">Select a Chat</h3>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
          Choose a conversation from the sidebar or create a new one to start messaging.
        </p>
      </div>
    );
  }

  if (isLoadingMessages && messages.length === 0) {
    return (
      <div className="h-full">
        <MessageSkeleton />
      </div>
    );
  }

  const getReadStatusTitle = (message: any, room: any, currentUser: any) => {
    const otherMembers = room?.members?.filter((m: any) => m._id !== currentUser?._id) || [];
    const readByOthers = (message.readBy || []).filter((id: string) => id !== currentUser?._id);
  
    if (readByOthers.length === 0) return 'Sent';
    if (readByOthers.length === otherMembers.length) return 'Read by everyone';
    return `Read by ${readByOthers.length} of ${otherMembers.length}`;
  };

  const renderReadReceipts = (message: any, room: any, currentUser: any) => {
    const otherMembers = room?.members?.filter((m: any) => m._id !== currentUser?._id) || [];
    const readByOthers = (message.readBy || []).filter((id: string) => id !== currentUser?._id);
  
    if (readByOthers.length === 0) {
      // Single grey check for sent
      return (
        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    } else if (readByOthers.length < otherMembers.length) {
      // Double grey checks for delivered but not read by all
      return (
        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.37.29a1.49,1.49,0,0,0-2.09.34L7.25,20.2,2.56,15.51A1.5,1.5,0,0,0,.15,17.92l5.93,5.94a1.53,1.53,0,0,0,2.28-.19l15.07-21A1.49,1.49,0,0,0,23.37.29Z" />
          <path d="M14.67,1.63a1.5,1.5,0,0,0-2.08.36L4.08,13.71a1.5,1.5,0,1,0,2.44,1.74l8-11.22,7.57,10.63a1.5,1.5,0,0,0,2.44-1.74L16.81,1.94A1.5,1.5,0,0,0,14.67,1.63Z" opacity="0.4" />
        </svg>
      );
    } else {
      // Double blue checks for read by all
      return (
        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.37.29a1.49,1.49,0,0,0-2.09.34L7.25,20.2,2.56,15.51A1.5,1.5,0,0,0,.15,17.92l5.93,5.94a1.53,1.53,0,0,0,2.28-.19l15.07-21A1.49,1.49,0,0,0,23.37.29Z" />
          <path d="M14.67,1.63a1.5,1.5,0,0,0-2.08.36L4.08,13.71a1.5,1.5,0,1,0,2.44,1.74l8-11.22,7.57,10.63a1.5,1.5,0,0,0,2.44-1.74L16.81,1.94A1.5,1.5,0,0,0,14.67,1.63Z" />
        </svg>
      );
    }
  };

  return (
    <div 
      ref={containerRef}
      className="h-full overflow-y-auto custom-scrollbar bg-gradient-to-b from-gray-50/30 to-transparent dark:from-gray-900/30 dark:to-transparent"
    >
      {/* Load More Button - Sticky at top */}
      {hasMoreMessages && (
        <div className="sticky top-0 z-10 flex justify-center py-3 bg-gradient-to-b from-white/80 dark:from-gray-900/80 to-transparent backdrop-blur-sm">
          <button
            onClick={() => fetchMessages(true)}
            disabled={isLoadingMessages}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:shadow-md transition-shadow disabled:opacity-50"
          >
            {isLoadingMessages ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-400 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
                Loading older messages...
              </span>
            ) : 'Load older messages'}
          </button>
        </div>
      )}

      {/* Messages Container - Normal flow */}
      <div className="p-4 md:p-6 space-y-6">
        {dateHeaders.map((date) => (
          <div key={date} className="space-y-4">
            {/* Date Header */}
            <div className="flex justify-center">
              <div className="px-4 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400 shadow-sm">
                {formatMessageDate(groupedMessages[date][0].createdAt)}
              </div>
            </div>
            
            {/* Messages for this date */}
            <div className="space-y-4">
              {groupedMessages[date].map((message) => {
                const isOwnMessage = message.sender._id === user?._id;
                const isSystemMessage = message.type === 'system';
                const canDelete = canDeleteMessage(message);
                
                if (isSystemMessage) {
                  return (
                    <div key={message._id} className="flex justify-center">
                      {renderMessageContent(message, false)}
                    </div>
                  );
                }

                return (
                  <div
                    key={message._id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    onMouseEnter={() => setHoveredMessageId(message._id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                  >
                    {/* Avatar for other users */}
                    {!isOwnMessage && (
                      <div className="flex-shrink-0 mr-3 mt-1">
                        {message.sender.avatar ? (
                          <img
                            src={message.sender.avatar}
                            alt={message.sender.username}
                            className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-gray-800"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                            <span className="text-white text-xs font-bold">
                              {message.sender.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Message Content */}
                    <div className={`relative max-w-[85%] lg:max-w-[75%] ${isOwnMessage ? 'order-1' : 'order-2'}`}>
                      {/* Delete Button (only shows on hover for own messages) */}
                      {isOwnMessage && canDelete && hoveredMessageId === message._id && (
                        <button
                          onClick={(e) => handleDeleteMessage(message._id, e)}
                          disabled={isDeleting === message._id}
                          className="absolute -top-2 -right-2 z-10 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg disabled:opacity-50"
                          title="Delete message"
                        >
                          {isDeleting === message._id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      )}

                      {/* Sender Name */}
                      {!isOwnMessage && (
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ml-1">
                          {message.sender.username}
                        </div>
                      )}
                      
                      {/* Message Bubble */}
                      <div
                        className={`relative rounded-2xl px-4 py-3 ${
                          isOwnMessage
                            ? 'bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-700 dark:to-primary-800 text-gray-900 dark:text-white rounded-br-sm shadow-lg border border-primary-200 dark:border-primary-600'
                            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-sm shadow-sm'
                        }`}
                      >
                        {/* Deleted message indicator */}
                        {message.deleted && (
                          <div className="flex items-center gap-2 italic text-black dark:text-white/80">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>This message was deleted</span>
                          </div>
                        )}
                        
                        {/* Original message content (if not deleted) */}
                        {!message.deleted && renderMessageContent(message, isOwnMessage)}
                      </div>
                      
                      {/* Message Meta */}
                      <div className={`flex items-center mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-xs ${isOwnMessage ? 'text-gray-600 dark:text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                          {formatMessageTime(message.createdAt)}
                        </span>
                        {isOwnMessage && !message.deleted && (
                          <span className="ml-2 flex items-center" title={getReadStatusTitle(message, currentRoom, user)}>
                            {renderReadReceipts(message, currentRoom, user)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="flex animate-fade-in">
            <div className="flex-shrink-0 mr-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {typingUsers[0].username.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-none px-4 py-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor for auto-scrolling */}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Scroll to bottom button when not auto-scrolling */}
      {!isAutoScroll && (
        <button
          onClick={() => {
            setIsAutoScroll(true);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="sticky bottom-4 left-1/2 transform -translate-x-1/2 z-20 p-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
          title="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default MessageList;