import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { WebRTCService } from '../services/webrtc';

interface CallContextType {
  // Call state
  currentCall: {
    id: string | null;
    roomId: string | null;
    type: 'video' | 'audio' | null;
    participants: Array<{
      userId: string;
      username: string;
      avatar?: string;
      isMuted: boolean;
      isCameraOff: boolean;
      isScreenSharing: boolean;
    }>;
  };
  
  // Media state
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  screenStream: MediaStream | null;
  
  // Control state
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isInCall: boolean;
  
  // Incoming call
  incomingCall: {
    isIncoming: boolean;
    callId: string | null;
    roomId: string | null;
    type: 'video' | 'audio' | null;
    caller: {
      id: string;
      username: string;
      avatar?: string;
    } | null;
  };
  
  // Actions
  startCall: (roomId: string, type: 'video' | 'audio', participants: string[]) => Promise<string>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  leaveCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => Promise<void>;
  
  // UI state
  showCallModal: boolean;
  setShowCallModal: (show: boolean) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

interface CallProviderProps {
  children: ReactNode;
}

export const CallProvider: React.FC<CallProviderProps> = ({ children }) => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  
  const [currentCall, setCurrentCall] = useState<CallContextType['currentCall']>({
    id: null,
    roomId: null,
    type: null,
    participants: [],
  });
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  
  const [incomingCall, setIncomingCall] = useState<CallContextType['incomingCall']>({
    isIncoming: false,
    callId: null,
    roomId: null,
    type: null,
    caller: null,
  });
  
  const [showCallModal, setShowCallModal] = useState(false);

  // Initialize WebRTC service
  useEffect(() => {
    if (socket && !webrtcServiceRef.current) {
      webrtcServiceRef.current = new WebRTCService(socket);
      
      // Listen for stream updates
      window.addEventListener('webrtc-streams-updated', handleStreamsUpdated);
    }

    return () => {
      window.removeEventListener('webrtc-streams-updated', handleStreamsUpdated);
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.leaveCall();
      }
    };
  }, [socket]);

  // Setup socket listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleIncomingCall = (data: any) => {
      setIncomingCall({
        isIncoming: true,
        callId: data.callId,
        roomId: data.roomId,
        type: data.type,
        caller: {
          id: data.from,
          username: data.fromUsername,
          avatar: data.fromAvatar,
        },
      });
      setShowCallModal(true);
    };

    const handleCallAccepted = (data: any) => {
      // Handle when someone accepts our call
      if (currentCall.id === data.callId) {
        setCurrentCall(prev => ({
          ...prev,
          participants: [...prev.participants, {
            userId: data.userId,
            username: data.username,
            isMuted: false,
            isCameraOff: false,
            isScreenSharing: false,
          }],
        }));
      }
    };

    const handleCallRejected = (data: any) => {
      // Handle when someone rejects our call
      console.log('Call rejected:', data);
    };

    const handleCallEnded = (data: any) => {
      cleanupCall();
      setShowCallModal(false);
    };

    const handleParticipantJoined = (data: any) => {
      if (currentCall.id === data.callId) {
        setCurrentCall(prev => ({
          ...prev,
          participants: [...prev.participants, {
            userId: data.userId,
            username: data.username,
            isMuted: false,
            isCameraOff: false,
            isScreenSharing: false,
          }],
        }));
      }
    };

    const handleParticipantLeft = (data: any) => {
      if (currentCall.id === data.callId) {
        setCurrentCall(prev => ({
          ...prev,
          participants: prev.participants.filter(p => p.userId !== data.userId),
        }));
      }
    };

    const handleParticipantMuted = (data: any) => {
      setCurrentCall(prev => ({
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === data.userId ? { ...p, isMuted: data.isMuted } : p
        ),
      }));
    };

    const handleParticipantCameraOff = (data: any) => {
      setCurrentCall(prev => ({
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === data.userId ? { ...p, isCameraOff: data.isCameraOff } : p
        ),
      }));
    };

    // Register event listeners
    socket.on('call-invite', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-participant-joined', handleParticipantJoined);
    socket.on('call-participant-left', handleParticipantLeft);
    socket.on('participant-muted', handleParticipantMuted);
    socket.on('participant-camera-off', handleParticipantCameraOff);

    return () => {
      socket.off('call-invite', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-participant-joined', handleParticipantJoined);
      socket.off('call-participant-left', handleParticipantLeft);
      socket.off('participant-muted', handleParticipantMuted);
      socket.off('participant-camera-off', handleParticipantCameraOff);
    };
  }, [socket, isConnected, currentCall.id]);

  const handleStreamsUpdated = (event: Event) => {
    const customEvent = event as CustomEvent;
    const { localStream, remoteStreams, screenStream } = customEvent.detail;
    
    setLocalStream(localStream);
    setRemoteStreams(new Map(remoteStreams));
    setScreenStream(screenStream);
  };

  const startCall = async (roomId: string, type: 'video' | 'audio', participants: string[]): Promise<string> => {
    if (!webrtcServiceRef.current) throw new Error('WebRTC service not initialized');

    try {
      // Initialize local stream
      const stream = await webrtcServiceRef.current.initializeLocalStream(type);
      setLocalStream(stream);
      setIsCameraOff(type === 'audio');
      
      // Start the call
      const callId = webrtcServiceRef.current.startCall(roomId, type, participants);
      
      setCurrentCall({
        id: callId,
        roomId,
        type,
        participants: [],
      });
      
      setIsInCall(true);
      return callId;
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  };

  const acceptCall = async () => {
    if (!webrtcServiceRef.current || !incomingCall.callId || !incomingCall.roomId || !incomingCall.type) {
      return;
    }

    try {
      // Initialize local stream
      const stream = await webrtcServiceRef.current.initializeLocalStream(incomingCall.type);
      setLocalStream(stream);
      setIsCameraOff(incomingCall.type === 'audio');
      
      // Join the call
      webrtcServiceRef.current.joinCall(incomingCall.callId, incomingCall.roomId);
      
      setCurrentCall({
        id: incomingCall.callId,
        roomId: incomingCall.roomId,
        type: incomingCall.type,
        participants: [],
      });
      
      setIsInCall(true);
      setIncomingCall({
        isIncoming: false,
        callId: null,
        roomId: null,
        type: null,
        caller: null,
      });
      setShowCallModal(false);
    } catch (error) {
      console.error('Error accepting call:', error);
      rejectCall();
    }
  };

  const rejectCall = () => {
    if (socket && incomingCall.callId && incomingCall.roomId) {
      socket.emit('call-reject', {
        callId: incomingCall.callId,
        roomId: incomingCall.roomId,
      });
    }
    
    setIncomingCall({
      isIncoming: false,
      callId: null,
      roomId: null,
      type: null,
      caller: null,
    });
    setShowCallModal(false);
  };

  const endCall = () => {
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.endCall();
    }
    cleanupCall();
  };

  const leaveCall = () => {
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.leaveCall();
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (webrtcServiceRef.current) {
      const muted = webrtcServiceRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  const toggleCamera = () => {
    if (webrtcServiceRef.current) {
      const cameraOff = webrtcServiceRef.current.toggleCamera();
      setIsCameraOff(cameraOff);
    }
  };

  const toggleScreenShare = async () => {
    if (!webrtcServiceRef.current) return;

    try {
      if (isScreenSharing) {
        webrtcServiceRef.current.stopScreenSharing();
        setIsScreenSharing(false);
      } else {
        await webrtcServiceRef.current.startScreenSharing();
        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const cleanupCall = () => {
    setCurrentCall({
      id: null,
      roomId: null,
      type: null,
      participants: [],
    });
    
    setLocalStream(null);
    setRemoteStreams(new Map());
    setScreenStream(null);
    
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    setIsInCall(false);
    
    setIncomingCall({
      isIncoming: false,
      callId: null,
      roomId: null,
      type: null,
      caller: null,
    });
    
    setShowCallModal(false);
  };

  const value: CallContextType = {
    currentCall,
    localStream,
    remoteStreams,
    screenStream,
    isMuted,
    isCameraOff,
    isScreenSharing,
    isInCall,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    leaveCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    showCallModal,
    setShowCallModal,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};