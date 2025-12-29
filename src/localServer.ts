/**
 * P2P Chatter - Local HTTP Server & WebSocket Hub
 * Created by antX | Organization: Bad Antics (https://github.com/bad-antics)
 * ©2025 Bad Antics. All rights reserved.
 * 
 * Hosts p2p chatter locally with REST API and WebSocket messaging
 */

import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';
import WebSocket, { Server as WebSocketServer } from 'ws';
import http from 'http';
import pino from 'pino';
import { DatabaseManager } from './database';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ name: 'LocalServer' });

interface ConnectedClient {
  userId: string;
  username: string;
  ws: WebSocket;
  connectedAt: number;
}

export class LocalChatServer {
  private app: Express;
  private server: http.Server;
  private wss: WebSocketServer;
  private db: DatabaseManager;
  private connectedClients: Map<string, ConnectedClient> = new Map();
  private port: number;

  constructor(port: number = 3000, db?: DatabaseManager) {
    this.port = port;
    this.db = db || new DatabaseManager();
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
  }

  /**
   * Setup REST API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'online',
        timestamp: Date.now(),
        connectedUsers: this.connectedClients.size
      });
    });

    // User registration
    this.app.post('/api/register', (req: Request, res: Response) => {
      try {
        const { username, publicKey, profilePicture, status } = req.body;

        if (!username || !publicKey) {
          return res.status(400).json({ error: 'Username and publicKey required' });
        }

        // Check if username exists
        const existing = this.db.getUserByUsername(username);
        if (existing) {
          return res.status(409).json({ error: 'Username already taken' });
        }

        const userId = uuidv4();
        const passwordHash = crypto.randomBytes(32).toString('hex');

        this.db.storeUser({
          id: userId,
          username,
          passwordHash,
          publicKey,
          createdAt: Date.now(),
          lastActive: Date.now(),
          profilePicture,
          status
        }, 1); // 1 hour expiry

        // Publish to directory
        this.db.publishToDirectory(userId, username, publicKey);

        res.status(201).json({
          userId,
          username,
          sessionToken: this.generateSessionToken(userId, username)
        });

        logger.info({ username }, 'User registered');
      } catch (error) {
        logger.error({ error }, 'Registration failed');
        res.status(500).json({ error: 'Registration failed' });
      }
    });

    // Search user directory
    this.app.get('/api/directory/search', (req: Request, res: Response) => {
      try {
        const { query } = req.query;

        if (!query || typeof query !== 'string') {
          return res.status(400).json({ error: 'Query parameter required' });
        }

        const results = this.db.searchDirectory(query);
        res.json({ results });

        logger.debug({ query, count: results.length }, 'Directory search');
      } catch (error) {
        logger.error({ error }, 'Directory search failed');
        res.status(500).json({ error: 'Search failed' });
      }
    });

    // Get user info
    this.app.get('/api/user/:userId', (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        const user = this.db.getUserById(userId);

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({
          id: user.id,
          username: user.username,
          publicKey: user.publicKey,
          profilePicture: user.profilePicture,
          status: user.status,
          createdAt: user.createdAt
        });
      } catch (error) {
        logger.error({ error }, 'Failed to fetch user');
        res.status(500).json({ error: 'Failed to fetch user' });
      }
    });

    // Start conversation
    this.app.post('/api/conversation/start', (req: Request, res: Response) => {
      try {
        const { userId, targetUserId } = req.body;

        if (!userId || !targetUserId) {
          return res.status(400).json({ error: 'userId and targetUserId required' });
        }

        const user = this.db.getUserById(userId);
        const targetUser = this.db.getUserById(targetUserId);

        if (!user || !targetUser) {
          return res.status(404).json({ error: 'User not found' });
        }

        const conversationId = uuidv4();
        this.db.storeConversation({
          id: conversationId,
          user1Id: userId,
          user2Id: targetUserId,
          createdAt: Date.now(),
          lastMessageTime: Date.now()
        }, 1); // 1 hour expiry

        res.status(201).json({
          conversationId,
          participants: [
            { id: user.id, username: user.username },
            { id: targetUser.id, username: targetUser.username }
          ]
        });

        logger.info({ conversationId }, 'Conversation started');
      } catch (error) {
        logger.error({ error }, 'Conversation start failed');
        res.status(500).json({ error: 'Failed to start conversation' });
      }
    });
  }

  /**
   * Setup WebSocket handlers
   */
  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      logger.debug('WebSocket client connected');

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          this.handleWebSocketMessage(message, ws);
        } catch (error) {
          logger.error({ error }, 'WebSocket message parse failed');
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
        }
      });

      ws.on('close', () => {
        // Remove from connected clients
        let userId = '';
        for (const [id, client] of this.connectedClients.entries()) {
          if (client.ws === ws) {
            userId = id;
            this.connectedClients.delete(id);
            break;
          }
        }
        logger.debug({ userId }, 'WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        logger.error({ error }, 'WebSocket error');
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(message: any, ws: WebSocket): void {
    const { type, userId, username, conversationId, content, targetUserId } = message;

    switch (type) {
      case 'auth':
        this.handleAuth(userId, username, ws);
        break;

      case 'chat':
        this.handleChatMessage(userId, conversationId, targetUserId, content);
        break;

      case 'typing':
        this.broadcastTyping(userId, conversationId);
        break;

      default:
        logger.debug({ type }, 'Unknown WebSocket message type');
    }
  }

  /**
   * Handle WebSocket authentication
   */
  private handleAuth(userId: string, username: string, ws: WebSocket): void {
    const user = this.db.getUserById(userId);

    if (!user) {
      ws.send(JSON.stringify({ type: 'auth_failed', message: 'User not found' }));
      return;
    }

    this.connectedClients.set(userId, {
      userId,
      username,
      ws,
      connectedAt: Date.now()
    });

    ws.send(JSON.stringify({
      type: 'auth_success',
      message: `Welcome, ${username}!`,
      userId,
      connectedUsers: this.connectedClients.size
    }));

    logger.info({ username }, 'User authenticated via WebSocket');
  }

  /**
   * Handle incoming chat messages
   */
  private handleChatMessage(senderId: string, conversationId: string, targetUserId: string, content: string): void {
    const sender = this.db.getUserById(senderId);
    const target = this.db.getUserById(targetUserId);

    if (!sender || !target) {
      logger.warn({ senderId, targetUserId }, 'Invalid users for chat message');
      return;
    }

    const messageId = uuidv4();
    const timestamp = Date.now();

    // Store message
    this.db.storeMessage({
      id: messageId,
      conversationId,
      senderId,
      receiverId: targetUserId,
      content,
      encryptedContent: content, // Should be encrypted in actual implementation
      timestamp,
      isRead: 0
    }, 1); // 1 hour expiry

    // Send to target user if connected
    const targetClient = this.connectedClients.get(targetUserId);
    if (targetClient) {
      targetClient.ws.send(JSON.stringify({
        type: 'message',
        messageId,
        conversationId,
        senderId,
        senderName: sender.username,
        content,
        timestamp
      }));
    }

    logger.debug({ messageId, senderId, targetUserId }, 'Chat message sent');
  }

  /**
   * Broadcast typing indicator
   */
  private broadcastTyping(userId: string, conversationId: string): void {
    const sender = this.db.getUserById(userId);
    if (!sender) return;

    const message = {
      type: 'typing',
      userId,
      username: sender.username,
      conversationId
    };

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Generate session token
   */
  private generateSessionToken(userId: string, username: string): string {
    const token = {
      userId,
      username,
      iat: Date.now(),
      exp: Date.now() + 60 * 60 * 1000 // 1 hour
    };

    return Buffer.from(JSON.stringify(token)).toString('base64');
  }

  /**
   * Start the server
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        logger.info({ port: this.port }, 'Local chat server started');
        resolve();
      });
    });
  }

  /**
   * Stop the server and cleanup
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all WebSocket connections
      this.wss.clients.forEach((client) => {
        client.close();
      });

      // Close HTTP server
      this.server.close(() => {
        logger.info('Local chat server stopped');
        resolve();
      });
    });
  }

  /**
   * Get connected clients count
   */
  getConnectedCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get database instance
   */
  getDatabase(): DatabaseManager {
    return this.db;
  }
}

export default LocalChatServer;
