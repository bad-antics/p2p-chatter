/**
 * P2P Chatter - P2P Network Layer
 * Created by antX | Organization: Bad Antics (https://github.com/bad-antics)
 * ©2025 Bad Antics. All rights reserved.
 * 
 * Handles peer-to-peer networking, message routing, and Tor/VPN integration
 */

import pino from 'pino';
import TorService, { ConnectionMode } from './torService';
import { EventEmitter } from 'events';

const logger = pino({ name: 'P2PNetwork' });

export interface PeerInfo {
  id: string;
  publicKey: string;
  addresses: string[];
  lastSeen: number;
  status: 'online' | 'offline' | 'pending';
}

export interface NetworkMessage {
  id: string;
  from: string;
  to: string;
  type: 'message' | 'presence' | 'sync' | 'acknowledgement';
  payload: any;
  timestamp: number;
  signature: string;
}

export class P2PNetwork extends EventEmitter {
  private peers: Map<string, PeerInfo> = new Map();
  private messageHandlers: Map<string, Function> = new Map();
  private isConnected: boolean = false;
  private torService = TorService;
  private connectionMode: 'direct' | 'tor' | 'vpn' | 'tor+vpn' = 'direct';

  constructor() {
    super();
    logger.info('P2P Network initialized');
    this.setupTorHandlers();
  }

  /**
   * Setup Tor service event handlers
   */
  private setupTorHandlers(): void {
    this.torService.on('tor-enabled', (config) => {
      logger.info('Tor enabled for P2P routing');
      this.emit('tor-enabled', config);
    });

    this.torService.on('vpn-enabled', (config) => {
      logger.info('VPN enabled for P2P routing');
      this.emit('vpn-enabled', config);
    });

    this.torService.on('connected', (info) => {
      logger.info('Network tunnel established', info);
      this.emit('tunnel-established', info);
    });

    this.torService.on('disconnected', () => {
      logger.info('Network tunnel disconnected');
      this.emit('tunnel-disconnected');
    });
  }

  /**
   * Set connection mode (direct, Tor, VPN, or Tor+VPN)
   */
  setConnectionMode(mode: 'direct' | 'tor' | 'vpn' | 'tor+vpn'): void {
    this.connectionMode = mode;
    this.torService.setConnectionMode(mode);
    logger.info({ mode }, 'P2P connection mode changed');
    this.emit('mode-changed', { mode });
  }

  /**
   * Get current connection mode
   */
  getConnectionMode(): {
    mode: string;
    status: any;
    optimization: any;
  } {
    return {
      mode: this.connectionMode,
      status: this.torService.getConnectionStatus(),
      optimization: this.torService.getRoutingOptimization(),
    };
  }

  /**
   * Connect to P2P network with selected tunnel
   */
  async connect(peerId: string): Promise<boolean> {
    try {
      logger.info({ peerId, mode: this.connectionMode }, 'Connecting to P2P network');

      // Connect Tor/VPN tunnel if enabled
      if (this.connectionMode !== 'direct') {
        await this.torService.connect();
      }

      this.isConnected = true;
      logger.info('P2P network connected');
      this.emit('connected', { peerId, mode: this.connectionMode });
      return true;
    } catch (error) {
      logger.error(error, 'P2P connection failed');
      this.emit('connection-failed', { error });
      return false;
    }
  }

  /**
   * Disconnect from P2P network
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from P2P network');
    await this.torService.disconnect();
    this.isConnected = false;
    this.emit('disconnected');
  }

  /**
   * Register a message handler
   */
  registerHandler(messageType: string, handler: (message: NetworkMessage) => void): P2PNetwork {
    this.messageHandlers.set(messageType, handler);
    logger.debug({ messageType }, 'Handler registered');
    return this;
  }

  /**
   * Emit a message to a peer
   */
  async send(message: NetworkMessage): Promise<void> {
    const peer = this.peers.get(message.to);
    
    if (!peer) {
      throw new Error(`Peer not found: ${message.to}`);
    }

    if (peer.status !== 'online') {
      logger.warn({ peerId: message.to }, 'Peer is offline');
      // Queue for later delivery
      return;
    }

    logger.debug({ messageId: message.id, to: message.to }, 'Sending message');
    
    // In a real implementation, this would use libp2p or similar
    // For now, this is a placeholder
  }

  /**
   * Add a peer to the network
   */
  addPeer(peerInfo: PeerInfo): void {
    this.peers.set(peerInfo.id, peerInfo);
    logger.info({ peerId: peerInfo.id }, 'Peer added');
  }

  /**
   * Remove a peer from the network
   */
  removePeer(peerId: string): void {
    this.peers.delete(peerId);
    logger.info({ peerId }, 'Peer removed');
  }

  /**
   * Get peer info
   */
  getPeer(peerId: string): PeerInfo | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Get all online peers
   */
  getOnlinePeers(): PeerInfo[] {
    return Array.from(this.peers.values()).filter(peer => peer.status === 'online');
  }

  /**
   * Update peer status
   */
  updatePeerStatus(peerId: string, status: 'online' | 'offline' | 'pending'): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.status = status;
      peer.lastSeen = Date.now();
      logger.debug({ peerId, status }, 'Peer status updated');
    }
  }

  /**
   * Check if connected
   */
  isNetworkConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Broadcast a message to all peers
   */
  async broadcast(message: NetworkMessage): Promise<void> {
    const peers = this.getOnlinePeers();
    logger.debug({ peerCount: peers.length }, 'Broadcasting message');
    
    for (const peer of peers) {
      message.to = peer.id;
      await this.send(message);
    }
  }
}
