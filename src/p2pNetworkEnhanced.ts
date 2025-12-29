/**
 * P2P Chatter - Enhanced P2P Network Module
 * Created by antX | Organization: Bad Antics (https://github.com/bad-antics)
 * ©2025 Bad Antics. All rights reserved.
 * 
 * Supports:
 * - Direct peer-to-peer messaging
 * - Group messaging
 * - Peer discovery
 * - Network optimization
 */

import EventEmitter from 'events';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ name: 'EnhancedP2PNetwork' });

export interface PeerInfo {
  id: string;
  publicKey: string;
  ip?: string;
  port?: number;
  status: 'online' | 'offline' | 'idle';
  lastSeen: string;
  version?: string;
}

export interface NetworkMessage {
  id: string;
  type: 'direct' | 'group' | 'broadcast' | 'query';
  from: string;
  to: string | string[]; // single peer or group/broadcast
  content: string;
  timestamp: number;
  ttl: number; // time to live for broadcast
  encrypted: boolean;
  deliveryId?: string;
}

export interface GroupBroadcast {
  id: string;
  groupId: string;
  from: string;
  content: string;
  timestamp: number;
  members: string[]; // target members
}

export interface PeerDiscovery {
  id: string;
  peerId: string;
  peerInfo: PeerInfo;
  discoveredAt: string;
  via?: string; // discovered through peer
}

export class EnhancedP2PNetwork extends EventEmitter {
  private peers: Map<string, PeerInfo> = new Map();
  private messageQueue: Map<string, NetworkMessage> = new Map();
  private deliveryTracking: Map<string, { attempts: number; lastAttempt: number }> = new Map();
  private groupMembers: Map<string, string[]> = new Map(); // groupId -> [peerIds]
  private logger = logger;
  private myPeerId: string;
  private maxRetries: number = 3;
  private retryInterval: number = 5000; // 5 seconds

  constructor(myPeerId?: string, maxRetries: number = 3) {
    super();
    this.myPeerId = myPeerId || uuidv4();
    this.maxRetries = maxRetries;
    this.logger.info(`Initialized P2P network node: ${this.myPeerId}`);
  }

  /**
   * Get our peer ID
   */
  getMyPeerId(): string {
    return this.myPeerId;
  }

  /**
   * Register a peer in the network
   */
  registerPeer(id: string, publicKey: string, ip?: string, port?: number): PeerInfo {
    const peerInfo: PeerInfo = {
      id,
      publicKey,
      ip,
      port,
      status: 'online',
      lastSeen: new Date().toISOString(),
      version: '1.0'
    };

    this.peers.set(id, peerInfo);
    this.logger.info(`Registered peer: ${id}`);
    this.emit('peer:registered', peerInfo);

    return peerInfo;
  }

  /**
   * Update peer status
   */
  updatePeerStatus(peerId: string, status: 'online' | 'offline' | 'idle'): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.status = status;
      peer.lastSeen = new Date().toISOString();
      this.logger.debug(`Updated peer ${peerId} status to ${status}`);
      this.emit('peer:updated', peer);
    }
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
    return Array.from(this.peers.values()).filter(p => p.status === 'online');
  }

  /**
   * Send direct message to a peer
   */
  sendDirectMessage(toPeerId: string, content: string, encrypted: boolean = true): NetworkMessage {
    const messageId = uuidv4();
    const message: NetworkMessage = {
      id: messageId,
      type: 'direct',
      from: this.myPeerId,
      to: toPeerId,
      content,
      timestamp: Date.now(),
      ttl: 0,
      encrypted,
      deliveryId: uuidv4()
    };

    this.messageQueue.set(messageId, message);
    this.deliveryTracking.set(message.deliveryId!, { attempts: 0, lastAttempt: 0 });

    this.logger.debug(`Queued direct message to ${toPeerId}`);
    this.emit('message:queued', message);

    // Attempt delivery
    this.attemptDelivery(message);

    return message;
  }

  /**
   * Send message to a group
   */
  sendGroupMessage(groupId: string, content: string, encrypted: boolean = true): GroupBroadcast {
    const members = this.groupMembers.get(groupId) || [];
    const broadcastId = uuidv4();

    const broadcast: GroupBroadcast = {
      id: broadcastId,
      groupId,
      from: this.myPeerId,
      content,
      timestamp: Date.now(),
      members
    };

    this.logger.info(`Broadcasting to group ${groupId} (${members.length} members)`);
    this.emit('group:message', broadcast);

    // Send to each member
    members.forEach(memberId => {
      this.sendDirectMessage(memberId, content, encrypted);
    });

    return broadcast;
  }

  /**
   * Broadcast message to all peers (flooding)
   */
  broadcastMessage(content: string, ttl: number = 5): NetworkMessage {
    const messageId = uuidv4();
    const message: NetworkMessage = {
      id: messageId,
      type: 'broadcast',
      from: this.myPeerId,
      to: 'broadcast',
      content,
      timestamp: Date.now(),
      ttl,
      encrypted: true
    };

    this.messageQueue.set(messageId, message);
    this.logger.info(`Broadcasting message (TTL: ${ttl})`);
    this.emit('message:broadcast', message);

    return message;
  }

  /**
   * Add member to group
   */
  addGroupMember(groupId: string, peerId: string): void {
    const members = this.groupMembers.get(groupId) || [];
    if (!members.includes(peerId)) {
      members.push(peerId);
      this.groupMembers.set(groupId, members);
      this.logger.debug(`Added ${peerId} to group ${groupId}`);
      this.emit('group:memberAdded', { groupId, peerId });
    }
  }

  /**
   * Remove member from group
   */
  removeGroupMember(groupId: string, peerId: string): void {
    const members = this.groupMembers.get(groupId) || [];
    const index = members.indexOf(peerId);
    if (index > -1) {
      members.splice(index, 1);
      this.groupMembers.set(groupId, members);
      this.logger.debug(`Removed ${peerId} from group ${groupId}`);
      this.emit('group:memberRemoved', { groupId, peerId });
    }
  }

  /**
   * Get group members
   */
  getGroupMembers(groupId: string): string[] {
    return this.groupMembers.get(groupId) || [];
  }

  /**
   * Attempt to deliver queued messages
   */
  private attemptDelivery(message: NetworkMessage): void {
    const deliveryId = message.deliveryId!;
    const tracking = this.deliveryTracking.get(deliveryId);

    if (!tracking) return;

    if (tracking.attempts >= this.maxRetries) {
      this.logger.warn(`Message ${message.id} exceeded max retries`);
      this.emit('message:failed', { messageId: message.id, reason: 'max_retries' });
      return;
    }

    tracking.attempts++;
    tracking.lastAttempt = Date.now();

    // In real implementation, would attempt actual network delivery
    // For now, simulate successful delivery
    setTimeout(() => {
      this.logger.debug(`Message ${message.id} delivered`);
      this.emit('message:delivered', { messageId: message.id, deliveryId });
    }, 100);
  }

  /**
   * Handle incoming message
   */
  receiveMessage(message: NetworkMessage): void {
    if (message.to !== this.myPeerId && message.type !== 'broadcast') {
      this.logger.warn(`Message not for us: ${message.id}`);
      return;
    }

    this.logger.info(`Received message from ${message.from}`);
    this.emit('message:received', message);

    // If broadcast and TTL > 0, relay to other peers
    if (message.type === 'broadcast' && message.ttl > 0) {
      this.relayBroadcast(message);
    }
  }

  /**
   * Relay broadcast message to other peers
   */
  private relayBroadcast(message: NetworkMessage): void {
    const relayedMessage: NetworkMessage = {
      ...message,
      ttl: message.ttl - 1
    };

    this.logger.debug(`Relaying broadcast (TTL: ${relayedMessage.ttl})`);

    const onlinePeers = this.getOnlinePeers();
    onlinePeers.forEach(peer => {
      if (peer.id !== message.from) {
        // Simulate relay (in real impl, would send over network)
        this.emit('message:relay', { message: relayedMessage, to: peer.id });
      }
    });
  }

  /**
   * Query network for a peer
   */
  queryPeer(peerId: string): Promise<PeerInfo | undefined> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(undefined);
      }, 5000);

      const peer = this.peers.get(peerId);
      if (peer && peer.status === 'online') {
        clearTimeout(timeout);
        resolve(peer);
      } else {
        // Broadcast query
        const queryMsg = this.broadcastMessage(`QUERY:${peerId}`, 3);
        this.emit('network:query', { queryId: queryMsg.id, peerId });

        clearTimeout(timeout);
        resolve(undefined);
      }
    });
  }

  /**
   * Discover peers (could integrate with DHT later)
   */
  discoverPeers(): PeerDiscovery[] {
    const discoveries: PeerDiscovery[] = [];

    this.peers.forEach((peer, peerId) => {
      discoveries.push({
        id: uuidv4(),
        peerId,
        peerInfo: peer,
        discoveredAt: new Date().toISOString()
      });
    });

    this.logger.info(`Discovered ${discoveries.length} peers`);
    this.emit('peers:discovered', discoveries);

    return discoveries;
  }

  /**
   * Get network statistics
   */
  getStats(): {
    totalPeers: number;
    onlinePeers: number;
    messageQueued: number;
    groups: number;
    myPeerId: string;
  } {
    return {
      totalPeers: this.peers.size,
      onlinePeers: this.getOnlinePeers().length,
      messageQueued: this.messageQueue.size,
      groups: this.groupMembers.size,
      myPeerId: this.myPeerId
    };
  }

  /**
   * Clear old messages from queue
   */
  clearOldMessages(ageMs: number = 3600000): void {
    const now = Date.now();
    let cleared = 0;

    this.messageQueue.forEach((msg, id) => {
      if (now - msg.timestamp > ageMs) {
        this.messageQueue.delete(id);
        cleared++;
      }
    });

    this.logger.debug(`Cleared ${cleared} old messages`);
  }
}

export default EnhancedP2PNetwork;
