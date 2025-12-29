/**
 * P2P Chatter - Encryption Module
 * Created by antX | Organization: Bad Antics (https://github.com/bad-antics)
 * ©2025 Bad Antics. All rights reserved.
 * 
 * Handles message encryption/decryption using AES-256-GCM and ECDSA signatures
 */

import crypto from 'crypto';
import pino from 'pino';

/**
 * Encrypted Message Interface
 */
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
  timestamp: number;
}

export class EncryptionManager {
  /**
   * Derive a shared secret from two ECDH public keys
   */
  static deriveSharedSecret(myPrivateKey: string, theirPublicKey: string): Buffer {
    const ecdh = crypto.createECDH('prime256v1');
    
    // Import private key
    const privateKeyBuffer = crypto.createPrivateKey({
      key: myPrivateKey,
      format: 'pem'
    });

    // Generate shared secret (ECDH)
    const sharedSecret = crypto.diffieHellman({
      privateKey: privateKeyBuffer,
      publicKey: crypto.createPublicKey({
        key: theirPublicKey,
        format: 'pem'
      })
    });

    return sharedSecret;
  }

  /**
   * Encrypt a message using symmetric encryption (AES-256-GCM)
   * Similar to Session's message encryption
   */
  static encryptMessage(plaintext: string, sharedSecret: Buffer): EncryptedMessage {
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
      ciphertext: ciphertext + ':' + authTag.toString('hex'),
      nonce: nonce.toString('hex'),
      senderPublicKey: '', // Set by caller
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt a message
   */
  static decryptMessage(encrypted: EncryptedMessage, sharedSecret: Buffer): string {
    const nonce = Buffer.from(encrypted.nonce, 'hex');
    const [ciphertext, authTag] = encrypted.ciphertext.split(':');
    
    // Derive key from shared secret
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
   * Sign a message with private key (for verification)
   */
  static signMessage(message: string, privateKeyPem: string): string {
    const sign = crypto.createSign('sha256');
    sign.update(message);
    const signature = sign.sign(privateKeyPem, 'hex');
    return signature;
  }

  /**
   * Verify message signature
   */
  static verifySignature(message: string, signature: string, publicKeyPem: string): boolean {
    const verify = crypto.createVerify('sha256');
    verify.update(message);
    return verify.verify(publicKeyPem, signature, 'hex');
  }

  /**
   * Hash a message for message ID
   */
  static hashMessage(message: string): string {
    return crypto.createHash('sha256').update(message).digest('hex');
  }
}
