import React, { useState } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useCall } from '../../contexts/CallContext';
import { useAuth } from '../../contexts/AuthContext';
import { FaPhone, FaVideo, FaEllipsisV, FaUserPlus, FaSearch, FaUsers } from 'react-icons/fa';

const ChatHeader: React.FC = () => {
  const { currentRoom, toggleSidebar, setShowUserSearchModal } = useChat();
  const { startCall, isInCall } = useCall();
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  const handleStartAudioCall = async () => {
    if (!currentRoom || !user) return;
    
    try {
      // Get all participant IDs except current user
      const participants = currentRoom.members
        .filter(member => member._id !== user._id)
        .map(member => member._id);
      
      if (participants.length === 0) {
        console.log('No other participants in the room');
        return;
      }
      
      await startCall(currentRoom._id, 'audio', participants);
    } catch (error) {
      console.error('Error starting audio call:', error);
    }
  };

  const handleStartVideoCall = async () => {
    if (!currentRoom || !user) return;
    
    try {
      // Get all participant IDs except current user
      const participants = currentRoom.members
        .filter(member => member._id !== user._id)
        .map(member => member._id);
      
      if (participants.length === 0) {
        console.log('No other participants in the room');
        return;
      }
      
      await startCall(currentRoom._id, 'video', participants);
    } catch (error) {
      console.error('Error starting video call:', error);
    }
  };

  if (!currentRoom) {
    return (
      <div className="h-16 px-6 flex items-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-white/20 dark:border-gray-700/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-300">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 mr-3 hover:bg-white/40 dark:hover:bg-gray-800/60 backdrop-blur-sm rounded-xl transition-all duration-200"
          aria-label="Toggle sidebar"
        >
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 bg-clip-text bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300">
            Select a chat
          </h2>
          <p className="text-sm text-gray-600/80 dark:text-gray-400/80">Choose a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  const onlineMembers = currentRoom.members.filter(member => member.online).length;

  return (
    <div className="h-16 px-6 flex items-center justify-between bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-white/20 dark:border-gray-700/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] transition-all duration-300">
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 mr-3 hover:bg-white/40 dark:hover:bg-gray-800/60 backdrop-blur-sm rounded-xl transition-all duration-200"
          aria-label="Toggle sidebar"
        >
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <div className="flex items-center space-x-4">
          {/* Room Avatar with Glass Effect */}
          <div className="relative">
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center
              ${currentRoom.isPrivate 
                ? 'bg-gradient-to-br from-purple-500/90 to-purple-600/90 backdrop-blur-sm' 
                : 'bg-gradient-to-br from-blue-500/90 to-blue-600/90 backdrop-blur-sm'
              }
              shadow-lg shadow-black/10 dark:shadow-black/30
              border border-white/30 dark:border-white/10
            `}>
              {currentRoom.isPrivate ? (
                <svg className="w-6 h-6 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )}
            </div>
            {onlineMembers > 0 && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white/80 dark:border-gray-900/80 shadow-sm"></div>
            )}
          </div>

          {/* Room Info */}
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 bg-clip-text bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300">
                {currentRoom.name}
              </h2>
              {currentRoom.isPrivate && (
                <span className="text-xs bg-purple-100/70 dark:bg-purple-900/40 backdrop-blur-sm text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200/50 dark:border-purple-800/30">
                  Private
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3 text-sm text-gray-600/90 dark:text-gray-400/90">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 shadow-sm"></div>
                <span>{onlineMembers} online</span>
              </div>
              <div className="w-1 h-1 bg-gray-400/50 dark:bg-gray-600/50 rounded-full"></div>
              <span>{currentRoom.members.length} members</span>
              {currentRoom.description && (
                <>
                  <div className="w-1 h-1 bg-gray-400/50 dark:bg-gray-600/50 rounded-full"></div>
                  <span className="truncate max-w-xs">{currentRoom.description}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions with Enhanced Glass Effect */}
      <div className="flex items-center space-x-1">
        {/* Audio Call Button */}
        <button
          onClick={handleStartAudioCall}
          disabled={isInCall || onlineMembers === 0}
          className={`p-2 rounded-xl transition-all duration-200 group ${
            isInCall || onlineMembers === 0
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-white/40 dark:hover:bg-gray-800/60 backdrop-blur-sm'
          }`}
          title={onlineMembers === 0 ? "No online users to call" : "Start audio call"}
          aria-label="Start audio call"
        >
          <FaPhone className={`w-5 h-5 transition-colors ${
            isInCall || onlineMembers === 0
              ? 'text-gray-400 dark:text-gray-500'
              : 'text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100'
          }`} />
        </button>

        {/* Video Call Button */}
        <button
          onClick={handleStartVideoCall}
          disabled={isInCall || onlineMembers === 0}
          className={`p-2 rounded-xl transition-all duration-200 group ${
            isInCall || onlineMembers === 0
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-white/40 dark:hover:bg-gray-800/60 backdrop-blur-sm'
          }`}
          title={onlineMembers === 0 ? "No online users to call" : "Start video call"}
          aria-label="Start video call"
        >
          <FaVideo className={`w-5 h-5 transition-colors ${
            isInCall || onlineMembers === 0
              ? 'text-gray-400 dark:text-gray-500'
              : 'text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100'
          }`} />
        </button>

        {/* Search Button */}
        <button
          onClick={() => console.log('Search')}
          className="p-2 hover:bg-white/40 dark:hover:bg-gray-800/60 backdrop-blur-sm rounded-xl transition-all duration-200 group"
          title="Search"
          aria-label="Search"
        >
          <FaSearch className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors" />
        </button>

        {/* Add Members Button */}
        <button
          onClick={() => setShowUserSearchModal(true)}
          className="p-2 hover:bg-white/40 dark:hover:bg-gray-800/60 backdrop-blur-sm rounded-xl transition-all duration-200 group"
          title="Add members"
          aria-label="Add members"
        >
          <FaUsers className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors" />
        </button>

        {/* Menu Button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-white/40 dark:hover:bg-gray-800/60 backdrop-blur-sm rounded-xl transition-all duration-200 group"
            title="Room options"
            aria-label="Room options"
          >
            <FaEllipsisV className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg rounded-xl shadow-xl border border-white/20 dark:border-gray-700/30 py-1 z-10">
              <button className="block w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
                Room Settings
              </button>
              <button className="block w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
                Mute Notifications
              </button>
              <button className="block w-full text-left px-4 py-2 text-red-500 dark:text-red-400 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors">
                Leave Room
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;