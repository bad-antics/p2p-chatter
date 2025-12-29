import crypto from 'crypto';
import pino from 'pino';

/**
 * P2P Chatter - Enhanced Encryption Module
 * Implements dual-layer encryption:
 * 1. Message-level: ECDH + AES-256-GCM (end-to-end)
 * 2. Packet-level: PacketRouter encryption from Packet-Cypher-Action
 * 
 * This provides defense-in-depth with two independent encryption layers
 */

const logger = pino({ name: 'EnhancedEncryption' });

export interface DualLayerEncryptedMessage {
  packetId: string;
  messageLayer: {
    ciphertext: string;
    nonce: string;
    authTag: string;
  };
  packetLayer: {
    ciphertext: string;
    iv: string;
    authTag: string;
  };
  senderPublicKey: string;
  timestamp: number;
}

export interface DecryptedMessageResult {
  plaintext: string;
  isValid: boolean;
  timestamp: number;
  senderPublicKey: string;
}

/**
 * Enhanced encryption manager with dual-layer security
 */
export class EnhancedEncryptionManager {
  private packetKey: Buffer;
  private logger = logger;

  constructor(packetKey?: Buffer) {
    // Generate or use provided packet encryption key
    this.packetKey = packetKey || crypto.randomBytes(32);
    this.logger.info('Initialized enhanced encryption with dual-layer support');
  }

  /**
   * Get the packet layer encryption key
   */
  getPacketKey(): Buffer {
    return this.packetKey;
  }

  /**
   * Derive a shared secret from two ECDH public keys (Message Layer)
   */
  static deriveSharedSecret(myPrivateKey: string, theirPublicKey: string): Buffer {
    try {
      const privateKeyBuffer = crypto.createPrivateKey({
        key: myPrivateKey,
        format: 'pem'
      });

      const sharedSecret = crypto.diffieHellman({
        privateKey: privateKeyBuffer,
        publicKey: crypto.createPublicKey({
          key: theirPublicKey,
          format: 'pem'
        })
      });

      return sharedSecret;
    } catch (error) {
      logger.error('Error deriving shared secret:', error);
      throw error;
    }
  }

  /**
   * MESSAGE LAYER: Encrypt using ECDH + AES-256-GCM
   * This is the first encryption layer for end-to-end security
   */
  private encryptMessageLayer(plaintext: string, sharedSecret: Buffer): { ciphertext: string; nonce: string; authTag: string } {
    const nonce = crypto.randomBytes(16);

    // Derive key from shared secret using HKDF
    const key = crypto
      .createHmac('sha256', sharedSecret)
      .update('encryption_key')
      .digest();

    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      nonce: nonce.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * PACKET LAYER: Encrypt using AES-256-GCM with packet key
   * This is the second encryption layer for defense-in-depth
   */
  private encryptPacketLayer(data: string): { ciphertext: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.packetKey, iv);

    let ciphertext = cipher.update(data, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * DUAL-LAYER ENCRYPTION: Apply both layers in sequence
   * Flow: Plaintext -> Message Layer (ECDH+AES-256-GCM) -> Packet Layer (AES-256-GCM) -> Ciphertext
   */
  encryptMessageDualLayer(
    plaintext: string,
    sharedSecret: Buffer,
    senderPublicKey: string
  ): DualLayerEncryptedMessage {
    const packetId = crypto.randomUUID();

    // Layer 1: Message-level encryption (ECDH + AES-256-GCM)
    const messageLayer = this.encryptMessageLayer(plaintext, sharedSecret);

    // Combine message layer for packet layer encryption
    const messageLayerJson = JSON.stringify(messageLayer);

    // Layer 2: Packet-level encryption (AES-256-GCM)
    const packetLayer = this.encryptPacketLayer(messageLayerJson);

    this.logger.debug(`Encrypted message with dual-layer (packetId: ${packetId})`);

    return {
      packetId,
      messageLayer,
      packetLayer,
      senderPublicKey,
      timestamp: Date.now()
    };
  }

  /**
   * MESSAGE LAYER: Decrypt using AES-256-GCM
   */
  private decryptMessageLayer(
    ciphertext: string,
    nonce: string,
    authTag: string,
    sharedSecret: Buffer
  ): string {
    const nonceBuffer = Buffer.from(nonce, 'hex');

    // Derive key from shared secret
    const key = crypto
      .createHmac('sha256', sharedSecret)
      .update('encryption_key')
      .digest();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonceBuffer);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  /**
   * PACKET LAYER: Decrypt using AES-256-GCM with packet key
   */
  private decryptPacketLayer(ciphertext: string, iv: string, authTag: string): string {
    const ivBuffer = Buffer.from(iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.packetKey, ivBuffer);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  /**
   * DUAL-LAYER DECRYPTION: Remove both layers in reverse order
   * Flow: Ciphertext -> Packet Layer (AES-256-GCM) -> Message Layer (ECDH+AES-256-GCM) -> Plaintext
   */
  decryptMessageDualLayer(
    encrypted: DualLayerEncryptedMessage,
    sharedSecret: Buffer
  ): DecryptedMessageResult {
    try {
      // Layer 1: Decrypt packet layer
      const messageLayerJson = this.decryptPacketLayer(
        encrypted.packetLayer.ciphertext,
        encrypted.packetLayer.iv,
        encrypted.packetLayer.authTag
      );

      const messageLayer = JSON.parse(messageLayerJson);

      // Layer 2: Decrypt message layer
      const plaintext = this.decryptMessageLayer(
        messageLayer.ciphertext,
        messageLayer.nonce,
        messageLayer.authTag,
        sharedSecret
      );

      this.logger.debug(`Decrypted message with dual-layer (packetId: ${encrypted.packetId})`);

      return {
        plaintext,
        isValid: true,
        timestamp: encrypted.timestamp,
        senderPublicKey: encrypted.senderPublicKey
      };
    } catch (error) {
      this.logger.error('Error decrypting dual-layer message:', error);
      return {
        plaintext: '',
        isValid: false,
        timestamp: encrypted.timestamp,
        senderPublicKey: encrypted.senderPublicKey
      };
    }
  }

  /**
   * Sign a message with private key (for verification)
   */
  static signMessage(message: string, privateKeyPem: string): string {
    try {
      const sign = crypto.createSign('sha256');
      sign.update(message);
      const signature = sign.sign(privateKeyPem, 'hex');
      return signature;
    } catch (error) {
      logger.error('Error signing message:', error);
      throw error;
    }
  }

  /**
   * Verify a message signature with public key
   */
  static verifySignature(message: string, signature: string, publicKeyPem: string): boolean {
    try {
      const verify = crypto.createVerify('sha256');
      verify.update(message);
      return verify.verify(publicKeyPem, signature, 'hex');
    } catch (error) {
      logger.error('Error verifying signature:', error);
      return false;
    }
  }

  /**
   * Derive a key from password using PBKDF2 (for local encryption)
   */
  static deriveKeyFromPassword(password: string, salt?: Buffer): Buffer {
    const saltBuffer = salt || crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(password, saltBuffer, 100000, 32, 'sha256');
    return key;
  }

  /**
   * Get security statistics for this encryption instance
   */
  getSecurityStats(): {
    layers: number;
    messageLayerAlgorithm: string;
    packetLayerAlgorithm: string;
    keySize: number;
    nonceSize: number;
  } {
    return {
      layers: 2,
      messageLayerAlgorithm: 'ECDH-prime256v1 + AES-256-GCM',
      packetLayerAlgorithm: 'AES-256-GCM',
      keySize: 256,
      nonceSize: 128
    };
  }
}

/**
 * Legacy encryption interface for backward compatibility
 */
export class EncryptionManager {
  /**
   * Derive a shared secret from two ECDH public keys
   */
  static deriveSharedSecret(myPrivateKey: string, theirPublicKey: string): Buffer {
    return EnhancedEncryptionManager.deriveSharedSecret(myPrivateKey, theirPublicKey);
  }

  /**
   * Encrypt a message using symmetric encryption (AES-256-GCM)
   */
  static encryptMessage(plaintext: string, sharedSecret: Buffer): { ciphertext: string; nonce: string; senderPublicKey: string; timestamp: number } {
    const nonce = crypto.randomBytes(16);

    const key = crypto
      .createHmac('sha256', sharedSecret)
      .update('encryption_key')
      .digest();

    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext + ':' + authTag.toString('hex'),
      nonce: nonce.toString('hex'),
      senderPublicKey: '',
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt a message
   */
  static decryptMessage(encrypted: { ciphertext: string; nonce: string }, sharedSecret: Buffer): string {
    const nonce = Buffer.from(encrypted.nonce, 'hex');
    const [ciphertext, authTag] = encrypted.ciphertext.split(':');

    const key = crypto
      .createHmac('sha256', sharedSecret)
      .update('encryption_key')
      .digest();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  /**
   * Sign a message with private key
   */
  static signMessage(message: string, privateKeyPem: string): string {
    return EnhancedEncryptionManager.signMessage(message, privateKeyPem);
  }

  /**
   * Verify a message signature
   */
  static verifySignature(message: string, signature: string, publicKeyPem: string): boolean {
    return EnhancedEncryptionManager.verifySignature(message, signature, publicKeyPem);
  }

  /**
   * Derive a key from password
   */
  static deriveKeyFromPassword(password: string, salt?: Buffer): Buffer {
    return EnhancedEncryptionManager.deriveKeyFromPassword(password, salt);
  }
}

export default EnhancedEncryptionManager;
