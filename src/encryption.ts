import * as crypto from 'crypto';

export interface EncryptedMessage {
  ciphertext: string;
  iv: string;
  salt: string;
  tag: string;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export class EncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly HASH_ALGORITHM = 'sha256';
  private readonly KEY_LENGTH = 32;
  private readonly IV_LENGTH = 16;
  private readonly SALT_LENGTH = 16;

  // Encrypt message with AES-256-GCM
  encryptMessage(message: string, key: string): EncryptedMessage {
    const salt = crypto.randomBytes(this.SALT_LENGTH);
    const derivedKey = crypto.scryptSync(key, salt, this.KEY_LENGTH);
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, derivedKey, iv);
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  // Decrypt message
  decryptMessage(encrypted: EncryptedMessage, key: string): string {
    const salt = Buffer.from(encrypted.salt, 'hex');
    const derivedKey = crypto.scryptSync(key, salt, this.KEY_LENGTH);
    const iv = Buffer.from(encrypted.iv, 'hex');
    const tag = Buffer.from(encrypted.tag, 'hex');

    const decipher = crypto.createDecipheriv(this.ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Generate ECDH key pair for key exchange
  generateKeyPair(): KeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1'
    });

    return {
      publicKey: publicKey.export({ format: 'pem', type: 'spki' }),
      privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' })
    };
  }

  // Compute shared secret from public and private keys
  computeSharedSecret(publicKeyPem: string, privateKeyPem: string): string {
    const publicKey = crypto.createPublicKey({
      key: publicKeyPem,
      format: 'pem'
    });

    const privateKey = crypto.createPrivateKey({
      key: privateKeyPem,
      format: 'pem'
    });

    const sharedSecret = crypto.diffieHellman({
      privateKey,
      publicKey
    });

    return sharedSecret.toString('hex');
  }

  // Derive encryption key from shared secret
  deriveKey(sharedSecret: string, salt: string = ''): string {
    return crypto
      .hkdf('sha256', Buffer.from(sharedSecret, 'hex'), salt, 'encryption', 32)
      .toString('hex');
  }

  // Sign message with private key
  signMessage(message: string, privateKeyPem: string): string {
    const sign = crypto.createSign('SHA256');
    sign.update(message);
    sign.end();

    const privateKey = crypto.createPrivateKey({
      key: privateKeyPem,
      format: 'pem'
    });

    return sign.sign(privateKey, 'hex');
  }

  // Verify message signature
  verifySignature(message: string, signature: string, publicKeyPem: string): boolean {
    const verify = crypto.createVerify('SHA256');
    verify.update(message);
    verify.end();

    const publicKey = crypto.createPublicKey({
      key: publicKeyPem,
      format: 'pem'
    });

    return verify.verify(publicKey, signature, 'hex');
  }

  // Hash password with PBKDF2
  hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(32);
    const hash = crypto
      .pbkdf2Sync(password, saltBuffer, 100000, 64, this.HASH_ALGORITHM)
      .toString('hex');

    return {
      hash,
      salt: saltBuffer.toString('hex')
    };
  }

  // Generate random token
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}

export default new EncryptionService();
