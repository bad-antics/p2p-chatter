import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import pino from 'pino';

/**
 * P2P Chatter - User Identity Management
 * Handles user profiles, keys, and identity verification
 */

const logger = pino({ name: 'Identity' });

export interface UserProfile {
  id: string;
  username: string;
  publicKey: string;
  privateKey?: string; // Only stored locally
  createdAt: number;
  profilePicture?: string;
  status?: string;
}

export interface IdentityKeyPair {
  publicKey: string;
  privateKey: string;
}

export class IdentityManager {
  private db: Database.Database;
  private currentUser: UserProfile | null = null;

  constructor(dbPath: string = './data/identity.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  /**
   * Initialize database tables
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        publicKey TEXT NOT NULL,
        privateKey TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        profilePicture TEXT,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        contactId TEXT NOT NULL,
        username TEXT NOT NULL,
        publicKey TEXT NOT NULL,
        displayName TEXT,
        addedAt INTEGER NOT NULL,
        verified BOOLEAN DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(id),
        UNIQUE(userId, contactId)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        contactId TEXT NOT NULL,
        sharedSecret TEXT NOT NULL,
        messageCount INTEGER DEFAULT 0,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (contactId) REFERENCES contacts(contactId)
      );
    `);
  }

  /**
   * Generate a new identity with public/private key pair
   */
  static generateIdentity(username: string): UserProfile {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return {
      id: uuidv4(),
      username,
      publicKey,
      privateKey,
      createdAt: Date.now()
    };
  }

  /**
   * Create and store a new user
   */
  createUser(username: string, profilePicture?: string, status?: string): UserProfile {
    const profile = IdentityManager.generateIdentity(username);
    profile.profilePicture = profilePicture;
    profile.status = status;

    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, publicKey, privateKey, createdAt, profilePicture, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(profile.id, profile.username, profile.publicKey, profile.privateKey, profile.createdAt, profilePicture, status);
    this.currentUser = profile;
    
    logger.info({ userId: profile.id }, 'New user created');
    return profile;
  }

  /**
   * Load user by ID
   */
  loadUser(userId: string): UserProfile | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(userId) as any;
    
    if (user) {
      this.currentUser = user;
      return user;
    }
    return null;
  }

  /**
   * Get current logged-in user
   */
  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  /**
   * Add a contact to the user's contact list
   */
  addContact(contactPublicKey: string, username: string, displayName?: string): string {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    const contactId = crypto
      .createHash('sha256')
      .update(contactPublicKey)
      .digest('hex');

    const stmt = this.db.prepare(`
      INSERT INTO contacts (id, userId, contactId, username, publicKey, displayName, addedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(uuidv4(), this.currentUser.id, contactId, username, contactPublicKey, displayName || username, Date.now());
    logger.info({ contactId, username }, 'Contact added');
    
    return contactId;
  }

  /**
   * Get all contacts for current user
   */
  getContacts(): any[] {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    const stmt = this.db.prepare('SELECT * FROM contacts WHERE userId = ?');
    return stmt.all(this.currentUser.id) as any[];
  }

  /**
   * Get contact by ID
   */
  getContact(contactId: string): any {
    const stmt = this.db.prepare('SELECT * FROM contacts WHERE contactId = ?');
    return stmt.get(contactId);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
