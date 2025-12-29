import Database from 'better-sqlite3';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  encryptedContent?: string;
  timestamp: Date;
  read: boolean;
  encrypted: boolean;
}

export interface Conversation {
  id: string;
  participant1Id: string;
  participant2Id: string;
  createdAt: Date;
  lastMessageAt?: Date;
}

export class MessageStore {
  private db: Database.Database;

  constructor(dbPath: string = './p2p_chatter.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        participant1_id TEXT NOT NULL,
        participant2_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_message_at DATETIME,
        UNIQUE(participant1_id, participant2_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        content TEXT,
        encrypted_content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        read INTEGER DEFAULT 0,
        encrypted INTEGER DEFAULT 0,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id),
        FOREIGN KEY(sender_id) REFERENCES users(id),
        FOREIGN KEY(receiver_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);
  }

  storeMessage(
    conversationId: string,
    senderId: string,
    receiverId: string,
    content: string,
    encrypted: boolean = false
  ): Message {
    const messageId = require('crypto').randomUUID();
    const timestamp = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, receiver_id, content, timestamp, encrypted)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(messageId, conversationId, senderId, receiverId, content, timestamp.toISOString(), encrypted ? 1 : 0);

    // Update conversation last message time
    const updateConv = this.db.prepare(
      'UPDATE conversations SET last_message_at = ? WHERE id = ?'
    );
    updateConv.run(timestamp.toISOString(), conversationId);

    return {
      id: messageId,
      senderId,
      receiverId,
      content,
      timestamp,
      read: false,
      encrypted
    };
  }

  getMessages(conversationId: string, limit: number = 100): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const messages = stmt.all(conversationId, limit) as any[];
    return messages.map(m => ({
      id: m.id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      content: m.content,
      encryptedContent: m.encrypted_content,
      timestamp: new Date(m.timestamp),
      read: m.read === 1,
      encrypted: m.encrypted === 1
    }));
  }

  markAsRead(messageId: string): void {
    const stmt = this.db.prepare('UPDATE messages SET read = 1 WHERE id = ?');
    stmt.run(messageId);
  }

  deleteMessage(messageId: string): void {
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
    stmt.run(messageId);
  }

  createConversation(participant1Id: string, participant2Id: string): Conversation {
    const conversationId = require('crypto').randomUUID();
    const createdAt = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, participant1_id, participant2_id, created_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(conversationId, participant1Id, participant2Id, createdAt.toISOString());

    return {
      id: conversationId,
      participant1Id,
      participant2Id,
      createdAt
    };
  }

  getConversation(participant1Id: string, participant2Id: string): Conversation | null {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE (participant1_id = ? AND participant2_id = ?)
         OR (participant1_id = ? AND participant2_id = ?)
    `);

    const conv = stmt.get(participant1Id, participant2Id, participant2Id, participant1Id) as any;

    if (!conv) return null;

    return {
      id: conv.id,
      participant1Id: conv.participant1_id,
      participant2Id: conv.participant2_id,
      createdAt: new Date(conv.created_at),
      lastMessageAt: conv.last_message_at ? new Date(conv.last_message_at) : undefined
    };
  }

  getUserConversations(userId: string): Conversation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE participant1_id = ? OR participant2_id = ?
      ORDER BY last_message_at DESC NULLS LAST
    `);

    const convs = stmt.all(userId, userId) as any[];
    return convs.map(c => ({
      id: c.id,
      participant1Id: c.participant1_id,
      participant2Id: c.participant2_id,
      createdAt: new Date(c.created_at),
      lastMessageAt: c.last_message_at ? new Date(c.last_message_at) : undefined
    }));
  }

  closeConnection(): void {
    this.db.close();
  }
}

export default MessageStore;
