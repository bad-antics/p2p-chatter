# 📘 P2P Chatter - Quick Reference

## Core Classes

### P2PChatter (Main Application)
```typescript
// Create instance
const app = new P2PChatter();

// Account management
await app.createAccount(username, profilePicture?, status?)
await app.loadAccount(userId)
app.getCurrentUser()

// Contacts
app.addContact(publicKey, username, displayName?)
app.getContacts()

// Messaging
await app.sendMessage(contactId, content)
app.getConversationMessages(contactId, limit?)

// Presence
await app.publishPresence('online' | 'offline')

// Shutdown
await app.shutdown()
```

### IdentityManager (User & Contacts)
```typescript
// Generate new identity
IdentityManager.generateIdentity(username)

// Create/load user
manager.createUser(username, profilePicture?, status?)
manager.loadUser(userId)

// Contact management
manager.addContact(publicKey, username, displayName?)
manager.getContacts()
manager.getContact(contactId)
```

### EncryptionManager (E2E Encryption)
```typescript
// Key exchange
EncryptionManager.deriveSharedSecret(privateKey, publicKey)

// Encryption
EncryptionManager.encryptMessage(plaintext, sharedSecret)
EncryptionManager.decryptMessage(encrypted, sharedSecret)

// Signing
EncryptionManager.signMessage(message, privateKey)
EncryptionManager.verifySignature(message, signature, publicKey)

// Hashing
EncryptionManager.hashMessage(message)
```

### MessageStore (Persistence)
```typescript
// Store message
store.storeMessage(message)

// Retrieve
store.getConversationMessages(conversationId, limit?, offset?)

// Status
store.markAsRead(messageId)
store.updateDeliveryStatus(messageId, status)

// Search
store.searchMessages(conversationId, query)
store.getUnreadCount(conversationId)

// Conversation
store.getOrCreateConversation(userId, contactId)
```

### P2PNetwork (Networking)
```typescript
// Events
network.on(type, handler)

// Messaging
await network.send(message)
await network.broadcast(message)

// Peers
network.addPeer(peerInfo)
network.getPeer(peerId)
network.getOnlinePeers()
network.updatePeerStatus(peerId, status)

// Connection
await network.connect(nodeId)
await network.disconnect()
network.isNetworkConnected()
```

## Data Types

### UserProfile
```typescript
interface UserProfile {
  id: string              // UUID
  username: string        // Unique username
  publicKey: string       // PEM-encoded ECDH public key
  privateKey?: string     // PEM-encoded ECDH private key (local only)
  createdAt: number       // Timestamp
  profilePicture?: string // Base64 or file path
  status?: string         // Custom status message
}
```

### Message
```typescript
interface Message {
  id: string                              // UUID
  conversationId: string                  // UUID:UUID
  senderId: string                        // Sender user ID
  receiverId: string                      // Recipient user ID
  content: string                         // Plaintext (decrypted)
  contentHash: string                     // SHA-256 hash
  timestamp: number                       // Unix timestamp
  isRead: boolean                         // Read status
  deliveryStatus: 'pending'|'sent'|'delivered'|'failed'
  encryptedContent: string                // Hex-encoded ciphertext
  nonce: string                           // Hex-encoded nonce
}
```

### EncryptedMessage
```typescript
interface EncryptedMessage {
  ciphertext: string      // Hex: ciphertext:authTag
  nonce: string           // Hex-encoded nonce
  senderPublicKey: string // PEM-encoded public key
  timestamp: number       // Unix timestamp
}
```

### NetworkMessage
```typescript
interface NetworkMessage {
  id: string              // UUID
  from: string            // Sender node ID
  to: string              // Recipient node ID
  type: string            // message|presence|sync|acknowledgement
  payload: any            // Message-specific data
  timestamp: number       // Unix timestamp
  signature: string       // Hex-encoded signature
}
```

### PeerInfo
```typescript
interface PeerInfo {
  id: string              // Peer/Node ID
  publicKey: string       // PEM-encoded public key
  addresses: string[]     // IP:port addresses
  lastSeen: number        // Timestamp
  status: 'online'|'offline'|'pending'
}
```

## Common Workflows

### Create New Account
```typescript
const app = new P2PChatter();
const user = await app.createAccount('Alice');
console.log('Account created:', user.id);
console.log('Share this public key:', user.publicKey);
```

### Add Contact (via Public Key)
```typescript
const contactId = app.addContact(bobPublicKey, 'Bob');
console.log('Contact added:', contactId);
```

### Send Message
```typescript
const messageId = await app.sendMessage(contactId, 'Hello!');
console.log('Message sent:', messageId);
```

### Receive & Display Messages
```typescript
const messages = app.getConversationMessages(contactId);
for (const msg of messages) {
  const sender = msg.senderId === app.getCurrentUser().id ? 'You' : 'Them';
  console.log(`${sender}: ${msg.content}`);
}
```

### Mark All as Read
```typescript
const messages = app.getConversationMessages(contactId);
messages.forEach(msg => {
  if (!msg.isRead) {
    messageStore.markAsRead(msg.id);
  }
});
```

## Command-Line Usage

```bash
# Build
npm run build

# Development (auto-reload)
npm run dev

# Production
npm start

# Testing
npm test

# Linting
npm lint

# Clean
npm run clean
```

## Security Checklist

- [ ] User private keys secured (use keychain)
- [ ] Messages verified with signatures
- [ ] Encryption keys derived from ECDH
- [ ] Nonces unique per message
- [ ] Contacts verified before messaging
- [ ] Network traffic encrypted (TLS)
- [ ] Database encrypted at rest
- [ ] No unencrypted storage of messages

## Debugging

### Enable Verbose Logging
```typescript
// Set LOG_LEVEL environment variable
process.env.LOG_LEVEL = 'debug';
```

### Check Database
```bash
# View identity database
sqlite3 data/identity.db
SELECT * FROM users;
SELECT * FROM contacts;

# View messages database
sqlite3 data/messages.db
SELECT * FROM messages;
```

### Verify Encryption
```typescript
const secret = EncryptionManager.deriveSharedSecret(alicePrivate, bobPublic);
const encrypted = EncryptionManager.encryptMessage('test', secret);
const decrypted = EncryptionManager.decryptMessage(encrypted, secret);
console.log(decrypted === 'test'); // true
```

## Performance Tips

1. **Message Batching** - Send multiple messages in single batch
2. **Index Creation** - Add indexes for frequently queried fields
3. **Connection Pooling** - Reuse P2P connections
4. **Message Compression** - Compress large messages before encryption
5. **Lazy Loading** - Load conversation messages on demand

## Troubleshooting

| Issue | Solution |
|-------|----------|
| npm install fails | Clear cache: `npm cache clean --force` |
| Build errors | Check TypeScript: `npx tsc --noEmit` |
| Database locked | Close other connections |
| Encryption errors | Verify key formats (PEM) |
| Network errors | Check P2P connectivity |

## Resources

- **API**: See README.md for complete API reference
- **Architecture**: See ARCHITECTURE.md (coming soon)
- **Examples**: See src/index.ts main() function
- **Tests**: See tests/ directory

---

**Keep this handy for quick reference while developing!** 📖
