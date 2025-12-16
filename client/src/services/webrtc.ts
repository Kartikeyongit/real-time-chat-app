import { io, Socket } from 'socket.io-client';
import Peer, { Instance as SimplePeer } from 'simple-peer';

export interface MediaStreams {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  screenStream: MediaStream | null;
}

export interface PeerConnection {
  peerId: string;
  peer: SimplePeer;
  stream: MediaStream;
}

export class WebRTCService {
  private socket: Socket;
  private peers: Map<string, SimplePeer> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private isMuted = false;
  private isCameraOff = false;
  private isScreenSharing = false;
  private currentCallId: string | null = null;
  private currentRoomId: string | null = null;

  constructor(socket: Socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('webrtc-offer', this.handleOffer.bind(this));
    this.socket.on('webrtc-answer', this.handleAnswer.bind(this));
    this.socket.on('webrtc-ice-candidate', this.handleICECandidate.bind(this));
    this.socket.on('call-ended', this.handleCallEnded.bind(this));
  }

  async initializeLocalStream(type: 'video' | 'audio'): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Set initial states
      this.isMuted = false;
      this.isCameraOff = type === 'audio';
      
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  async startScreenSharing(): Promise<MediaStream> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
            frameRate: { ideal: 30 },
            width: { max: 1920 },
            height: { max: 1080 }
        },
        audio: true
      });

      this.isScreenSharing = true;
      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenSharing();
      };

      // For screen sharing with simple-peer, we need to renegotiate
      // Instead of replacing tracks, we'll create new peer connections
      // For simplicity, let's keep it basic for now
      console.log('Screen sharing started. Note: To share screen with peers, you may need to renegotiate connections.');

      return this.screenStream;
    } catch (error) {
      console.error('Error starting screen sharing:', error);
      throw error;
    }
  }

  stopScreenSharing(): void {
    if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop());
        this.screenStream = null;
        this.isScreenSharing = false;

        // Note: For proper screen sharing, you'd need to handle renegotiation
        console.log('Screen sharing stopped');
    }
  }

  async createPeer(userId: string, initiator: boolean, stream: MediaStream): Promise<SimplePeer> {
    const peer = new Peer({
      initiator,
      trickle: true,
      stream: initiator ? stream : undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          // Add your own TURN servers for production
          // {
          //   urls: 'turn:your-turn-server.com:3478',
          //   username: 'username',
          //   credential: 'password'
          // }
        ]
      }
    });

    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        this.socket.emit('webrtc-offer', {
          to: userId,
          roomId: this.currentRoomId,
          callId: this.currentCallId,
          sdp: data,
          type: this.isCameraOff ? 'audio' : 'video'
        });
      } else if (data.type === 'answer') {
        this.socket.emit('webrtc-answer', {
          to: userId,
          roomId: this.currentRoomId,
          callId: this.currentCallId,
          sdp: data
        });
      } else if (data.type === 'candidate') {
        this.socket.emit('webrtc-ice-candidate', {
          to: userId,
          roomId: this.currentRoomId,
          callId: this.currentCallId,
          candidate: data
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      this.remoteStreams.set(userId, remoteStream);
      this.emitStreamUpdate();
    });

    peer.on('close', () => {
      this.peers.delete(userId);
      this.remoteStreams.delete(userId);
      this.emitStreamUpdate();
    });

    peer.on('error', (error) => {
      console.error('Peer connection error:', error);
      this.peers.delete(userId);
      this.remoteStreams.delete(userId);
      this.emitStreamUpdate();
    });

    this.peers.set(userId, peer);
    return peer;
  }

  private handleOffer(data: any): void {
    if (!this.localStream) return;

    const peer = this.createPeer(data.from, false, this.localStream);
    
    peer.then(p => {
      p.signal(data.sdp);
    }).catch(console.error);
  }

  private handleAnswer(data: any): void {
    const peer = this.peers.get(data.from);
    if (peer) {
      peer.signal(data.sdp);
    }
  }

  private handleICECandidate(data: any): void {
    const peer = this.peers.get(data.from);
    if (peer) {
      peer.signal(data.candidate);
    }
  }

  private handleCallEnded(data: any): void {
    this.cleanup();
  }

  toggleMute(): boolean {
    if (this.localStream) {
      this.isMuted = !this.isMuted;
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
      
      this.socket.emit('participant-muted', {
        callId: this.currentCallId,
        roomId: this.currentRoomId,
        isMuted: this.isMuted
      });
    }
    return this.isMuted;
  }

  toggleCamera(): boolean {
    if (this.localStream) {
      this.isCameraOff = !this.isCameraOff;
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = !this.isCameraOff;
      });
      
      this.socket.emit('participant-camera-off', {
        callId: this.currentCallId,
        roomId: this.currentRoomId,
        isCameraOff: this.isCameraOff
      });
    }
    return this.isCameraOff;
  }

  startCall(roomId: string, type: 'video' | 'audio', participants: string[]): string {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentCallId = callId;
    this.currentRoomId = roomId;

    this.socket.emit('call-invite', {
      callId,
      roomId,
      type,
      participants
    });

    return callId;
  }

  joinCall(callId: string, roomId: string): void {
    this.currentCallId = callId;
    this.currentRoomId = roomId;
    
    this.socket.emit('call-join', { callId, roomId });
  }

  endCall(): void {
    this.socket.emit('call-end', {
      callId: this.currentCallId,
      roomId: this.currentRoomId
    });
    this.cleanup();
  }

  leaveCall(): void {
    this.socket.emit('call-leave', {
      callId: this.currentCallId,
      roomId: this.currentRoomId
    });
    this.cleanup();
  }

  private emitStreamUpdate(): void {
    // Emit custom event for UI updates
    const event = new CustomEvent('webrtc-streams-updated', {
      detail: {
        localStream: this.localStream,
        remoteStreams: Array.from(this.remoteStreams.entries()),
        screenStream: this.screenStream
      }
    });
    window.dispatchEvent(event);
  }

  getStreams(): MediaStreams {
    return {
      localStream: this.localStream,
      remoteStreams: this.remoteStreams,
      screenStream: this.screenStream
    };
  }

  private cleanup(): void {
    // Clean up all media streams
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Clean up peer connections
    this.peers.forEach(peer => {
      peer.destroy();
    });
    this.peers.clear();
    this.remoteStreams.clear();

    this.currentCallId = null;
    this.currentRoomId = null;
    this.isMuted = false;
    this.isCameraOff = false;
    this.isScreenSharing = false;
  }
}