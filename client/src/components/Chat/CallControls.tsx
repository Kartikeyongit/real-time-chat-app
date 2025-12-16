import React, { useState } from 'react';
import { FaPhone, FaVideo, FaMicrophone, FaMicrophoneSlash, FaVideoSlash, FaDesktop, FaStopCircle, FaTimes } from 'react-icons/fa';

interface CallControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isInCall: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
  onLeaveCall: () => void;
  callType: 'video' | 'audio';
}

const CallControls: React.FC<CallControlsProps> = ({
  isMuted,
  isCameraOff,
  isScreenSharing,
  isInCall,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
  onLeaveCall,
  callType,
}) => {
  const [showControls, setShowControls] = useState(true);

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
      <div className={`bg-gray-800/90 backdrop-blur-sm rounded-full px-6 py-4 flex items-center space-x-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Mute/Unmute Button */}
        <button
          onClick={onToggleMute}
          className={`p-3 rounded-full transition-all ${isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'}`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <FaMicrophoneSlash className="w-5 h-5 text-white" />
          ) : (
            <FaMicrophone className="w-5 h-5 text-white" />
          )}
        </button>

        {/* Camera Toggle (only for video calls) */}
        {callType === 'video' && (
          <button
            onClick={onToggleCamera}
            className={`p-3 rounded-full transition-all ${isCameraOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'}`}
            title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {isCameraOff ? (
              <FaVideoSlash className="w-5 h-5 text-white" />
            ) : (
              <FaVideo className="w-5 h-5 text-white" />
            )}
          </button>
        )}

        {/* Screen Share */}
        <button
          onClick={onToggleScreenShare}
          className={`p-3 rounded-full transition-all ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'}`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? (
            <FaStopCircle className="w-5 h-5 text-white" />
          ) : (
            <FaDesktop className="w-5 h-5 text-white" />
          )}
        </button>

        {/* End/Leave Call Button */}
        <button
          onClick={isInCall ? onEndCall : onLeaveCall}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-all"
          title={isInCall ? 'End call for everyone' : 'Leave call'}
        >
          <FaPhone className="w-5 h-5 text-white transform rotate-135" />
        </button>

        {/* Close Controls Button */}
        <button
          onClick={() => setShowControls(!showControls)}
          className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-all"
          title={showControls ? 'Hide controls' : 'Show controls'}
        >
          <FaTimes className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
};

export default CallControls;