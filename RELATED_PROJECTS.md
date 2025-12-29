# Related Projects

## 🔗 Project Ecosystem

This is part of the bad-antics ecosystem of privacy-focused, decentralized applications.

### P2P Chatter
**Main Project** - Peer-to-peer encrypted messaging application

- **Repository**: https://github.com/bad-antics/p2p-chatter
- **Status**: Development Ready
- **Version**: 0.1.0
- **Features**:
  - End-to-end encryption (AES-256-GCM)
  - ECDH key exchange
  - Local message persistence (SQLite)
  - P2P networking framework
  - Digital message signing

**Location**: `W:\pc123\Documents\p2p chatter\`

---

### Packet Cypher Action
**Companion Project** - Secure packet encryption and routing

- **Repository**: https://github.com/bad-antics/Packet-Cypher-Action
- **Status**: Production Ready
- **Version**: 1.0.0
- **Features**:
  - High-performance AES-256-GCM encryption
  - Packet queue and routing
  - Event-driven architecture
  - Multi-layer encryption chains
  - Key derivation (PBKDF2)

**Location**: `W:\pc123\Documents\Packet-Cypher-Action\`

**Integration**: Use PacketRouter with P2P Chatter for enhanced packet-level encryption before P2P transmission.

---

## 🔐 Architecture Overview

```
P2P Chatter
├── Message Encryption (E2E)
│   └── Uses: Encryption Manager
├── Message Storage
│   └── Uses: SQLite persistence
├── P2P Network Layer
│   └── Packet Cypher Action
│       ├── AES-256-GCM Encryption
│       ├── Packet Routing
│       └── Multi-layer Support
└── User Management
    └── Identity & Contacts
```

---

## 📚 Documentation

### P2P Chatter
- [README.md](../p2p%20chatter/README.md) - Complete API reference
- [SETUP.md](../p2p%20chatter/SETUP.md) - Installation guide
- [PROJECT_SUMMARY.md](../p2p%20chatter/PROJECT_SUMMARY.md) - Project overview
- [QUICKREF.md](../p2p%20chatter/QUICKREF.md) - Quick reference

### Packet Cypher Action
- [README.md](../Packet-Cypher-Action/README.md) - API and features
- [GitHub Repository](https://github.com/bad-antics/Packet-Cypher-Action)

---

## 🚀 Getting Started with Both Projects

### Option 1: P2P Chatter Only
```bash
cd "W:\pc123\Documents\p2p chatter"
npm install
npm run dev
```

### Option 2: With Packet Cypher Action
```bash
# Install both projects
cd "W:\pc123\Documents\p2p chatter"
npm install

cd "W:\pc123\Documents\Packet-Cypher-Action"
npm install

# Use together
npm run dev
```

### Option 3: Integrated Development
```typescript
import { P2PChatter } from 'p2p-chatter';
import { PacketRouter } from 'packet-cypher-action';

const app = new P2PChatter();
const router = new PacketRouter(encryptionKey);

// Combine both for enhanced security
```

---

## 👥 Author

**antX (bad-antics)**

All projects in this ecosystem are created and maintained by antX.

---

## 📄 License

All projects are released under the MIT License.

- [P2P Chatter License](../p2p%20chatter/LICENSE)
- [Packet Cypher Action License](../Packet-Cypher-Action/LICENSE)

---

## 🔗 Links

- **GitHub Organization**: https://github.com/bad-antics
- **P2P Chatter Repository**: https://github.com/bad-antics/p2p-chatter
- **Packet Cypher Action Repository**: https://github.com/bad-antics/Packet-Cypher-Action

---

**Last Updated**: December 29, 2025
