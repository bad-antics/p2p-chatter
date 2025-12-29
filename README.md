# P2P Chatter

<div align="center">

**Decentralized P2P messaging with end-to-end encryption and CAPTCHA protection**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v16%2B-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org)
[![npm](https://img.shields.io/badge/npm-7.0%2B-red)](https://www.npmjs.com)

[Features](#features) • [Installation](#installation) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Security](#security) • [Contributing](#contributing)

</div>

---

## Overview

P2P Chatter is a complete decentralized messaging system built with TypeScript/Node.js. It features:

- **No email required** - Username and password authentication only
- **Bot protection** - 5-level difficulty CAPTCHA system
- **Military-grade encryption** - AES-256-GCM encryption with ECDH key exchange
- **Decentralized** - P2P network architecture with no central server
- **Secure** - PBKDF2 password hashing with rate limiting and account suspension
- **Production-ready** - Fully tested, documented, and optimized

## Features

### 🔐 Security
- **AES-256-GCM** message encryption
- **ECDH** (P-256) key exchange protocol
- **ECDSA** message signing and verification
- **PBKDF2-SHA256** password hashing (100,000 iterations)
- **Rate limiting** - 5 failed attempts per 15 minutes
- **Account suspension** - After 10 failed login attempts
- **Session tokens** - 30-day expiration

### 🤖 CAPTCHA Protection
- **5 difficulty levels** (Easy, Medium, Hard, Complex, Extreme)
- **Math problems** - Basic arithmetic
- **Word puzzles** - Reverse spelling challenges
- **Logic puzzles** - Reasoning challenges
- **Complex calculations** - Advanced mathematical operations
- **Extreme challenges** - Multi-step problems

### 💬 Messaging
- **Direct messaging** - One-to-one encrypted conversations
- **Message persistence** - SQLite database storage
- **Read receipts** - Track message read status
- **Conversation history** - Complete message archival
- **Message signatures** - Verify message authenticity

### 👥 User Management
- **Username/password authentication** - No email verification
- **Session management** - Token-based authentication
- **Account security** - Suspension and recovery mechanisms
- **Password changes** - Secure password updates

### 🌐 P2P Networking
- **Peer discovery** - Dynamic peer management
- **Encrypted communication** - All messages encrypted end-to-end
- **Signature verification** - Cryptographic message authentication
- **Network statistics** - Monitor peer connections

## Installation

### Prerequisites
- **Node.js** v16.0.0 or higher
- **npm** v7.0.0 or higher

### Quick Install

```bash
# Clone repository
git clone https://github.com/bad-antics/p2p-chatter.git
cd p2p-chatter

# Install dependencies
npm install

# Build
npm run build

# Test
npm test
```

For detailed installation instructions, see [INSTALL.md](./INSTALL.md).

## Quick Start

### Basic Setup

```typescript
import { AuthService, P2PNetwork, MessageStore } from 'p2p-chatter';

// Initialize services
const auth = new AuthService();
const network = new P2PNetwork();
const messages = new MessageStore();

// Register user
const { userId } = auth.register('alice', 'SecurePassword123');

// Login
const { token } = auth.login('alice', 'SecurePassword123');

// Send message
const conversation = messages.createConversation(userId, 'bob_id');
messages.storeMessage(conversation.id, userId, 'bob_id', 'Hello Bob!');
```

### Running a Chat Example

```bash
npm run dev
```

See [USAGE.md](./docs/USAGE.md) for comprehensive examples.

## Documentation

| Document | Description |
|----------|-------------|
| [INSTALL.md](./INSTALL.md) | Installation and setup guide |
| [USAGE.md](./docs/USAGE.md) | Comprehensive usage guide with examples |
| [API.md](./docs/API.md) | Detailed API documentation |
| [SECURITY.md](./docs/SECURITY.md) | Security architecture and best practices |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design and architecture |

## Project Structure

```
p2p-chatter/
├── src/
│   ├── auth.ts              # Authentication service
│   ├── captcha.ts           # CAPTCHA service
│   ├── encryption.ts        # Encryption & key exchange
│   ├── messageStore.ts      # Message persistence
│   ├── p2pNetwork.ts        # P2P networking layer
│   └── index.ts             # Main export file
├── tests/
│   ├── auth.test.ts         # Authentication tests
│   ├── encryption.test.ts   # Encryption tests
│   └── network.test.ts      # Network tests
├── docs/
│   ├── USAGE.md             # Usage guide
│   ├── API.md               # API reference
│   ├── SECURITY.md          # Security guide
│   └── ARCHITECTURE.md      # Architecture docs
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript configuration
├── INSTALL.md               # Installation guide
├── LICENSE                  # MIT License
├── CONTRIBUTING.md          # Contribution guidelines
└── CODE_OF_CONDUCT.md       # Community standards
```

## API Examples

### Authentication

```typescript
// Register
const reg = auth.register('username', 'password');
// { success: true, userId: '...' }

// Login
const login = auth.login('username', 'password');
// { success: true, token: '...', userId: '...' }

// Validate session
const session = auth.validateSession(token);
// { valid: true, userId: '...' }

// Change password
auth.changePassword(userId, 'oldPass', 'newPass');
// { success: true }
```

### Encryption

```typescript
// Encrypt message
const encrypted = encryption.encryptMessage('secret', 'key');
// { ciphertext, iv, salt, tag }

// Decrypt message
const decrypted = encryption.decryptMessage(encrypted, 'key');
// 'secret'

// Key exchange (ECDH)
const sharedSecret = encryption.computeSharedSecret(publicKey, privateKey);

// Sign & verify
const sig = encryption.signMessage(msg, privateKey);
const valid = encryption.verifySignature(msg, sig, publicKey);
```

### Messaging

```typescript
// Create conversation
const conv = messages.createConversation(userId1, userId2);

// Store message
messages.storeMessage(convId, senderId, receiverId, 'Hello!');

// Get messages
const msgs = messages.getMessages(convId, 100);

// Mark as read
messages.markAsRead(msgId);

// Get conversations
const convs = messages.getUserConversations(userId);
```

### P2P Network

```typescript
// Add peer
network.addPeer('peer_id', 'peer_public_key');

// Create message
const msg = network.createMessage(from, to, 'message', payload, true);

// Send message
network.sendMessage(msg);

// Receive message
network.on('message:received', (msg) => {
    console.log('Message:', msg.payload);
});

// Network stats
const stats = network.getNetworkStats();
// { peersTotal, peersConnected, peersOffline }
```

## Security

### Cryptographic Algorithms
- **Message Encryption**: AES-256-GCM
- **Key Exchange**: ECDH with P-256 curve
- **Message Signing**: ECDSA-SHA256
- **Key Derivation**: HKDF-SHA256
- **Password Hashing**: PBKDF2-SHA256 (100,000 iterations)

### Security Features
✅ End-to-end encryption  
✅ Perfect forward secrecy (PFS)  
✅ Cryptographic message authentication  
✅ Rate limiting  
✅ Account lockout protection  
✅ CAPTCHA bot protection  
✅ Secure password storage  
✅ Session token expiration  

### Security Best Practices
1. Never hardcode credentials
2. Store private keys securely
3. Validate all user input
4. Use HTTPS in production
5. Keep dependencies updated
6. Enable CAPTCHA for public registration
7. Monitor failed login attempts
8. Implement rate limiting

See [SECURITY.md](./docs/SECURITY.md) for detailed security documentation.

## Performance

- **Message Storage**: O(1) lookup with SQLite indexing
- **Encryption**: Optimized AES-256-GCM implementation
- **P2P Network**: Efficient peer management
- **Database**: Connection pooling and transaction batching
- **Memory**: Automatic cleanup of expired sessions/CAPTCHAs

## Scripts

```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Run in development mode
npm run dev

# Start production build
npm start

# TypeScript type checking
npx tsc --noEmit
```

## Requirements

- **Node.js**: v16.0.0+
- **npm**: v7.0.0+
- **Python**: v3.8+ (for native modules)
- **Build tools**: GCC/Clang or MSVC (for Windows)

## Browser Support

P2P Chatter is a Node.js library. For browser support, use with a bundler:
- Webpack
- Parcel
- Rollup
- esbuild

## License

MIT License - see [LICENSE](./LICENSE) file for details

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Code of Conduct

Please review [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before contributing.

## Community

- **Issues**: [GitHub Issues](https://github.com/bad-antics/p2p-chatter/issues)
- **Discussions**: [GitHub Discussions](https://github.com/bad-antics/p2p-chatter/discussions)
- **Email**: contact@bad-antics.com

## Changelog

### Version 1.0.0 (December 2025)
- ✅ Complete authentication system
- ✅ CAPTCHA protection (5 difficulty levels)
- ✅ AES-256-GCM encryption
- ✅ ECDH key exchange
- ✅ ECDSA message signing
- ✅ SQLite message storage
- ✅ P2P networking layer
- ✅ Complete test suite
- ✅ Full documentation

## Roadmap

- [ ] UI components library
- [ ] Mobile application (React Native)
- [ ] WebSocket server
- [ ] Desktop application (Electron)
- [ ] File transfer protocol
- [ ] Group messaging
- [ ] Message reactions
- [ ] User presence status
- [ ] Typing indicators

## Support

If you encounter issues:

1. Check [INSTALL.md](./INSTALL.md) for setup help
2. Review [USAGE.md](./docs/USAGE.md) for examples
3. Search [existing issues](https://github.com/bad-antics/p2p-chatter/issues)
4. Create a [new issue](https://github.com/bad-antics/p2p-chatter/issues/new)

## Credits

Built by the **Bad Antics** community with ❤️

## Repository

- **GitHub**: https://github.com/bad-antics/p2p-chatter
- **Organization**: https://github.com/bad-antics

---

<div align="center">

Made with ❤️ by [Bad Antics](https://github.com/bad-antics)

[⬆ Back to top](#p2p-chatter)

</div>


---

**Created by antX**  
**Organization:** [Bad Antics](https://github.com/bad-antics)  
**Repository:** https://github.com/bad-antics/p2p-chatter  

2025 Bad Antics. All rights reserved.


---

**Created by antX**  
**Organization:** [Bad Antics](https://github.com/bad-antics)  
**Repository:** https://github.com/bad-antics/p2p-chatter  

2025 Bad Antics. All rights reserved.
