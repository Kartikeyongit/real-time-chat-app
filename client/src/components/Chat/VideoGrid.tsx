import React, { useEffect, useRef } from 'react';
import { FaUser, FaMicrophoneSlash, FaVideoSlash } from 'react-icons/fa';

interface VideoParticipant {
  userId: string;
  username: string;
  avatar?: string;
  stream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

interface VideoGridProps {
  participants: VideoParticipant[];
  localStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

const VideoGrid: React.FC<VideoGridProps> = ({
  participants,
  localStream,
  isMuted,
  isCameraOff,
  isScreenSharing,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const allParticipants = [
    {
      userId: 'local',
      username: 'You',
      stream: localStream,
      isMuted,
      isCameraOff,
      isScreenSharing: false,
    },
    ...participants,
  ];

  const gridClass = () => {
    const count = allParticipants.length;
    if (count <= 2) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
  };

  return (
    <div className="relative h-full w-full bg-gray-900 p-4">
      <div ref={gridRef} className={`grid ${gridClass()} gap-4 h-full`}>
        {allParticipants.map((participant, index) => (
          <div
            key={participant.userId}
            className={`relative rounded-lg overflow-hidden bg-gray-800 ${
              participant.userId === 'local' ? 'border-2 border-blue-500' : ''
            }`}
          >
            {/* Video/Audio Element */}
            {participant.stream ? (
              <video
                ref={participant.userId === 'local' ? localVideoRef : undefined}
                autoPlay
                playsInline
                muted={participant.userId === 'local'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                {participant.avatar ? (
                  <img
                    src={participant.avatar}
                    alt={participant.username}
                    className="w-32 h-32 rounded-full object-cover"
                  />
                ) : (
                  <FaUser className="w-24 h-24 text-gray-400" />
                )}
              </div>
            )}

            {/* Participant Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-white font-semibold">
                    {participant.username}
                    {participant.userId === 'local' && ' (You)'}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {participant.isMuted && (
                    <FaMicrophoneSlash className="w-4 h-4 text-red-400" />
                  )}
                  {participant.isCameraOff && (
                    <FaVideoSlash className="w-4 h-4 text-red-400" />
                  )}
                  {participant.isScreenSharing && (
                    <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded">
                      Screen
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Screen sharing indicator */}
            {participant.isScreenSharing && (
              <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                Screen Sharing
              </div>
            )}

            {/* Connection indicator */}
            {participant.userId !== 'local' && (
              <div className="absolute top-2 right-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Grid layout helper */}
      {allParticipants.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <FaUser className="w-24 h-24 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Waiting for participants to join...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoGrid;