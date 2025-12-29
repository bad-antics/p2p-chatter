# Usage Guide - P2P Chatter

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Encryption & Security](#encryption--security)
4. [P2P Networking](#p2p-networking)
5. [Message Storage](#message-storage)
6. [CAPTCHA](#captcha)
7. [API Examples](#api-examples)

## Quick Start

### Basic Setup

```typescript
import { AuthService, EncryptionService, P2PNetwork, MessageStore, CaptchaService } from 'p2p-chatter';

// Initialize services
const auth = new AuthService('./p2p_chatter.db');
const encryption = new EncryptionService();
const network = new P2PNetwork();
const messageStore = new MessageStore('./p2p_chatter.db');
const captcha = new CaptchaService();
```

### Register a User

```typescript
const result = auth.register('john_doe', 'SecurePassword123!');

if (result.success) {
    console.log(`User registered with ID: ${result.userId}`);
} else {
    console.error(`Registration failed: ${result.error}`);
}
```

Requirements:
- Username: minimum 3 characters, must be unique
- Password: minimum 8 characters, alphanumeric recommended

### Login

```typescript
const loginResult = auth.login('john_doe', 'SecurePassword123!');

if (loginResult.success) {
    console.log(`Logged in successfully`);
    console.log(`Session token: ${loginResult.token}`);
    console.log(`User ID: ${loginResult.userId}`);
} else {
    console.error(`Login failed: ${loginResult.error}`);
}
```

Security Features:
- Password hashing with PBKDF2 (100,000 iterations)
- Rate limiting (5 failed attempts = 15-min lockout)
- Account suspension after 10 failed attempts
- Session tokens valid for 30 days

## Authentication

### Validate Session

```typescript
const token = 'your_session_token_here';
const session = auth.validateSession(token);

if (session.valid) {
    console.log(`Session valid for user: ${session.userId}`);
} else {
    console.log('Session expired or invalid');
}
```

### Change Password

```typescript
const changeResult = auth.changePassword(userId, 'OldPassword123', 'NewPassword456');

if (changeResult.success) {
    console.log('Password changed successfully');
} else {
    console.error(`Failed: ${changeResult.error}`);
}
```

### Logout

```typescript
auth.logout(sessionToken);
console.log('User logged out');
```

## Encryption & Security

### Generate Key Pair

```typescript
const keyPair = encryption.generateKeyPair();
console.log('Public Key:', keyPair.publicKey);
console.log('Private Key:', keyPair.privateKey);

// Store private key securely!
// Never share it with anyone
```

### Encrypt a Message

```typescript
const message = "Secret message";
const encryptionKey = "shared_secret_key";

const encrypted = encryption.encryptMessage(message, encryptionKey);
console.log('Encrypted:', encrypted);
// Output: { ciphertext, iv, salt, tag }
```

### Decrypt a Message

```typescript
const decrypted = encryption.decryptMessage(encrypted, encryptionKey);
console.log('Decrypted:', decrypted);
// Output: "Secret message"
```

### Key Exchange (ECDH)

```typescript
// User A
const keyPairA = encryption.generateKeyPair();
const publicKeyA = keyPairA.publicKey;

// User B
const keyPairB = encryption.generateKeyPair();
const publicKeyB = keyPairB.publicKey;

// Both users compute shared secret
const sharedSecretA = encryption.computeSharedSecret(publicKeyB, keyPairA.privateKey);
const sharedSecretB = encryption.computeSharedSecret(publicKeyA, keyPairB.privateKey);

console.log('Shared secrets match:', sharedSecretA === sharedSecretB);
// Output: true

// Derive encryption key
const derivedKey = encryption.deriveKey(sharedSecretA);
```

### Sign & Verify Messages

```typescript
const message = "Important message";

// Sign
const signature = encryption.signMessage(message, privateKeyPem);
console.log('Signature:', signature);

// Verify
const isValid = encryption.verifySignature(message, signature, publicKeyPem);
console.log('Valid:', isValid);
// Output: true
```

## P2P Networking

### Add Peers

```typescript
// Add a peer to your network
network.addPeer(
    'peer_id_123',
    'peer_public_key_pem'
);
```

### Create and Send Messages

```typescript
// Create a message
const message = network.createMessage(
    'your_user_id',           // from
    'peer_id_123',            // to
    'message',                // type
    { text: 'Hello peer!' },  // payload
    true                      // encrypted
);

// Send to specific peer
network.sendMessage(message);

// Or broadcast to all peers
network.broadcast(message);
```

### Listen for Messages

```typescript
// Listen for any received message
network.on('message:received', (message) => {
    console.log(`Message from ${message.from}:`, message.payload);
});

// Listen for specific message types
network.on('message:message', (message) => {
    console.log('Chat message:', message.payload);
});

network.on('message:ping', (message) => {
    console.log('Ping from peer');
});

network.on('message:key_exchange', (message) => {
    console.log('Key exchange from peer');
});
```

### Handle Incoming Messages

```typescript
const incomingMessage = {
    id: 'msg_123',
    from: 'peer_id_123',
    to: 'your_user_id',
    type: 'message',
    payload: encryptedPayload,
    encrypted: true,
    timestamp: Date.now(),
    signature: 'signature_here'
};

network.handleIncomingMessage(incomingMessage);
```

### Network Statistics

```typescript
const stats = network.getNetworkStats();
console.log(`Total peers: ${stats.peersTotal}`);
console.log(`Connected: ${stats.peersConnected}`);
console.log(`Offline: ${stats.peersOffline}`);
```

## Message Storage

### Create Conversation

```typescript
const conversation = messageStore.createConversation(
    'user_id_1',
    'user_id_2'
);

console.log(`Conversation ID: ${conversation.id}`);
```

### Store Message

```typescript
const stored = messageStore.storeMessage(
    conversationId,
    senderId,
    receiverId,
    'Hello there!',
    false  // encrypted
);

console.log(`Message stored with ID: ${stored.id}`);
```

### Retrieve Messages

```typescript
const messages = messageStore.getMessages(conversationId, 50);

messages.forEach(msg => {
    console.log(`[${msg.timestamp}] ${msg.senderId}: ${msg.content}`);
});
```

### Mark as Read

```typescript
messageStore.markAsRead(messageId);
```

### Get User Conversations

```typescript
const conversations = messageStore.getUserConversations(userId);

conversations.forEach(conv => {
    console.log(`Conversation with user: ${conv.participant2Id}`);
    console.log(`Last message: ${conv.lastMessageAt}`);
});
```

## CAPTCHA

### Generate Challenge

```typescript
const captcha = new CaptchaService();

// Easy difficulty
const easy = captcha.generateChallenge(1);
console.log(easy.challenge);  // "What is 3 + 5?"
console.log(easy.difficulty); // 1

// Medium difficulty
const medium = captcha.generateChallenge(3);

// Hard difficulty
const hard = captcha.generateChallenge(5);
```

**Difficulty Levels:**
- 1: Simple math problems
- 2: Word puzzles
- 3: Logic puzzles
- 4: Complex calculations
- 5: Extreme challenges

### Validate Answer

```typescript
const isCorrect = captcha.validateAnswer(captchaId, userAnswer);

if (isCorrect) {
    console.log('CAPTCHA solved correctly!');
} else {
    console.log('Incorrect answer. Try again.');
}
```

### Auto Cleanup

```typescript
// Cleanup expired challenges
captcha.cleanup();

// Run periodically (every 10 minutes)
setInterval(() => captcha.cleanup(), 10 * 60 * 1000);
```

## API Examples

### Complete Chat Application Example

```typescript
import {
    AuthService,
    EncryptionService,
    P2PNetwork,
    MessageStore,
    CaptchaService
} from 'p2p-chatter';

class ChatApp {
    private auth: AuthService;
    private encryption: EncryptionService;
    private network: P2PNetwork;
    private messageStore: MessageStore;
    private captcha: CaptchaService;
    private currentUserId: string | null = null;

    constructor() {
        this.auth = new AuthService();
        this.encryption = new EncryptionService();
        this.network = new P2PNetwork();
        this.messageStore = new MessageStore();
        this.captcha = new CaptchaService();

        this.setupNetworkListeners();
    }

    private setupNetworkListeners() {
        this.network.on('message:received', (msg) => {
            console.log(`New message from ${msg.from}: ${msg.payload.text}`);
        });
    }

    async register(username: string, password: string) {
        const result = this.auth.register(username, password);
        if (result.success) {
            this.currentUserId = result.userId;
            console.log('Registered successfully');
        }
        return result;
    }

    async login(username: string, password: string) {
        const result = this.auth.login(username, password);
        if (result.success) {
            this.currentUserId = result.userId;
            console.log('Logged in successfully');
        }
        return result;
    }

    async sendMessage(toUserId: string, text: string) {
        if (!this.currentUserId) throw new Error('Not logged in');

        // Create conversation
        let conversation = this.messageStore.getConversation(
            this.currentUserId,
            toUserId
        );
        if (!conversation) {
            conversation = this.messageStore.createConversation(
                this.currentUserId,
                toUserId
            );
        }

        // Store message
        this.messageStore.storeMessage(
            conversation.id,
            this.currentUserId,
            toUserId,
            text
        );

        // Send via P2P
        const message = this.network.createMessage(
            this.currentUserId,
            toUserId,
            'message',
            { text },
            true
        );
        this.network.sendMessage(message);
    }

    cleanup() {
        this.auth.closeConnection();
        this.messageStore.closeConnection();
    }
}

// Usage
const app = new ChatApp();
await app.register('alice', 'SecurePass123');
await app.login('alice', 'SecurePass123');
await app.sendMessage('bob_user_id', 'Hi Bob!');
```

## Security Best Practices

1. **Never hardcode credentials** - Use environment variables
2. **Store private keys securely** - Use encrypted storage
3. **Validate all inputs** - Prevent injection attacks
4. **Use HTTPS** - When transmitting data over network
5. **Keep dependencies updated** - Regularly run `npm audit fix`
6. **Enable CAPTCHA** - For public-facing registration

## Performance Tips

1. **Database indexing** - Already optimized in MessageStore
2. **Connection pooling** - Reuse database connections
3. **Message pagination** - Load messages in chunks
4. **Cleanup routine** - Regularly cleanup expired sessions/CAPTCHAs

---

**Last Updated:** December 2025  
**Version:** 1.0.0
