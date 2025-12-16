export interface ServerToClientEvents {
  message: (message: any) => void;
  roomList: (rooms: any[]) => void;
  userConnected: (user: any) => void;
  userDisconnected: (userId: string) => void;
  typing: (data: any) => void;
  stopTyping: (data: any) => void;
}

export interface ClientToServerEvents {
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (message: any) => void;
  typing: (data: { roomId: string; isTyping: boolean }) => void;
}