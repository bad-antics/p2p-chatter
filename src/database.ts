/**
 * P2P Chatter - File-Based Database Module
 * Created by antX | Organization: Bad Antics (https://github.com/bad-antics)
 * ©2025 Bad Antics. All rights reserved.
 * 
 * Handles persistent user, chat, and message storage using JSON files with auto-cleanup
 * This implementation uses file-based storage to avoid native module compilation issues
 */

import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ name: 'Database' });

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  publicKey: string;
  createdAt: number;
  lastActive: number;
  profilePicture?: string;
  status?: string;
  expiresAt?: number;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  encryptedContent: string;
  timestamp: number;
  isRead: number;
  expiresAt?: number;
}

export interface StoredConversation {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: number;
  lastMessageTime: number;
  expiresAt?: number;
}

interface DatabaseStore {
  users: Map<string, StoredUser>;
  messages: Map<string, StoredMessage>;
  conversations: Map<string, StoredConversation>;
  directory: Array<{ userId: string; username: string; publicKey: string; expiresAt: number }>;
}

export class DatabaseManager {
  private store: DatabaseStore = {
    users: new Map(),
    messages: new Map(),
    conversations: new Map(),
    directory: []
  };
  private dbPath: string;
  private storePath: string;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(dataDir: string = './data') {
    this.dbPath = dataDir;
    this.storePath = path.join(dataDir, 'store.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.loadFromDisk();
    this.startCleanupInterval();
    logger.info({ dbPath: this.dbPath }, 'Database initialized (file-based)');
  }

  /**
   * Load database from disk
   */
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
        
        // Convert arrays back to Maps
        this.store.users = new Map(data.users || []);
        this.store.messages = new Map(data.messages || []);
        this.store.conversations = new Map(data.conversations || []);
        this.store.directory = data.directory || [];
        
        logger.debug('Database loaded from disk');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to load database from disk');
    }
  }

  /**
   * Save database to disk
   */
  private saveToDisk(): void {
    try {
      const data = {
        users: Array.from(this.store.users.entries()),
        messages: Array.from(this.store.messages.entries()),
        conversations: Array.from(this.store.conversations.entries()),
        directory: this.store.directory
      };
      
      fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error({ error }, 'Failed to save database to disk');
    }
  }

  /**
   * Store a user
   */
  storeUser(user: StoredUser, expiryHours: number = 1): void {
    const userData = {
      ...user,
      expiresAt: Date.now() + expiryHours * 60 * 60 * 1000
    };
    
    this.store.users.set(user.id, userData);
    this.saveToDisk();
    logger.debug({ username: user.username }, 'User stored');
  }

  /**
   * Get user by username
   */
  getUserByUsername(username: string): StoredUser | null {
    const now = Date.now();
    
    for (const [, user] of this.store.users) {
      if (user.username === username && (!user.expiresAt || user.expiresAt > now)) {
        return user;
      }
    }
    
    return null;
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): StoredUser | null {
    const user = this.store.users.get(id);
    
    if (user && (!user.expiresAt || user.expiresAt > Date.now())) {
      return user;
    }
    
    return null;
  }

  /**
   * Store a conversation
   */
  storeConversation(conversation: StoredConversation, expiryHours: number = 1): void {
    const convData = {
      ...conversation,
      expiresAt: Date.now() + expiryHours * 60 * 60 * 1000
    };
    
    this.store.conversations.set(conversation.id, convData);
    this.saveToDisk();
  }

  /**
   * Store a message
   */
  storeMessage(message: StoredMessage, expiryHours: number = 1): void {
    const msgData = {
      ...message,
      expiresAt: Date.now() + expiryHours * 60 * 60 * 1000
    };
    
    this.store.messages.set(message.id, msgData);
    this.saveToDisk();
  }

  /**
   * Get messages for conversation
   */
  getConversationMessages(conversationId: string): StoredMessage[] {
    const now = Date.now();
    const messages: StoredMessage[] = [];
    
    for (const [, msg] of this.store.messages) {
      if (msg.conversationId === conversationId && (!msg.expiresAt || msg.expiresAt > now)) {
        messages.push(msg);
      }
    }
    
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Publish user to directory
   */
  publishToDirectory(userId: string, username: string, publicKey: string): void {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    // Remove old entry if exists
    this.store.directory = this.store.directory.filter(entry => entry.userId !== userId);
    
    // Add new entry
    this.store.directory.push({
      userId,
      username,
      publicKey,
      expiresAt
    });
    
    this.saveToDisk();
    logger.debug({ username }, 'User published to directory');
  }

  /**
   * Search directory by username
   */
  searchDirectory(username: string): Array<{ userId: string; username: string; publicKey: string }> {
    const now = Date.now();
    const results: Array<{ userId: string; username: string; publicKey: string }> = [];
    
    for (const entry of this.store.directory) {
      if ((!entry.expiresAt || entry.expiresAt > now) && 
          entry.username.toLowerCase().includes(username.toLowerCase())) {
        results.push({
          userId: entry.userId,
          username: entry.username,
          publicKey: entry.publicKey
        });
        
        if (results.length >= 10) break;
      }
    }
    
    return results;
  }

  /**
   * Cleanup expired data
   */
  private cleanup(): void {
    try {
      const now = Date.now();
      
      // Delete expired users
      for (const [key, user] of this.store.users) {
        if (user.expiresAt && user.expiresAt <= now) {
          this.store.users.delete(key);
        }
      }
      
      // Delete expired messages
      for (const [key, msg] of this.store.messages) {
        if (msg.expiresAt && msg.expiresAt <= now) {
          this.store.messages.delete(key);
        }
      }
      
      // Delete expired conversations
      for (const [key, conv] of this.store.conversations) {
        if (conv.expiresAt && conv.expiresAt <= now) {
          this.store.conversations.delete(key);
        }
      }
      
      // Delete expired directory entries
      this.store.directory = this.store.directory.filter(entry => !entry.expiresAt || entry.expiresAt > now);
      
      this.saveToDisk();
      logger.debug('Database cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Cleanup failed');
    }
  }

  /**
   * Start automatic cleanup interval (every 5 minutes)
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Securely wipe all data
   */
  wipeAllData(): void {
    try {
      logger.info('Wiping all database data');
      
      this.store.users.clear();
      this.store.messages.clear();
      this.store.conversations.clear();
      this.store.directory = [];
      
      this.saveToDisk();
      logger.info('Database wiped');
    } catch (error) {
      logger.error({ error }, 'Failed to wipe database');
    }
  }

  /**
   * Close database and cleanup
   */
  close(): void {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      this.wipeAllData();
      logger.info('Database closed');
    } catch (error) {
      logger.error({ error }, 'Error closing database');
    }
  }
}

export default DatabaseManager;

