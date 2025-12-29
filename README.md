# P2P Chatter - Peer-to-Peer Chat Application

A privacy-focused, decentralized chat application inspired by Session. Reverse engineered architecture with end-to-end encryption, peer-to-peer networking, and local message storage.

## 🎯 Features

### Core Features
- **End-to-End Encryption** - AES-256-GCM message encryption with ECDH key exchange
- **Peer-to-Peer Networking** - Direct peer communication without central server
- **Message Persistence** - Local SQLite storage for message history
- **Contact Management** - Add, verify, and manage contacts with public keys
- **Digital Signatures** - Message authentication and verification
- **Presence Updates** - Online/offline status for contacts

### Security Features
- **ECDH Key Exchange** - Secure shared secret derivation
- **Message Signing** - Cryptographic signature verification
- **Authentication Tags** - GCM authentication for message integrity
- **Nonce Usage** - Unique nonce for each encrypted message
- **Key Derivation** - HKDF-based key derivation from shared secrets

### Privacy Features
- **No Central Server** - Pure P2P architecture
- **Local Storage Only** - Messages stored locally, not on servers
- **Metadata Minimal** - Minimal metadata exposure
- **Encryption By Default** - All messages encrypted

## 🏗️ Architecture

### Module Structure

```
P2P Chatter
├── identity.ts          - User profiles, key management, contact directory
├── encryption.ts        - Encryption/decryption, signing, verification
├── messageStore.ts      - Message persistence and retrieval
├── p2pNetwork.ts        - Peer discovery and messaging
└── index.ts             - Main application orchestration
```

### Data Flow

```
User Input
    ↓
P2PChatter (Main App)
    ├── IdentityManager (User & Contact Management)
    ├── EncryptionManager (E2E Encryption)
    ├── MessageStore (Local Persistence)
    └── P2PNetwork (Peer Communication)
```

### Message Encryption Flow

```
Plain Text Message
    ↓
Derive Shared Secret (ECDH)
    ↓
Generate Nonce + Encrypt (AES-256-GCM)
    ↓
Sign Message
    ↓
Create Network Message
    ↓
Send via P2P
    ↓
Remote Peer Receives
    ↓
Verify Signature
    ↓
Derive Shared Secret
    ↓
Decrypt Message (AES-256-GCM)
    ↓
Store in Local Database
```

## 🔐 Cryptography Details

### Key Exchange
- **Algorithm**: ECDH (Elliptic Curve Diffie-Hellman)
- **Curve**: prime256v1 (NIST P-256)
- **Output**: 256-bit shared secret

### Message Encryption
- **Algorithm**: AES-256-GCM
- **Key Size**: 256 bits (derived from shared secret via HMAC-SHA256)
- **Nonce**: 128 bits (randomly generated per message)
- **Authentication Tag**: GCM-derived authentication

### Message Signing
- **Algorithm**: ECDSA with SHA-256
- **Key**: User's private key
- **Verification**: Using sender's public key

### Key Derivation
- **Function**: HMAC-SHA256 with label
- **Purpose**: Derive encryption key from shared secret
- **Format**: HMAC-SHA256(sharedSecret, 'encryption_key')

## 📦 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  publicKey TEXT NOT NULL,
  privateKey TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  profilePicture TEXT,
  status TEXT
);
```

### Contacts Table
```sql
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  username TEXT NOT NULL,
  publicKey TEXT NOT NULL,
  displayName TEXT,
  addedAt INTEGER NOT NULL,
  verified BOOLEAN DEFAULT 0
);
```

### Messages Table
```sql
CREATE TABLE messages (
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
  nonce TEXT NOT NULL
);
```

### Conversations Table
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  lastMessageTime INTEGER,
  createdAt INTEGER NOT NULL
);
```

## 🚀 Getting Started

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run development server
npm run dev
```

### Basic Usage

```typescript
import { P2PChatter } from './index';

// Create app instance
const app = new P2PChatter();

// Create new account
const user = await app.createAccount('Alice', 'profile.jpg', 'Hey!');
console.log('User ID:', user.id);
console.log('Public Key:', user.publicKey);

// Add contact (via public key sharing/QR code)
const contactId = app.addContact(bobPublicKey, 'Bob', 'Bob (Work)');

// Send message
const messageId = await app.sendMessage(contactId, 'Hello Bob!');

// Retrieve conversation
const messages = app.getConversationMessages(contactId, 50);
messages.forEach(msg => {
  console.log(`${msg.senderId}: ${msg.content}`);
});

// Graceful shutdown
await app.shutdown();
```

## 🔄 Message Flow Example

### Sending a Message

1. **User Types**: "Hello, World!"
2. **Encryption**:
   - Retrieve contact's public key
   - Derive shared secret using ECDH
   - Generate random nonce (16 bytes)
   - Encrypt message with AES-256-GCM
3. **Signing**:
   - Create message object with metadata
   - Sign with sender's private key
4. **Storage**:
   - Store encrypted message locally
   - Mark as "pending"
5. **Network**:
   - Create NetworkMessage with encrypted content
   - Send to recipient via P2P network
6. **Delivery**:
   - Recipient decrypts using shared secret
   - Verifies signature using sender's public key
   - Stores decrypted message locally
   - Sends acknowledgement

### Receiving a Message

1. **Network Receives**: Encrypted NetworkMessage
2. **Verification**:
   - Verify sender's signature
   - Extract encrypted content and nonce
3. **Decryption**:
   - Retrieve contact's public key
   - Derive shared secret using ECDH
   - Decrypt AES-256-GCM with nonce
4. **Storage**:
   - Store decrypted message in database
   - Mark as "delivered"
5. **Acknowledgement**:
   - Send ACK message back to sender
   - Sender updates delivery status

## 📝 API Reference

### P2PChatter Class

#### Methods

```typescript
// Account Management
createAccount(username: string, profilePicture?: string, status?: string): Promise<UserProfile>
loadAccount(userId: string): Promise<UserProfile | null>
getCurrentUser(): UserProfile | null

// Contact Management
addContact(contactPublicKey: string, username: string, displayName?: string): string
getContacts(): any[]

// Messaging
sendMessage(contactId: string, content: string): Promise<string>
getConversationMessages(contactId: string, limit?: number): Message[]

// Presence
publishPresence(status: 'online' | 'offline'): Promise<void>

// Lifecycle
shutdown(): Promise<void>
```

### IdentityManager Class

```typescript
// Static Methods
static generateIdentity(username: string): UserProfile

// Instance Methods
createUser(username: string, profilePicture?: string, status?: string): UserProfile
loadUser(userId: string): UserProfile | null
getCurrentUser(): UserProfile | null
addContact(contactPublicKey: string, username: string, displayName?: string): string
getContacts(): any[]
getContact(contactId: string): any
close(): void
```

### EncryptionManager Class

```typescript
// Encryption/Decryption
static deriveSharedSecret(myPrivateKey: string, theirPublicKey: string): Buffer
static encryptMessage(plaintext: string, sharedSecret: Buffer): EncryptedMessage
static decryptMessage(encrypted: EncryptedMessage, sharedSecret: Buffer): string

// Signing/Verification
static signMessage(message: string, privateKeyPem: string): string
static verifySignature(message: string, signature: string, publicKeyPem: string): boolean

// Hashing
static hashMessage(message: string): string
```

### MessageStore Class

```typescript
// Message Management
storeMessage(message: Message): void
getConversationMessages(conversationId: string, limit?: number, offset?: number): Message[]
markAsRead(messageId: string): void
updateDeliveryStatus(messageId: string, status: string): void
deleteMessage(messageId: string): void

// Conversation Management
getOrCreateConversation(userId: string, contactId: string): string

// Search
searchMessages(conversationId: string, query: string): Message[]
getUnreadCount(conversationId: string): number

// Lifecycle
close(): void
```

### P2PNetwork Class

```typescript
// Messaging
on(messageType: string, handler: (message: NetworkMessage) => void): void
send(message: NetworkMessage): Promise<void>
broadcast(message: NetworkMessage): Promise<void>

// Peer Management
addPeer(peerInfo: PeerInfo): void
removePeer(peerId: string): void
getPeer(peerId: string): PeerInfo | undefined
getOnlinePeers(): PeerInfo[]
updatePeerStatus(peerId: string, status: string): void

// Connection
connect(nodeId: string): Promise<void>
disconnect(): Promise<void>
isNetworkConnected(): boolean
```

## 🔧 Configuration

### Database Paths

```typescript
const app = new P2PChatter(
  './data/identity.db',    // Identity database path
  './data/messages.db'      // Messages database path
);
```

### Environment Variables

```bash
# Optional configuration
NODE_ENV=development
LOG_LEVEL=debug
```

## 📊 Performance Characteristics

### Message Encryption
- **Time Complexity**: O(n) where n = message size
- **Space Complexity**: O(n) for ciphertext storage
- **Typical Speed**: <10ms for 1KB message

### Key Derivation
- **Algorithm**: ECDH + HMAC-SHA256
- **Typical Speed**: <5ms per message
- **Security**: 256-bit equivalent

### Database Operations
- **Message Insert**: O(log n)
- **Message Retrieval**: O(log n) with index
- **Search**: O(n) scan with LIKE clause

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## 🛠️ Development

### Project Structure
```
p2p-chatter/
├── src/
│   ├── index.ts          # Main application
│   ├── identity.ts       # Identity management
│   ├── encryption.ts     # E2E encryption
│   ├── messageStore.ts   # Message persistence
│   └── p2pNetwork.ts     # P2P networking
├── dist/                 # Compiled output
├── tests/                # Test files
├── package.json
├── tsconfig.json
└── README.md
```

### Build Process

```bash
# Compile TypeScript
npm run build

# Output location: ./dist/
```

## 🔒 Security Considerations

### Threat Model

**In Scope**:
- Eavesdropping on message content
- Message forgery/tampering
- Peer impersonation (via signature verification)

**Out of Scope**:
- Network traffic analysis/metadata
- Device compromise
- Side-channel attacks
- Quantum computing threats

### Best Practices

1. **Key Management**:
   - Private keys stored in SQLite (plaintext - should be encrypted in production)
   - Recommend using OS keychain in production
   - Regular key rotation recommended

2. **Message Integrity**:
   - All messages signed and verified
   - GCM authentication tags prevent tampering
   - Content hash stored for verification

3. **Contact Verification**:
   - Contacts marked as "verified" after key exchange
   - Public key fingerprints for manual verification
   - QR code scanning recommended for key exchange

## 🚀 Future Enhancements

- [ ] libp2p integration for true P2P networking
- [ ] Group messaging support
- [ ] Message reactions and editing
- [ ] File sharing with encryption
- [ ] Voice/video call support
- [ ] Message search with encryption
- [ ] Device backup and sync
- [ ] Contact request handling
- [ ] Message expiration
- [ ] Hardware security module integration

## 📜 License

MIT License - See LICENSE file for details

## 👥 Contributing

Contributions welcome! Please ensure:
- All tests pass
- Code follows TypeScript best practices
- New features include tests
- Documentation is updated

## 📖 References

### Related Projects
- [Packet Cypher Action](https://github.com/bad-antics/Packet-Cypher-Action) - Companion packet encryption library
- See [RELATED_PROJECTS.md](RELATED_PROJECTS.md) for full ecosystem overview

### Security
- [ECDH Key Exchange](https://en.wikipedia.org/wiki/Elliptic_curve_Diffie%E2%80%93Hellman)
- [AES-256-GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
- [ECDSA Signatures](https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm)

### Session Protocol References
- [Session Messenger](https://getsession.org/)
- [Session Whitepaper](https://getsession.org/whitepaper)
- [Loki Documentation](https://lokinet.io/)

### Cryptography Libraries
- [Node.js crypto](https://nodejs.org/api/crypto.html)
- [libsodium](https://github.com/jedisct1/libsodium)

---

**Status**: Development  
**Version**: 0.1.0  
**Last Updated**: December 2025  
**Created by**: antX (bad-antics)  
**License**: MIT
