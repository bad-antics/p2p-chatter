/**
 * P2P Chatter - Message Storage Module
 * Created by antX | Organization: Bad Antics (https://github.com/bad-antics)
 * ©2025 Bad Antics. All rights reserved.
 * 
 * Handles message persistence and retrieval (in-memory implementation)
 */

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

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

export interface Conversation {
  id: string;
  userId: string;
  contactId: string;
  lastMessageTime?: number;
  createdAt: number;
}

export class MessageStore {
  private messages: Map<string, Message> = new Map();
  private conversations: Map<string, Conversation> = new Map();
  private conversationMessages: Map<string, Message[]> = new Map();

  constructor(dbPath?: string) {
    logger.info('MessageStore initialized (in-memory)');
  }

  /**
   * Store a message
   */
  storeMessage(message: Message): void {
    this.messages.set(message.id, message);
    
    // Store in conversation messages
    if (!this.conversationMessages.has(message.conversationId)) {
      this.conversationMessages.set(message.conversationId, []);
    }
    this.conversationMessages.get(message.conversationId)!.push(message);
    
    // Update conversation last message time
    this.updateConversationLastMessage(message.conversationId, message.timestamp);
    logger.debug({ messageId: message.id }, 'Message stored');
  }

  /**
   * Get messages in a conversation
   */
  getConversationMessages(conversationId: string, limit: number = 50, offset: number = 0): Message[] {
    const messages = this.conversationMessages.get(conversationId) || [];
    // Sort by timestamp descending and apply limit/offset
    return messages
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit);
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId: string): void {
    const message = this.messages.get(messageId);
    if (message) {
      message.isRead = true;
      logger.debug({ messageId }, 'Message marked as read');
    }
  }

  /**
   * Update message delivery status
   */
  updateDeliveryStatus(messageId: string, status: 'pending' | 'sent' | 'delivered' | 'failed'): void {
    const message = this.messages.get(messageId);
    if (message) {
      message.deliveryStatus = status;
      logger.debug({ messageId, status }, 'Delivery status updated');
    }
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
    const conversation: Conversation = {
      id,
      userId,
      contactId,
      createdAt: Date.now()
    };

    this.conversations.set(id, conversation);
    this.conversationMessages.set(id, []);
    logger.info({ id }, 'Conversation created');
    
    return id;
  }

  /**
   * Get conversation ID
   */
  private getConversationId(userId: string, contactId: string): string | null {
    for (const [id, conv] of this.conversations.entries()) {
      if ((conv.userId === userId && conv.contactId === contactId) ||
          (conv.userId === contactId && conv.contactId === userId)) {
        return id;
      }
    }
    return null;
  }

  /**
   * Update conversation last message time
   */
  private updateConversationLastMessage(conversationId: string, timestamp: number): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.lastMessageTime = timestamp;
    }
  }

  /**
   * Get unread message count
   */
  getUnreadCount(conversationId: string): number {
    const messages = this.conversationMessages.get(conversationId) || [];
    return messages.filter(m => !m.isRead).length;
  }

  /**
   * Delete message
   */
  deleteMessage(messageId: string): void {
    const message = this.messages.get(messageId);
    if (message) {
      this.messages.delete(messageId);
      const messages = this.conversationMessages.get(message.conversationId);
      if (messages) {
        const index = messages.findIndex(m => m.id === messageId);
        if (index > -1) {
          messages.splice(index, 1);
        }
      }
      logger.debug({ messageId }, 'Message deleted');
    }
  }

  /**
   * Search messages
   */
  searchMessages(conversationId: string, query: string): Message[] {
    const messages = this.conversationMessages.get(conversationId) || [];
    const lowerQuery = query.toLowerCase();
    return messages
      .filter(m => m.content.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Close (no-op for in-memory implementation)
   */
  close(): void {
    logger.info('MessageStore closed');
  }
}
