import React from 'react';
import { ChatProvider } from '../contexts/ChatContext';
import { CallProvider } from '../contexts/CallContext';
import ChatSidebar from '../components/Chat/ChatSidebar';
import ChatMain from '../components/Chat/ChatMain';
import ChatHeader from '../components/Chat/ChatHeader';
import CallModal from '../components/Chat/CallModal';
import CallControls from '../components/Chat/CallControls';
import VideoGrid from '../components/Chat/VideoGrid';
import NewRoomModal from '../components/Modals/NewRoomModal';
import UserSearchModal from '../components/Modals/UserSearchModal';
import { useChat } from '../contexts/ChatContext';
import { useCall } from '../contexts/CallContext';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const ChatPageContent: React.FC = () => {
  const { 
    isSidebarOpen, 
    showNewRoomModal, 
    setShowNewRoomModal,
    showUserSearchModal,
    setShowUserSearchModal 
  } = useChat();
  
  const { isConnected } = useSocket();
  const { user } = useAuth();
  const {
    currentCall,
    localStream,
    remoteStreams,
    screenStream,
    isMuted,
    isCameraOff,
    isScreenSharing,
    isInCall,
    incomingCall,
    acceptCall,
    rejectCall,
    endCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    showCallModal,
    setShowCallModal,
  } = useCall();

  // Prepare participants for video grid
  const videoParticipants = currentCall.participants.map(participant => ({
    ...participant,
    stream: remoteStreams.get(participant.userId) || null,
  }));

  // Add local user to participants for display
  if (isInCall && user) {
    videoParticipants.unshift({
      userId: user._id,
      username: 'You',
      avatar: user.avatar,
      stream: localStream,
      isMuted,
      isCameraOff,
      isScreenSharing: false,
    });
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex flex-col relative overflow-hidden">
      {/* Connection Status */}
      {!isConnected && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center py-2 px-4 backdrop-blur-sm z-50">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Connecting to chat server...</span>
          </div>
        </div>
      )}

      {/* Call Modal for incoming calls */}
      <CallModal
        isOpen={showCallModal && incomingCall.isIncoming}
        callType={incomingCall.type || 'audio'}
        callerName={incomingCall.caller?.username || 'Unknown'}
        callerAvatar={incomingCall.caller?.avatar}
        onAccept={acceptCall}
        onReject={rejectCall}
      />

      {/* Video Call Interface */}
      {isInCall && currentCall.type === 'video' && (
        <div className="fixed inset-0 z-40 bg-gray-900 flex flex-col">
          <VideoGrid
            participants={videoParticipants.filter(p => p.userId !== user?._id)}
            localStream={localStream}
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isScreenSharing={isScreenSharing}
          />
          
          <CallControls
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isScreenSharing={isScreenSharing}
            isInCall={isInCall}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleScreenShare={toggleScreenShare}
            onEndCall={endCall}
            onLeaveCall={leaveCall}
            callType={currentCall.type || 'video'}
          />
        </div>
      )}

      {/* Audio Call Interface */}
      {isInCall && currentCall.type === 'audio' && (
        <div className="fixed inset-0 z-40 bg-gray-900 flex flex-col items-center justify-center">
          <div className="text-center mb-8">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl font-bold text-white">
                {currentCall.participants[0]?.username?.charAt(0) || 'A'}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Audio Call
            </h2>
            <p className="text-gray-400">
              {currentCall.participants.length + 1} participants
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* Local user */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-2">
                <span className="text-lg font-bold text-white">
                  You
                </span>
              </div>
              <p className="text-sm text-gray-300">
                You {isMuted && '(Muted)'}
              </p>
            </div>

            {/* Remote participants */}
            {currentCall.participants.map(participant => (
              <div key={participant.userId} className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-2">
                  <span className="text-lg font-bold text-white">
                    {participant.username?.charAt(0) || 'U'}
                  </span>
                </div>
                <p className="text-sm text-gray-300">
                  {participant.username}
                  {participant.isMuted && ' (Muted)'}
                </p>
              </div>
            ))}
          </div>

          <CallControls
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isScreenSharing={isScreenSharing}
            isInCall={isInCall}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleScreenShare={toggleScreenShare}
            onEndCall={endCall}
            onLeaveCall={leaveCall}
            callType="audio"
          />
        </div>
      )}

      {/* Chat Interface (hidden during video calls, visible for audio) */}
      <div className={`flex flex-1 ${isInCall && currentCall.type === 'video' ? 'hidden' : ''}`}>
        {/* Sidebar */}
        <div className={`
          ${isSidebarOpen ? 'block translate-x-0' : 'hidden -translate-x-full'} 
          md:block md:translate-x-0
          w-full md:w-80 
          bg-white dark:bg-gray-900
          border-r border-gray-200 dark:border-gray-800
          transition-all duration-300 ease-in-out
          shadow-xl
          z-20
          flex flex-col
          min-h-0
        `}>
          <ChatSidebar />
        </div>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 md:hidden z-10"
            onClick={() => {/* Add toggle function if needed */}}
          />
        )}

        {/* Main Chat Area - Fixed container */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 z-10">
            <ChatHeader />
          </div>
          
          {/* Scrollable Content Area */}
          <div className="flex-1 min-h-0 relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 to-gray-100/30 dark:from-gray-900/30 dark:to-gray-800/30 backdrop-blur-sm"></div>
            
            {/* Scrollable Chat Content */}
            <div className="absolute inset-0 overflow-hidden">
              <ChatMain />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <NewRoomModal
        isOpen={showNewRoomModal}
        onClose={() => setShowNewRoomModal(false)}
      />
      <UserSearchModal
        isOpen={showUserSearchModal}
        onClose={() => setShowUserSearchModal(false)}
      />
    </div>
  );
};

const ChatPage: React.FC = () => {
  return (
    <CallProvider>
      <ChatProvider>
        <ChatPageContent />
      </ChatProvider>
    </CallProvider>
  );
};

export default ChatPage;