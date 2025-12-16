// Web Crypto API wrapper for browser encryption
export class WebCryptoService {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly ITERATIONS = 100000;

  /**
   * Generate a new ECDH key pair
   */
  static async generateKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey', 'deriveBits']
    );
  }

  /**
   * Export public key to string
   */
  static async exportPublicKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('spki', key);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Export private key to string
   */
  static async exportPrivateKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('pkcs8', key);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Import public key from string
   */
  static async importPublicKey(base64Key: string): Promise<CryptoKey> {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return await crypto.subtle.importKey(
      'spki',
      keyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      []
    );
  }

  /**
   * Import private key from string
   */
  static async importPrivateKey(base64Key: string): Promise<CryptoKey> {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey', 'deriveBits']
    );
  }

  /**
   * Derive shared secret from key pair
   */
  static async deriveSharedKey(
    privateKey: CryptoKey,
    publicKey: CryptoKey
  ): Promise<CryptoKey> {
    return await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: publicKey
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: this.KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt message using AES-GCM
   */
  static async encrypt(
    text: string,
    key: CryptoKey
  ): Promise<{
    encrypted: string;
    iv: string;
  }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv
      },
      key,
      encodedText
    );

    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv.buffer)
    };
  }

  /**
   * Decrypt message using AES-GCM
   */
  static async decrypt(
    encrypted: string,
    key: CryptoKey,
    iv: string
  ): Promise<string> {
    const encryptedData = this.base64ToArrayBuffer(encrypted);
    const ivData = this.base64ToArrayBuffer(iv);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.ALGORITHM,
        iv: new Uint8Array(ivData)
      },
      key,
      encryptedData
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Generate symmetric key from password (for backup)
   */
  static async generateSymmetricKey(
    password: string,
    salt?: string
  ): Promise<{
    key: CryptoKey;
    salt: string;
  }> {
    const saltArray = salt 
      ? this.base64ToArrayBuffer(salt)
      : crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(saltArray),
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: this.KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );

    return {
      key,
      salt: this.arrayBufferToBase64(saltArray)
    };
  }

  /**
   * Generate a secure random ID
   */
  static generateSecureId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.arrayBufferToBase64(array.buffer);
  }

  /**
   * Hash data for integrity verification
   */
  static async hash(data: string): Promise<string> {
    const encoded = new TextEncoder().encode(data);
    const hash = await crypto.subtle.digest('SHA-256', encoded);
    return this.arrayBufferToBase64(hash);
  }

  /**
   * Convert ArrayBuffer to Base64 (downlevel iteration safe)
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 to ArrayBuffer (downlevel iteration safe)
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Session key management for chat rooms
export class SessionKeyManager {
  private static instance: SessionKeyManager;
  private sessionKeys: Map<string, CryptoKey> = new Map(); // roomId -> key
  private keyPairs: Map<string, CryptoKeyPair> = new Map(); // userId -> keyPair

  private constructor() {}

  static getInstance(): SessionKeyManager {
    if (!SessionKeyManager.instance) {
      SessionKeyManager.instance = new SessionKeyManager();
    }
    return SessionKeyManager.instance;
  }

  async generateKeyPair(userId: string): Promise<CryptoKeyPair> {
    const keyPair = await WebCryptoService.generateKeyPair();
    this.keyPairs.set(userId, keyPair);
    return keyPair;
  }

  async getOrCreateKeyPair(userId: string): Promise<CryptoKeyPair> {
    let keyPair = this.keyPairs.get(userId);
    if (!keyPair) {
      keyPair = await this.generateKeyPair(userId);
    }
    return keyPair;
  }

  async establishSession(
    roomId: string,
    userId: string,
    otherUserPublicKey: string
  ): Promise<void> {
    const keyPair = await this.getOrCreateKeyPair(userId);
    const otherUserKey = await WebCryptoService.importPublicKey(otherUserPublicKey);
    const sharedKey = await WebCryptoService.deriveSharedKey(keyPair.privateKey, otherUserKey);
    
    this.sessionKeys.set(roomId, sharedKey);
    
    // Store in localStorage for persistence
    const exportedKey = await WebCryptoService.exportPublicKey(keyPair.publicKey);
    localStorage.setItem(`keypair_${userId}`, JSON.stringify({
      publicKey: exportedKey,
      privateKey: await WebCryptoService.exportPrivateKey(keyPair.privateKey)
    }));
  }

  async getSessionKey(roomId: string): Promise<CryptoKey | null> {
    return this.sessionKeys.get(roomId) || null;
  }

  async clearSession(roomId: string): Promise<void> {
    this.sessionKeys.delete(roomId);
  }

  clearAllSessions(): void {
    this.sessionKeys.clear();
    this.keyPairs.clear();
    console.log('All encryption sessions cleared');
  }

  async exportPublicKey(userId: string): Promise<string | null> {
    const keyPair = this.keyPairs.get(userId);
    if (!keyPair) return null;
    
    return await WebCryptoService.exportPublicKey(keyPair.publicKey);
  }
}