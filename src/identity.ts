/**
 * P2P Chatter - User Identity Management Module
 * Created by antX | Organization: Bad Antics (https://github.com/bad-antics)
 * ©2025 Bad Antics. All rights reserved.
 * 
 * Handles user profiles, keys, and identity verification
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

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

export interface Contact {
  id: string;
  userId: string;
  contactId: string;
  username: string;
  publicKey: string;
  displayName: string;
  addedAt: number;
  verified: boolean;
}

export class IdentityManager {
  private users: Map<string, UserProfile> = new Map();
  private contacts: Map<string, Contact> = new Map();
  private contactsByUser: Map<string, Contact[]> = new Map();
  private currentUser: UserProfile | null = null;

  constructor(dbPath?: string) {
    logger.info('IdentityManager initialized (in-memory)');
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

    this.users.set(profile.id, profile);
    this.contactsByUser.set(profile.id, []);
    this.currentUser = profile;
    
    logger.info({ userId: profile.id }, 'New user created');
    return profile;
  }

  /**
   * Load user by ID
   */
  loadUser(userId: string): UserProfile | null {
    const user = this.users.get(userId);
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

    const contact: Contact = {
      id: uuidv4(),
      userId: this.currentUser.id,
      contactId,
      username,
      publicKey: contactPublicKey,
      displayName: displayName || username,
      addedAt: Date.now(),
      verified: false
    };

    this.contacts.set(contactId, contact);
    
    if (!this.contactsByUser.has(this.currentUser.id)) {
      this.contactsByUser.set(this.currentUser.id, []);
    }
    this.contactsByUser.get(this.currentUser.id)!.push(contact);
    
    logger.info({ contactId, username }, 'Contact added');
    return contactId;
  }

  /**
   * Get all contacts for current user
   */
  getContacts(): Contact[] {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    return this.contactsByUser.get(this.currentUser.id) || [];
  }

  /**
   * Get contact by ID
   */
  getContact(contactId: string): Contact | undefined {
    return this.contacts.get(contactId);
  }

  /**
   * Close (no-op for in-memory implementation)
   */
  close(): void {
    logger.info('IdentityManager closed');
  }
}
