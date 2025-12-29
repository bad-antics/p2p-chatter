import pino from 'pino';
import { IdentityManager, UserProfile } from './identity';
import { EncryptionManager, EncryptedMessage } from './encryption';
import { MessageStore, Message } from './messageStore';
import { P2PNetwork, NetworkMessage, PeerInfo } from './p2pNetwork';
import { v4 as uuidv4 } from 'uuid';

/**
 * P2P Chatter - Main Application
 * Orchestrates identity, encryption, messaging, and P2P networking
 */

const logger = pino({ name: 'P2PChatter' });

export class P2PChatter {
  private identity: IdentityManager;
  private messageStore: MessageStore;
  private network: P2PNetwork;
  private currentUser: UserProfile | null = null;

  constructor(
    identityDbPath: string = './data/identity.db',
    messageDbPath: string = './data/messages.db'
  ) {
    this.identity = new IdentityManager(identityDbPath);
    this.messageStore = new MessageStore(messageDbPath);
    this.network = new P2PNetwork();

    this.setupMessageHandlers();
    logger.info('P2P Chatter initialized');
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    this.network.on('message', (msg: NetworkMessage) => this.handleIncomingMessage(msg));
    this.network.on('presence', (msg: NetworkMessage) => this.handlePresenceUpdate(msg));
    this.network.on('acknowledgement', (msg: NetworkMessage) => this.handleAcknowledgement(msg));
  }

  /**
   * Create a new user account
   */
  async createAccount(username: string, profilePicture?: string, status?: string): Promise<UserProfile> {
    logger.info({ username }, 'Creating new account');
    
    const user = this.identity.createUser(username, profilePicture, status);
    this.currentUser = user;

    // Connect to P2P network with this identity
    await this.network.connect(user.id);

    return user;
  }

  /**
   * Load existing user account
   */
  async loadAccount(userId: string): Promise<UserProfile | null> {
    logger.info({ userId }, 'Loading account');
    
    const user = this.identity.loadUser(userId);
    if (user) {
      this.currentUser = user;
      await this.network.connect(user.id);
      return user;
    }

    return null;
  }

  /**
   * Add a contact
   */
  addContact(contactPublicKey: string, username: string, displayName?: string): string {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    logger.info({ username }, 'Adding contact');
    return this.identity.addContact(contactPublicKey, username, displayName);
  }

  /**
   * Get all contacts
   */
  getContacts(): any[] {
    return this.identity.getContacts();
  }

  /**
   * Send a message to a contact
   */
  async sendMessage(contactId: string, content: string): Promise<string> {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    logger.info({ contactId }, 'Sending message');

    // Get contact details
    const contact = this.identity.getContact(contactId);
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }

    // Derive shared secret
    const sharedSecret = EncryptionManager.deriveSharedSecret(
      this.currentUser.privateKey!,
      contact.publicKey
    );

    // Encrypt message
    const encrypted = EncryptionManager.encryptMessage(content, sharedSecret);
    encrypted.senderPublicKey = this.currentUser.publicKey;

    // Sign the message
    const messageToSign = JSON.stringify({
      content,
      timestamp: encrypted.timestamp,
      senderId: this.currentUser.id
    });
    const signature = EncryptionManager.signMessage(messageToSign, this.currentUser.privateKey!);

    // Create message object
    const conversationId = this.messageStore.getOrCreateConversation(
      this.currentUser.id,
      contactId
    );

    const message: Message = {
      id: uuidv4(),
      conversationId,
      senderId: this.currentUser.id,
      receiverId: contactId,
      content,
      contentHash: EncryptionManager.hashMessage(content),
      timestamp: encrypted.timestamp,
      isRead: false,
      deliveryStatus: 'pending',
      encryptedContent: encrypted.ciphertext,
      nonce: encrypted.nonce
    };

    // Store message locally
    this.messageStore.storeMessage(message);

    // Create network message
    const networkMessage: NetworkMessage = {
      id: uuidv4(),
      from: this.currentUser.id,
      to: contactId,
      type: 'message',
      payload: {
        messageId: message.id,
        encryptedContent: encrypted.ciphertext,
        nonce: encrypted.nonce,
        senderPublicKey: encrypted.senderPublicKey,
        timestamp: encrypted.timestamp,
        signature
      },
      timestamp: Date.now(),
      signature
    };

    // Send over P2P network
    await this.network.send(networkMessage);

    logger.info({ messageId: message.id, contactId }, 'Message sent');
    return message.id;
  }

  /**
   * Get conversation messages
   */
  getConversationMessages(contactId: string, limit: number = 50): Message[] {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    const conversationId = `${this.currentUser.id}:${contactId}`;
    return this.messageStore.getConversationMessages(conversationId, limit);
  }

  /**
   * Handle incoming message
   */
  private handleIncomingMessage(msg: NetworkMessage): void {
    if (!this.currentUser) {
      logger.warn('Received message but no user logged in');
      return;
    }

    logger.info({ messageId: msg.id, from: msg.from }, 'Incoming message');

    // Verify sender
    const contact = this.identity.getContact(msg.from);
    if (!contact) {
      logger.warn({ from: msg.from }, 'Message from unknown contact');
      return;
    }

    // Verify signature
    const messageToVerify = JSON.stringify({
      content: msg.payload.content,
      timestamp: msg.payload.timestamp,
      senderId: msg.from
    });

    const isValid = EncryptionManager.verifySignature(
      messageToVerify,
      msg.payload.signature,
      contact.publicKey
    );

    if (!isValid) {
      logger.warn({ messageId: msg.id }, 'Invalid signature');
      return;
    }

    // Derive shared secret to decrypt
    const sharedSecret = EncryptionManager.deriveSharedSecret(
      this.currentUser.privateKey!,
      contact.publicKey
    );

    try {
      const decrypted = EncryptionManager.decryptMessage(
        {
          ciphertext: msg.payload.encryptedContent,
          nonce: msg.payload.nonce,
          senderPublicKey: msg.payload.senderPublicKey,
          timestamp: msg.payload.timestamp
        },
        sharedSecret
      );

      // Store message
      const conversationId = this.messageStore.getOrCreateConversation(
        msg.from,
        this.currentUser.id
      );

      const message: Message = {
        id: msg.payload.messageId,
        conversationId,
        senderId: msg.from,
        receiverId: this.currentUser.id,
        content: decrypted,
        contentHash: EncryptionManager.hashMessage(decrypted),
        timestamp: msg.payload.timestamp,
        isRead: false,
        deliveryStatus: 'delivered',
        encryptedContent: msg.payload.encryptedContent,
        nonce: msg.payload.nonce
      };

      this.messageStore.storeMessage(message);

      // Send acknowledgement
      this.sendAcknowledgement(msg.id, msg.from);
    } catch (error) {
      logger.error({ error, messageId: msg.id }, 'Failed to decrypt message');
    }
  }

  /**
   * Handle presence update
   */
  private handlePresenceUpdate(msg: NetworkMessage): void {
    logger.debug({ from: msg.from }, 'Presence update');
    this.network.updatePeerStatus(msg.from, msg.payload.status);
  }

  /**
   * Handle acknowledgement
   */
  private handleAcknowledgement(msg: NetworkMessage): void {
    logger.debug({ messageId: msg.payload.messageId }, 'Message acknowledged');
    this.messageStore.updateDeliveryStatus(msg.payload.messageId, 'delivered');
  }

  /**
   * Send acknowledgement
   */
  private async sendAcknowledgement(messageId: string, recipientId: string): Promise<void> {
    if (!this.currentUser) {
      return;
    }

    const ackMessage: NetworkMessage = {
      id: uuidv4(),
      from: this.currentUser.id,
      to: recipientId,
      type: 'acknowledgement',
      payload: {
        messageId
      },
      timestamp: Date.now(),
      signature: ''
    };

    await this.network.send(ackMessage);
  }

  /**
   * Publish presence (online/offline)
   */
  async publishPresence(status: 'online' | 'offline'): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    logger.info({ status }, 'Publishing presence');

    const presenceMessage: NetworkMessage = {
      id: uuidv4(),
      from: this.currentUser.id,
      to: '', // Broadcast
      type: 'presence',
      payload: {
        status,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      signature: ''
    };

    await this.network.broadcast(presenceMessage);
  }

  /**
   * Get current user
   */
  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  /**
   * Shutdown application
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down P2P Chatter');
    
    if (this.currentUser) {
      await this.publishPresence('offline');
    }

    await this.network.disconnect();
    this.identity.close();
    this.messageStore.close();
  }
}

// Main entry point
export async function main(): Promise<void> {
  try {
    const app = new P2PChatter();

    // Example: Create new account
    const user = await app.createAccount('Alice', undefined, 'Hey, this is Alice!');
    console.log('Created user:', user.username);

    // Example: Add contact (would be done via QR code or public key sharing)
    // const contactId = app.addContact(bobPublicKey, 'Bob', 'Bob (Work)');

    // Example: Send message
    // const messageId = await app.sendMessage(contactId, 'Hello Bob!');

    // Example: Get messages
    // const messages = app.getConversationMessages(contactId);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await app.shutdown();
      process.exit(0);
    });
  } catch (error) {
    logger.error(error, 'Fatal error');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
