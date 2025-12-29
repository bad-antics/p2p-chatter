import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

/**
 * Enhanced Message Store with Group Support
 * Features:
 * - Group messaging (multiple participants)
 * - Message reactions (emoji)
 * - File sharing with encryption
 * - Typing indicators
 * - Message threading (replies)
 */

const logger = pino({ name: 'EnhancedMessageStore' });

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  profilePicture?: string;
  isEncrypted: boolean;
  encryptionKey?: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: string;
  role: 'admin' | 'member' | 'moderator';
  permissions?: string[];
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface FileShare {
  id: string;
  messageId?: string;
  senderId: string;
  fileName: string;
  fileSize: number;
  fileHash: string;
  mimeType?: string;
  encryptedContent?: string;
  encryptionKey?: string;
  uploadedAt: string;
  expiresAt?: string;
  downloadCount: number;
  isPublic: boolean;
}

export interface TypingStatus {
  id: string;
  userId: string;
  conversationId?: string;
  groupId?: string;
  isTyping: boolean;
  lastUpdate: string;
}

export class EnhancedMessageStore {
  private db: Database.Database;
  private logger = logger;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  // ========== GROUP MANAGEMENT ==========

  /**
   * Create a new group
   */
  createGroup(name: string, createdBy: string, description?: string, isEncrypted: boolean = true): Group {
    const groupId = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO groups (id, name, description, createdBy, createdAt, updatedAt, isEncrypted)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(groupId, name, description || null, createdBy, now, now, isEncrypted ? 1 : 0);

    // Add creator as admin
    this.addGroupMember(groupId, createdBy, 'admin');

    this.logger.info(`Created group: ${groupId}`);

    return {
      id: groupId,
      name,
      description,
      createdBy,
      createdAt: now,
      updatedAt: now,
      isEncrypted
    };
  }

  /**
   * Add member to group
   */
  addGroupMember(groupId: string, userId: string, role: 'admin' | 'member' | 'moderator' = 'member'): GroupMember {
    const memberId = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO group_members (id, groupId, userId, joinedAt, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(memberId, groupId, userId, now, role);

    this.logger.debug(`Added member ${userId} to group ${groupId} as ${role}`);

    return {
      id: memberId,
      groupId,
      userId,
      joinedAt: now,
      role,
      permissions: []
    };
  }

  /**
   * Get all members of a group
   */
  getGroupMembers(groupId: string): GroupMember[] {
    const stmt = this.db.prepare(`
      SELECT id, groupId, userId, joinedAt, role
      FROM group_members
      WHERE groupId = ?
      ORDER BY joinedAt ASC
    `);

    const members = stmt.all(groupId) as any[];
    return members.map(m => ({
      ...m,
      permissions: m.permissions ? JSON.parse(m.permissions) : []
    }));
  }

  /**
   * Get all groups for a user
   */
  getUserGroups(userId: string): Group[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT g.id, g.name, g.description, g.createdBy, g.createdAt, 
                       g.updatedAt, g.profilePicture, g.isEncrypted
      FROM groups g
      JOIN group_members gm ON g.id = gm.groupId
      WHERE gm.userId = ?
      ORDER BY g.updatedAt DESC
    `);

    const groups = stmt.all(userId) as any[];
    return groups.map(g => ({
      ...g,
      isEncrypted: Boolean(g.isEncrypted)
    }));
  }

  // ========== MESSAGE REACTIONS ==========

  /**
   * Add reaction to a message
   */
  addReaction(messageId: string, userId: string, emoji: string): MessageReaction {
    const reactionId = uuidv4();
    const now = new Date().toISOString();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO message_reactions (id, messageId, userId, emoji, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(reactionId, messageId, userId, emoji, now);

      this.logger.debug(`Added reaction ${emoji} to message ${messageId}`);

      return {
        id: reactionId,
        messageId,
        userId,
        emoji,
        createdAt: now
      };
    } catch (error) {
      this.logger.error(`Error adding reaction: ${error}`);
      throw error;
    }
  }

  /**
   * Get all reactions for a message
   */
  getMessageReactions(messageId: string): MessageReaction[] {
    const stmt = this.db.prepare(`
      SELECT id, messageId, userId, emoji, createdAt
      FROM message_reactions
      WHERE messageId = ?
      ORDER BY createdAt ASC
    `);

    return stmt.all(messageId) as MessageReaction[];
  }

  /**
   * Get reaction summary (emoji -> count)
   */
  getReactionSummary(messageId: string): { [emoji: string]: number } {
    const reactions = this.getMessageReactions(messageId);
    const summary: { [emoji: string]: number } = {};

    reactions.forEach(r => {
      summary[r.emoji] = (summary[r.emoji] || 0) + 1;
    });

    return summary;
  }

  /**
   * Remove reaction
   */
  removeReaction(messageId: string, userId: string, emoji: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM message_reactions
      WHERE messageId = ? AND userId = ? AND emoji = ?
    `);

    const result = stmt.run(messageId, userId, emoji);
    return result.changes > 0;
  }

  // ========== FILE SHARING ==========

  /**
   * Store file share metadata
   */
  shareFile(
    fileName: string,
    fileSize: number,
    fileHash: string,
    senderId: string,
    messageId?: string,
    mimeType?: string,
    isPublic: boolean = false
  ): FileShare {
    const fileId = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO file_shares (id, messageId, senderId, fileName, fileSize, fileHash, 
                                mimeType, uploadedAt, downloadCount, isPublic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(fileId, messageId || null, senderId, fileName, fileSize, fileHash, 
             mimeType || null, now, 0, isPublic ? 1 : 0);

    this.logger.info(`Shared file: ${fileName} (${fileHash})`);

    return {
      id: fileId,
      messageId,
      senderId,
      fileName,
      fileSize,
      fileHash,
      mimeType,
      uploadedAt: now,
      downloadCount: 0,
      isPublic
    };
  }

  /**
   * Get file share by hash
   */
  getFileByHash(fileHash: string): FileShare | null {
    const stmt = this.db.prepare(`
      SELECT id, messageId, senderId, fileName, fileSize, fileHash, mimeType, 
             uploadedAt, downloadCount, isPublic
      FROM file_shares
      WHERE fileHash = ?
      LIMIT 1
    `);

    const file = stmt.get(fileHash) as any;
    return file ? { ...file, isPublic: Boolean(file.isPublic) } : null;
  }

  /**
   * Increment download counter
   */
  recordFileDownload(fileHash: string): void {
    const stmt = this.db.prepare(`
      UPDATE file_shares
      SET downloadCount = downloadCount + 1
      WHERE fileHash = ?
    `);

    stmt.run(fileHash);
  }

  /**
   * Get all files shared by user
   */
  getUserFiles(userId: string, limit: number = 100): FileShare[] {
    const stmt = this.db.prepare(`
      SELECT id, messageId, senderId, fileName, fileSize, fileHash, mimeType, 
             uploadedAt, downloadCount, isPublic
      FROM file_shares
      WHERE senderId = ?
      ORDER BY uploadedAt DESC
      LIMIT ?
    `);

    const files = stmt.all(userId, limit) as any[];
    return files.map(f => ({ ...f, isPublic: Boolean(f.isPublic) }));
  }

  // ========== TYPING INDICATORS ==========

  /**
   * Update typing status
   */
  setTypingStatus(userId: string, conversationId: string | null, groupId: string | null, isTyping: boolean): TypingStatus {
    const statusId = uuidv4();
    const now = new Date().toISOString();

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO typing_status (id, userId, conversationId, groupId, isTyping, lastUpdate)
        VALUES (
          COALESCE((SELECT id FROM typing_status WHERE userId = ? AND conversationId IS ? AND groupId IS ?), ?),
          ?, ?, ?, ?, ?
        )
      `);

      stmt.run(userId, conversationId, groupId, statusId, userId, conversationId, groupId, isTyping ? 1 : 0, now);

      return {
        id: statusId,
        userId,
        conversationId: conversationId || undefined,
        groupId: groupId || undefined,
        isTyping,
        lastUpdate: now
      };
    } catch (error) {
      this.logger.error(`Error setting typing status: ${error}`);
      throw error;
    }
  }

  /**
   * Get typing status for conversation/group
   */
  getTypingStatus(conversationId: string | null, groupId: string | null): TypingStatus[] {
    const stmt = this.db.prepare(`
      SELECT id, userId, conversationId, groupId, isTyping, lastUpdate
      FROM typing_status
      WHERE (conversationId IS ? OR groupId IS ?)
      AND isTyping = 1
      AND datetime(lastUpdate) > datetime('now', '-5 seconds')
      ORDER BY lastUpdate DESC
    `);

    return stmt.all(conversationId, groupId) as TypingStatus[];
  }

  // ========== MESSAGE THREADING ==========

  /**
   * Create a reply to a message (threaded message)
   */
  createReply(
    parentMessageId: string,
    conversationId: string,
    senderId: string,
    receiverId: string,
    content: string,
    groupId?: string
  ): any {
    const messageId = uuidv4();
    const now = new Date().toISOString();

    try {
      // Insert the reply message
      const messageStmt = this.db.prepare(`
        INSERT INTO messages (id, conversationId, senderId, receiverId, content, 
                              timestamp, isRead, deliveryStatus, parentMessageId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      messageStmt.run(messageId, conversationId, senderId, receiverId, content, 
                      now, 0, 'sent', parentMessageId);

      // Update thread info
      const threadStmt = this.db.prepare(`
        INSERT OR IGNORE INTO message_threads (id, parentMessageId, conversationId, groupId)
        VALUES (?, ?, ?, ?)
      `);

      threadStmt.run(uuidv4(), parentMessageId, conversationId, groupId || null);

      // Increment reply count
      const updateStmt = this.db.prepare(`
        UPDATE message_threads
        SET replyCount = replyCount + 1, lastReplyAt = ?
        WHERE parentMessageId = ?
      `);

      updateStmt.run(now, parentMessageId);

      this.logger.debug(`Created reply to message ${parentMessageId}`);

      return {
        id: messageId,
        parentMessageId,
        conversationId,
        senderId,
        receiverId,
        content,
        timestamp: now,
        isRead: false,
        deliveryStatus: 'sent'
      };
    } catch (error) {
      this.logger.error(`Error creating reply: ${error}`);
      throw error;
    }
  }

  /**
   * Get all replies to a message
   */
  getMessageReplies(parentMessageId: string): any[] {
    const stmt = this.db.prepare(`
      SELECT id, conversationId, senderId, receiverId, content, timestamp, 
             isRead, deliveryStatus, parentMessageId
      FROM messages
      WHERE parentMessageId = ?
      ORDER BY timestamp ASC
    `);

    return stmt.all(parentMessageId) as any[];
  }

  /**
   * Get thread with all replies
   */
  getThread(parentMessageId: string): any {
    const parentStmt = this.db.prepare(`
      SELECT id, conversationId, senderId, receiverId, content, timestamp, 
             isRead, deliveryStatus
      FROM messages
      WHERE id = ?
      LIMIT 1
    `);

    const parent = parentStmt.get(parentMessageId);
    if (!parent) return null;

    const replies = this.getMessageReplies(parentMessageId);
    const threadInfo = this.db.prepare(`
      SELECT replyCount, lastReplyAt
      FROM message_threads
      WHERE parentMessageId = ?
    `).get(parentMessageId);

    return {
      parent,
      replies,
      stats: threadInfo || { replyCount: 0, lastReplyAt: null }
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

export default EnhancedMessageStore;
