import React, { useEffect, useRef, useState } from 'react';
import { FaPhoneSlash, FaPhone, FaVideo, FaUser, FaTimes } from 'react-icons/fa';

interface CallModalProps {
  isOpen: boolean;
  callType: 'video' | 'audio';
  callerName: string;
  callerAvatar?: string;
  onAccept: () => void;
  onReject: () => void;
}

const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  callType,
  callerName,
  callerAvatar,
  onAccept,
  onReject,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isOpen) {
      // Play ringtone
      if (audioRef.current) {
        audioRef.current.src = '/ringtone.mp3'; // Add a ringtone file to your public folder
        audioRef.current.loop = true;
        audioRef.current.play().catch(console.error);
      }

      // Start call duration timer
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <audio ref={audioRef} />
      
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          {/* Caller Info */}
          <div className="mb-6">
            <div className="relative w-32 h-32 mx-auto mb-4">
              {callerAvatar ? (
                <img
                  src={callerAvatar}
                  alt={callerName}
                  className="w-full h-full rounded-full object-cover border-4 border-blue-500"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-blue-500 flex items-center justify-center border-4 border-blue-400">
                  <FaUser className="w-16 h-16 text-white" />
                </div>
              )}
              
              {/* Call Type Indicator */}
              <div className="absolute -bottom-2 -right-2 bg-blue-600 rounded-full p-3">
                {callType === 'video' ? (
                  <FaVideo className="w-6 h-6 text-white" />
                ) : (
                  <FaPhone className="w-6 h-6 text-white" />
                )}
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">{callerName}</h2>
            <p className="text-gray-300">
              {callDuration > 0 
                ? formatDuration(callDuration)
                : `Incoming ${callType} call...`}
            </p>
          </div>

          {/* Call Controls */}
          <div className="flex justify-center space-x-8">
            {/* Accept Button */}
            <button
              onClick={onAccept}
              className="flex flex-col items-center group"
            >
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mb-2 group-hover:bg-green-600 transition-colors">
                {callType === 'video' ? (
                  <FaVideo className="w-8 h-8 text-white" />
                ) : (
                  <FaPhone className="w-8 h-8 text-white" />
                )}
              </div>
              <span className="text-gray-300 group-hover:text-white transition-colors">
                Accept
              </span>
            </button>

            {/* Reject Button */}
            <button
              onClick={onReject}
              className="flex flex-col items-center group"
            >
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mb-2 group-hover:bg-red-600 transition-colors">
                <FaPhoneSlash className="w-8 h-8 text-white" />
              </div>
              <span className="text-gray-300 group-hover:text-white transition-colors">
                Decline
              </span>
            </button>
          </div>

          {/* Close Button (for ongoing call) */}
          {callDuration > 0 && (
            <button
              onClick={onReject}
              className="mt-8 p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
              title="End call"
            >
              <FaTimes className="w-6 h-6 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;