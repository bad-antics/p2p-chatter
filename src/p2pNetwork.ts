import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { EncryptionService } from './encryption';

export interface P2PMessage {
  id: string;
  from: string;
  to: string;
  type: 'message' | 'ping' | 'pong' | 'key_exchange';
  payload: any;
  encrypted: boolean;
  timestamp: number;
  signature?: string;
}

export interface P2PPeer {
  id: string;
  publicKey: string;
  connected: boolean;
  lastSeen: Date;
}

export class P2PNetwork extends EventEmitter {
  private peers: Map<string, P2PPeer> = new Map();
  private encryption: EncryptionService;
  private publicKey: string;
  private privateKey: string;

  constructor() {
    super();
    this.encryption = new EncryptionService();
    const keyPair = this.encryption.generateKeyPair();
    this.publicKey = keyPair.publicKey;
    this.privateKey = keyPair.privateKey;
  }

  addPeer(peerId: string, publicKey: string): void {
    this.peers.set(peerId, {
      id: peerId,
      publicKey,
      connected: true,
      lastSeen: new Date()
    });

    this.emit('peer:added', { peerId, publicKey });
  }

  removePeer(peerId: string): void {
    this.peers.delete(peerId);
    this.emit('peer:removed', { peerId });
  }

  getPeer(peerId: string): P2PPeer | undefined {
    return this.peers.get(peerId);
  }

  getAllPeers(): P2PPeer[] {
    return Array.from(this.peers.values());
  }

  createMessage(
    from: string,
    to: string,
    type: 'message' | 'ping' | 'pong' | 'key_exchange',
    payload: any,
    encrypted: boolean = true
  ): P2PMessage {
    const message: P2PMessage = {
      id: crypto.randomUUID(),
      from,
      to,
      type,
      payload,
      encrypted,
      timestamp: Date.now()
    };

    // Sign message
    const messageJson = JSON.stringify(message);
    message.signature = this.encryption.signMessage(messageJson, this.privateKey);

    return message;
  }

  verifyMessage(message: P2PMessage): boolean {
    const peer = this.peers.get(message.from);
    if (!peer || !message.signature) return false;

    const messageWithoutSignature = { ...message };
    delete messageWithoutSignature.signature;

    return this.encryption.verifySignature(
      JSON.stringify(messageWithoutSignature),
      message.signature,
      peer.publicKey
    );
  }

  encryptMessageForPeer(message: P2PMessage, peerId: string): P2PMessage {
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error('Peer not found');

    const sharedSecret = this.encryption.computeSharedSecret(peer.publicKey, this.privateKey);
    const key = this.encryption.deriveKey(sharedSecret);

    const encryptedPayload = this.encryption.encryptMessage(JSON.stringify(message.payload), key);

    return {
      ...message,
      encrypted: true,
      payload: encryptedPayload
    };
  }

  decryptMessage(message: P2PMessage): P2PMessage {
    const peer = this.peers.get(message.from);
    if (!peer || !message.encrypted) return message;

    const sharedSecret = this.encryption.computeSharedSecret(peer.publicKey, this.privateKey);
    const key = this.encryption.deriveKey(sharedSecret);

    const decryptedPayload = this.encryption.decryptMessage(message.payload, key);

    return {
      ...message,
      encrypted: false,
      payload: JSON.parse(decryptedPayload)
    };
  }

  broadcast(message: P2PMessage): void {
    this.peers.forEach((peer) => {
      if (peer.connected) {
        this.emit('message:send', {
          peerId: peer.id,
          message: this.encryptMessageForPeer(message, peer.id)
        });
      }
    });
  }

  sendMessage(message: P2PMessage): void {
    const peer = this.peers.get(message.to);
    if (!peer || !peer.connected) {
      this.emit('error', new Error(`Peer ${message.to} not available`));
      return;
    }

    const encrypted = this.encryptMessageForPeer(message, message.to);
    this.emit('message:send', { peerId: message.to, message: encrypted });
  }

  handleIncomingMessage(message: P2PMessage): void {
    // Verify signature
    if (!this.verifyMessage(message)) {
      this.emit('error', new Error('Message signature verification failed'));
      return;
    }

    // Update peer lastSeen
    const peer = this.peers.get(message.from);
    if (peer) {
      peer.lastSeen = new Date();
    }

    // Decrypt if needed
    const decrypted = message.encrypted ? this.decryptMessage(message) : message;

    // Emit event
    this.emit(`message:${decrypted.type}`, decrypted);
    this.emit('message:received', decrypted);
  }

  getNetworkStats(): {
    peersTotal: number;
    peersConnected: number;
    peersOffline: number;
  } {
    const peers = Array.from(this.peers.values());
    return {
      peersTotal: peers.length,
      peersConnected: peers.filter(p => p.connected).length,
      peersOffline: peers.filter(p => !p.connected).length
    };
  }
}

export default P2PNetwork;
