import Database from 'better-sqlite3';
import pino from 'pino';

/**
 * Database schema migration and upgrade utility
 * Handles adding new tables and columns for new features
 */

const logger = pino({ name: 'DBMigration' });

export class DatabaseMigration {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Check current schema version
   */
  getSchemaVersion(): number {
    try {
      const result = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
      return result.user_version;
    } catch {
      return 0;
    }
  }

  /**
   * Set schema version
   */
  setSchemaVersion(version: number): void {
    this.db.prepare(`PRAGMA user_version = ${version}`).run();
  }

  /**
   * Run all pending migrations
   */
  runMigrations(): void {
    const currentVersion = this.getSchemaVersion();
    logger.info(`Current schema version: ${currentVersion}`);

    if (currentVersion < 1) {
      this.migrationV1_AddGroups();
      this.setSchemaVersion(1);
      logger.info('Applied migration V1: Added group messaging support');
    }

    if (currentVersion < 2) {
      this.migrationV2_AddReactions();
      this.setSchemaVersion(2);
      logger.info('Applied migration V2: Added message reactions');
    }

    if (currentVersion < 3) {
      this.migrationV3_AddFileSharing();
      this.setSchemaVersion(3);
      logger.info('Applied migration V3: Added file sharing');
    }

    if (currentVersion < 4) {
      this.migrationV4_AddTypingIndicators();
      this.setSchemaVersion(4);
      logger.info('Applied migration V4: Added typing indicators');
    }

    if (currentVersion < 5) {
      this.migrationV5_AddThreading();
      this.setSchemaVersion(5);
      logger.info('Applied migration V5: Added message threading');
    }
  }

  /**
   * Migration V1: Add group messaging support
   */
  private migrationV1_AddGroups(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        createdBy TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        profilePicture TEXT,
        isEncrypted BOOLEAN DEFAULT 1,
        encryptionKey TEXT
      );

      CREATE TABLE IF NOT EXISTS group_members (
        id TEXT PRIMARY KEY,
        groupId TEXT NOT NULL,
        userId TEXT NOT NULL,
        joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        role TEXT DEFAULT 'member', -- 'admin', 'member', 'moderator'
        permissions TEXT, -- JSON array of permissions
        UNIQUE(groupId, userId),
        FOREIGN KEY (groupId) REFERENCES groups(id),
        FOREIGN KEY (userId) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS group_conversations (
        id TEXT PRIMARY KEY,
        groupId TEXT NOT NULL,
        lastMessageTime DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(groupId),
        FOREIGN KEY (groupId) REFERENCES groups(id)
      );

      CREATE INDEX IF NOT EXISTS idx_group_members_groupId ON group_members(groupId);
      CREATE INDEX IF NOT EXISTS idx_group_members_userId ON group_members(userId);
    `);
  }

  /**
   * Migration V2: Add message reactions
   */
  private migrationV2_AddReactions(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id TEXT PRIMARY KEY,
        messageId TEXT NOT NULL,
        userId TEXT NOT NULL,
        emoji TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(messageId, userId, emoji),
        FOREIGN KEY (messageId) REFERENCES messages(id),
        FOREIGN KEY (userId) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_message_reactions_messageId ON message_reactions(messageId);
      CREATE INDEX IF NOT EXISTS idx_message_reactions_userId ON message_reactions(userId);
    `);
  }

  /**
   * Migration V3: Add file sharing
   */
  private migrationV3_AddFileSharing(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_shares (
        id TEXT PRIMARY KEY,
        messageId TEXT,
        senderId TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileSize INTEGER NOT NULL,
        fileHash TEXT NOT NULL,
        mimeType TEXT,
        encryptedContent TEXT,
        encryptionKey TEXT,
        uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiresAt DATETIME,
        downloadCount INTEGER DEFAULT 0,
        isPublic BOOLEAN DEFAULT 0,
        FOREIGN KEY (messageId) REFERENCES messages(id),
        FOREIGN KEY (senderId) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_file_shares_messageId ON file_shares(messageId);
      CREATE INDEX IF NOT EXISTS idx_file_shares_senderId ON file_shares(senderId);
      CREATE INDEX IF NOT EXISTS idx_file_shares_fileHash ON file_shares(fileHash);
    `);
  }

  /**
   * Migration V4: Add typing indicators
   */
  private migrationV4_AddTypingIndicators(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS typing_status (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        conversationId TEXT NOT NULL,
        groupId TEXT,
        isTyping BOOLEAN DEFAULT 0,
        lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(userId, conversationId),
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (conversationId) REFERENCES conversations(id),
        FOREIGN KEY (groupId) REFERENCES groups(id)
      );

      CREATE INDEX IF NOT EXISTS idx_typing_status_conversationId ON typing_status(conversationId);
      CREATE INDEX IF NOT EXISTS idx_typing_status_groupId ON typing_status(groupId);
    `);
  }

  /**
   * Migration V5: Add message threading
   */
  private migrationV5_AddThreading(): void {
    this.db.exec(`
      ALTER TABLE messages ADD COLUMN parentMessageId TEXT DEFAULT NULL;
      
      CREATE TABLE IF NOT EXISTS message_threads (
        id TEXT PRIMARY KEY,
        parentMessageId TEXT NOT NULL,
        conversationId TEXT NOT NULL,
        groupId TEXT,
        replyCount INTEGER DEFAULT 0,
        lastReplyAt DATETIME,
        UNIQUE(parentMessageId),
        FOREIGN KEY (parentMessageId) REFERENCES messages(id),
        FOREIGN KEY (conversationId) REFERENCES conversations(id),
        FOREIGN KEY (groupId) REFERENCES groups(id)
      );

      CREATE INDEX IF NOT EXISTS idx_message_threads_parentMessageId ON message_threads(parentMessageId);
      CREATE INDEX IF NOT EXISTS idx_message_threads_conversationId ON message_threads(conversationId);
      CREATE INDEX IF NOT EXISTS idx_messages_parentMessageId ON messages(parentMessageId);
    `);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

export default DatabaseMigration;
