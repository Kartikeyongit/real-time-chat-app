import { WebCryptoService, SessionKeyManager } from '../utils/crypto';

export interface EncryptedMessage {
  content?: string;
  isEncrypted: boolean;
  encryptedContent?: string;
  encryptionIv?: string;
  encryptionKeyId?: string;
  signature?: string;
}

export class ChatEncryptionService {
  private sessionKeyManager: SessionKeyManager;
  private socket: any;

  constructor(socket: any) {
    this.sessionKeyManager = SessionKeyManager.getInstance();
    this.socket = socket;
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('key-received', this.handleKeyReceived.bind(this));
    this.socket.on('encryption-required', this.handleEncryptionRequired.bind(this));
  }

  private async handleKeyReceived(data: any): Promise<void> {
    try {
      const { from, publicKey, roomId } = data;
      
      // Establish session with the received public key
      await this.sessionKeyManager.establishSession(roomId, from, publicKey);
      
      console.log('Encryption session established for room:', roomId);
    } catch (error) {
      console.error('Error handling received key:', error);
    }
  }

  private handleEncryptionRequired(data: any): void {
    console.warn('Encryption required but not enabled:', data);
    // You could trigger UI notification here
  }

  async initialize(userId: string): Promise<string> {
    try {
      const keyPair = await this.sessionKeyManager.generateKeyPair(userId);
      const publicKey = await WebCryptoService.exportPublicKey(keyPair.publicKey);
      
      return publicKey;
    } catch (error) {
      console.error('Error initializing encryption:', error);
      throw error;
    }
  }

  async startKeyExchange(roomId: string, targetUserId?: string): Promise<void> {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) throw new Error('User not authenticated');

      const keyPair = await this.sessionKeyManager.getOrCreateKeyPair(userId);
      const publicKey = await WebCryptoService.exportPublicKey(keyPair.publicKey);

      this.socket.emit('key-exchange', {
        roomId,
        publicKey,
        targetUserId
      });
    } catch (error) {
      console.error('Error starting key exchange:', error);
      throw error;
    }
  }

  async encryptMessage(
    roomId: string,
    plaintext: string
  ): Promise<EncryptedMessage> {
    try {
      const sessionKey = await this.sessionKeyManager.getSessionKey(roomId);
      
      if (!sessionKey) {
        return {
          content: plaintext,
          isEncrypted: false
        };
      }

      const { encrypted, iv } = await WebCryptoService.encrypt(plaintext, sessionKey);
      const signature = await WebCryptoService.hash(`${encrypted}${iv}`);

      return {
        isEncrypted: true,
        encryptedContent: encrypted,
        encryptionIv: iv,
        signature
      };
    } catch (error) {
      console.error('Error encrypting message:', error);
      return {
        content: plaintext,
        isEncrypted: false
      };
    }
  }

  async decryptMessage(
    roomId: string,
    encryptedMessage: EncryptedMessage
  ): Promise<string> {
    try {
      if (!encryptedMessage.isEncrypted || 
          !encryptedMessage.encryptedContent || 
          !encryptedMessage.encryptionIv) {
        return encryptedMessage.content || '';
      }

      if (encryptedMessage.signature) {
        const calculatedHash = await WebCryptoService.hash(
          `${encryptedMessage.encryptedContent}${encryptedMessage.encryptionIv}`
        );
        
        if (calculatedHash !== encryptedMessage.signature) {
          throw new Error('Message signature verification failed');
        }
      }

      const sessionKey = await this.sessionKeyManager.getSessionKey(roomId);
      if (!sessionKey) {
        throw new Error('No decryption key available for this room');
      }

      return await WebCryptoService.decrypt(
        encryptedMessage.encryptedContent,
        sessionKey,
        encryptedMessage.encryptionIv
      );
    } catch (error) {
      console.error('Error decrypting message:', error);
      return '[Encrypted message - decryption failed]';
    }
  }

  async encryptFile(file: File): Promise<{ encryptedFile: Blob; key: string }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const key = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        arrayBuffer
      );

      // Export key for later decryption - using safe iteration
      const exportedKey = await crypto.subtle.exportKey('raw', key);
      const exportedArray = new Uint8Array(exportedKey);
      let keyString = '';
      for (let i = 0; i < exportedArray.length; i++) {
        keyString += String.fromCharCode(exportedArray[i]);
      }
      keyString = btoa(keyString);

      // Create blob with IV prepended
      const ivArray = Array.from(iv);
      const encryptedArray = new Uint8Array(encrypted);
      const combinedArray = new Uint8Array(ivArray.length + encryptedArray.length);
      
      // Copy IV first
      combinedArray.set(ivArray, 0);
      // Then encrypted data
      combinedArray.set(encryptedArray, ivArray.length);

      const encryptedBlob = new Blob([combinedArray], { type: 'application/octet-stream' });

      return {
        encryptedFile: encryptedBlob,
        key: keyString
      };
    } catch (error) {
      console.error('Error encrypting file:', error);
      throw error;
    }
  }

  async decryptFile(encryptedBlob: Blob, keyString: string): Promise<Blob> {
    try {
      const arrayBuffer = await encryptedBlob.arrayBuffer();
      const view = new Uint8Array(arrayBuffer);
      
      // Extract IV (first 12 bytes)
      const iv = view.slice(0, 12);
      const encryptedData = view.slice(12);
      
      // Import key - using safe iteration
      const keyData = atob(keyString);
      const keyArray = new Uint8Array(keyData.length);
      for (let i = 0; i < keyData.length; i++) {
        keyArray[i] = keyData.charCodeAt(i);
      }
      
      const key = await crypto.subtle.importKey(
        'raw',
        keyArray,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encryptedData
      );

      return new Blob([decrypted]);
    } catch (error) {
      console.error('Error decrypting file:', error);
      throw error;
    }
  }

  isEncryptionSupported(): boolean {
    return !!crypto.subtle;
  }

  async clearAllSessions(): Promise<void> {
    localStorage.removeItem('keypair');
  }
}

// Singleton instance
let encryptionServiceInstance: ChatEncryptionService | null = null;

export const getEncryptionService = (socket?: any): ChatEncryptionService => {
  if (!encryptionServiceInstance && socket) {
    encryptionServiceInstance = new ChatEncryptionService(socket);
  }
  
  if (!encryptionServiceInstance) {
    throw new Error('Encryption service not initialized. Call with socket first.');
  }
  
  return encryptionServiceInstance;
};