import crypto from 'crypto';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 64;
  private static readonly KEY_LENGTH = 32;
  private static readonly ITERATIONS = 100000;

  /**
   * Generate a new encryption key pair (for ECDH key exchange)
   */
  static async generateKeyPair(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    const keyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    };
  }

  /**
   * Derive shared secret using ECDH
   */
  static deriveSharedSecret(
    privateKey: string,
    publicKey: string
  ): Buffer {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(privateKey, 'pem' as any);
    
    return ecdh.computeSecret(publicKey, 'base64');
  }

  /**
   * Encrypt a message
   */
  static encrypt(
    text: string,
    key: Buffer
  ): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(
      this.ALGORITHM,
      key.subarray(0, this.KEY_LENGTH),
      iv
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag
    };
  }

  /**
   * Decrypt a message
   */
  static decrypt(
    encrypted: string,
    key: Buffer,
    iv: string,
    authTag: string
  ): string {
    const decipher = crypto.createDecipheriv(
      this.ALGORITHM,
      key.subarray(0, this.KEY_LENGTH),
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate a symmetric key from password
   */
  static generateSymmetricKey(
    password: string,
    salt?: string
  ): {
    key: Buffer;
    salt: string;
  } {
    const saltBuffer = salt 
      ? Buffer.from(salt, 'hex')
      : crypto.randomBytes(this.SALT_LENGTH);

    const key = crypto.pbkdf2Sync(
      password,
      saltBuffer,
      this.ITERATIONS,
      this.KEY_LENGTH,
      'sha512'
    );

    return {
      key,
      salt: saltBuffer.toString('hex')
    };
  }

  /**
   * Hash data (for message integrity)
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a secure random ID
   */
  static generateSecureId(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}