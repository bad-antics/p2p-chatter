import pino from 'pino';
import Database from 'better-sqlite3';

/**
 * P2P Chatter - Message Storage
 * Handles message persistence and retrieval
 */

const logger = pino({ name: 'MessageStore' });

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  contentHash: string;
  timestamp: number;
  isRead: boolean;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'failed';
  encryptedContent: string;
  nonce: string;
}

export class MessageStore {
  private db: Database.Database;

  constructor(dbPath: string = './data/messages.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  /**
   * Initialize database tables
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        contactId TEXT NOT NULL,
        lastMessageTime INTEGER,
        createdAt INTEGER NOT NULL,
        UNIQUE(userId, contactId)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversationId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        receiverId TEXT NOT NULL,
        content TEXT,
        contentHash TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        isRead BOOLEAN DEFAULT 0,
        deliveryStatus TEXT DEFAULT 'pending',
        encryptedContent TEXT NOT NULL,
        nonce TEXT NOT NULL,
        FOREIGN KEY (conversationId) REFERENCES conversations(id),
        INDEX idx_conversation (conversationId),
        INDEX idx_timestamp (timestamp)
      );

      CREATE TABLE IF NOT EXISTS message_attachments (
        id TEXT PRIMARY KEY,
        messageId TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileType TEXT NOT NULL,
        fileSize INTEGER NOT NULL,
        filePath TEXT NOT NULL,
        uploadedAt INTEGER NOT NULL,
        FOREIGN KEY (messageId) REFERENCES messages(id)
      );
    `);
  }

  /**
   * Store a message
   */
  storeMessage(message: Message): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages 
      (id, conversationId, senderId, receiverId, content, contentHash, timestamp, isRead, deliveryStatus, encryptedContent, nonce)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.conversationId,
      message.senderId,
      message.receiverId,
      message.content,
      message.contentHash,
      message.timestamp,
      message.isRead ? 1 : 0,
      message.deliveryStatus,
      message.encryptedContent,
      message.nonce
    );

    // Update conversation last message time
    this.updateConversationLastMessage(message.conversationId, message.timestamp);
    logger.debug({ messageId: message.id }, 'Message stored');
  }

  /**
   * Get messages in a conversation
   */
  getConversationMessages(conversationId: string, limit: number = 50, offset: number = 0): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversationId = ? 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(conversationId, limit, offset) as any[];
    return rows.map(row => ({
      ...row,
      isRead: Boolean(row.isRead)
    }));
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId: string): void {
    const stmt = this.db.prepare('UPDATE messages SET isRead = 1 WHERE id = ?');
    stmt.run(messageId);
    logger.debug({ messageId }, 'Message marked as read');
  }

  /**
   * Update message delivery status
   */
  updateDeliveryStatus(messageId: string, status: 'pending' | 'sent' | 'delivered' | 'failed'): void {
    const stmt = this.db.prepare('UPDATE messages SET deliveryStatus = ? WHERE id = ?');
    stmt.run(status, messageId);
    logger.debug({ messageId, status }, 'Delivery status updated');
  }

  /**
   * Get or create conversation
   */
  getOrCreateConversation(userId: string, contactId: string): string {
    const conversationId = this.getConversationId(userId, contactId);
    
    if (conversationId) {
      return conversationId;
    }

    const id = `${userId}:${contactId}`;
    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, userId, contactId, createdAt)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, userId, contactId, Date.now());
    logger.info({ id }, 'Conversation created');
    
    return id;
  }

  /**
   * Get conversation ID
   */
  private getConversationId(userId: string, contactId: string): string | null {
    const stmt = this.db.prepare(`
      SELECT id FROM conversations 
      WHERE (userId = ? AND contactId = ?) 
      OR (userId = ? AND contactId = ?)
    `);

    const result = stmt.get(userId, contactId, contactId, userId) as any;
    return result?.id || null;
  }

  /**
   * Update conversation last message time
   */
  private updateConversationLastMessage(conversationId: string, timestamp: number): void {
    const stmt = this.db.prepare('UPDATE conversations SET lastMessageTime = ? WHERE id = ?');
    stmt.run(timestamp, conversationId);
  }

  /**
   * Get unread message count
   */
  getUnreadCount(conversationId: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversationId = ? AND isRead = 0');
    const result = stmt.get(conversationId) as any;
    return result?.count || 0;
  }

  /**
   * Delete message
   */
  deleteMessage(messageId: string): void {
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
    stmt.run(messageId);
    logger.debug({ messageId }, 'Message deleted');
  }

  /**
   * Search messages
   */
  searchMessages(conversationId: string, query: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversationId = ? AND content LIKE ? 
      ORDER BY timestamp DESC
    `);

    const rows = stmt.all(conversationId, `%${query}%`) as any[];
    return rows.map(row => ({
      ...row,
      isRead: Boolean(row.isRead)
    }));
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
