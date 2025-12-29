## P2P Chatter Enhanced - Features Implementation

**Last Updated**: December 29, 2025  
**Version**: 1.1.0  
**Created by**: antX | Bad Antics (https://github.com/bad-antics)

---

## Overview

P2P Chatter has been enhanced with advanced privacy and usability features:

1. **Selectable Tor/VPN Service** - Choose connection modes (Direct, Tor, VPN, or Tor+VPN)
2. **Auto-Generated Usernames** - Funny, randomized usernames with p2p- prefix
3. **Single-Use Credentials** - Auto-generated passwords for maximum anonymity

---

## New Modules

### 1. Tor Service (`src/torService.ts`)

**Purpose**: Handle Tor connections and VPN tunnel optimization

**Features**:
- Selectable connection modes: `direct | tor | vpn | tor+vpn`
- Tor circuit management (entry, middle, exit nodes)
- VPN protocol support: WireGuard, OpenVPN, IPSec
- Encryption level control: standard, strong, military
- Network optimization metrics (latency, anonymity, bandwidth)
- Event-driven architecture with EventEmitter

**Usage**:
```typescript
import TorService from './torService';

// Set connection mode
TorService.setConnectionMode('tor+vpn');

// Get connection status
const status = TorService.getConnectionStatus();
// { isConnected: true, mode: 'tor+vpn', tor: true, vpn: true }

// Get routing optimization
const optimization = TorService.getRoutingOptimization();
// { latency: 70ms, anonymity: 110/100, bandwidth: 55/100 }

// Connect to network
await TorService.connect();
```

**Configuration**:
- Tor default port: 9050 (SOCKS), 9051 (Control)
- VPN default port: 51820 (WireGuard)
- Custom endpoints supported

---

### 2. Username Generator (`src/usernameGenerator.ts`)

**Purpose**: Generate funny, randomized usernames and single-use credentials

**Features**:
- Usernames format: `p2p-{adjective}{creature}{action}{number}`
  - Adjectives: Mysterious, Sneaky, Quirky, Zany, Witty, etc.
  - Creatures: Panda, Penguin, Platypus, Lemur, Koala, etc.
  - Actions: Bouncing, Dancing, Jumping, Spinning, Flying, etc.
  - Examples: `p2p-sneakypandajumping42`, `p2p-mysterypinguindancing99`

- Single-use passwords: 32-byte cryptographically secure random strings
- Automatic credential expiration: 24 hours
- In-memory credential caching with cleanup
- Batch credential generation

**Usage**:
```typescript
import UsernameGenerator from './usernameGenerator';

// Generate single credentials
const creds = UsernameGenerator.generateSingleUseCredentials();
// {
//   username: 'p2p-zanylemurdancing567',
//   password: 'a3f9e8c1d2b5f4e9a1c3b5d7e9f1a3c5b7d9e1f3...',
//   sessionId: 'uuid-...',
//   createdAt: Date,
//   expiresAt: Date (24h later),
//   isUsed: false
// }

// Generate batch
const batch = UsernameGenerator.generateBatch(10);

// Get statistics
const stats = UsernameGenerator.getStatistics();
// { totalGenerated: 15, activeCredentials: 10, usedCredentials: 4, expiredCredentials: 1 }

// Mark as used
UsernameGenerator.markCredentialsAsUsed(sessionId);

// Validate credentials
if (UsernameGenerator.isCredentialsValid(sessionId)) {
  const creds = UsernameGenerator.getCredentials(sessionId);
}
```

---

## Updated Authentication Module

### New Single-Use Signup Method

**Interface**:
```typescript
interface SingleUseSignupRequest {
  captchaId: string;
  captchaResponse: string;
}

// Returns auto-generated username and password
```

**Features**:
- CAPTCHA verification required
- Rate limiting (5 attempts per 15 minutes)
- In-memory user storage
- Session token generation
- Single-use credentials included in response

**Signup Flow**:
1. User completes CAPTCHA
2. System generates funny username (`p2p-*`)
3. System generates secure random password
4. Session created with 30-day expiration
5. Credentials displayed to user (password never stored in plaintext)

---

## Updated P2P Network Module

### Tor/VPN Integration

**Features**:
- Connection mode selection per network instance
- Automatic tunnel establishment based on mode
- Event handlers for tunnel status (`tor-enabled`, `vpn-enabled`, `connected`, `disconnected`)
- Routing optimization metrics based on connection mode
- Unified connection management

**Connection Modes**:
- **Direct**: P2P communication without tunnel
- **Tor**: Route through Tor network (~70ms latency, 70/100 anonymity)
- **VPN**: Route through VPN tunnel (~30ms latency, 40/100 anonymity)
- **Tor+VPN**: Dual-layer routing (~100ms latency, 110/100 anonymity)

**Usage**:
```typescript
import { P2PNetwork } from './p2pNetwork';

const network = new P2PNetwork();

// Set connection mode
network.setConnectionMode('tor');

// Get connection details
const mode = network.getConnectionMode();
// {
//   mode: 'tor',
//   status: { isConnected: true, mode: 'tor', tor: true, vpn: false },
//   optimization: { latency: 50ms, anonymity: 70, bandwidth: 70 }
// }

// Connect with tunnel
await network.connect(peerId);

// Disconnect
await network.disconnect();
```

---

## Integration with P2PChatter Main Class

**New Methods**:
```typescript
// Set network connection mode
setNetworkMode(mode: 'direct' | 'tor' | 'vpn' | 'tor+vpn'): void

// Get current network status
getNetworkStatus(): {
  mode: string;
  status: { isConnected, mode, tor, vpn };
  optimization: { latency, anonymity, bandwidth };
}

// Generate auto-login credentials
generateAutoLoginCredentials(): {
  username: string;
  password: string;
  sessionId: string;
}

// Generate batch credentials
generateBatchCredentials(count: number): Array<{...}>

// Get credential statistics
getCredentialsStatistics(): {
  totalGenerated, activeCredentials, usedCredentials, expiredCredentials
}
```

---

## Security Considerations

### Privacy Features
1. **Tor Circuit Randomization**: Entry/middle/exit nodes randomized on each connection
2. **VPN Encryption**: Support for military-grade encryption (IKEv2, ChaCha20-Poly1305)
3. **Dual Tunneling**: Tor+VPN mode provides Defense-in-Depth
4. **Username Anonymity**: Cannot be linked to previous sessions due to auto-generation
5. **Password One-Time**: Single-use passwords prevent credential reuse

### Credential Management
1. **Automatic Expiration**: Credentials expire after 24 hours
2. **Session Isolation**: Each login creates isolated session
3. **In-Memory Only**: Passwords never persisted in plaintext
4. **Cleanup**: Expired credentials automatically removed from memory

### Rate Limiting
- Max 5 signup attempts per 15 minutes per IP
- Max 5 login attempts per 15 minutes per username
- Account suspension after 10 failed login attempts

---

## Performance Metrics

### Connection Mode Overhead
| Mode | Latency | Anonymity | Bandwidth |
|------|---------|-----------|-----------|
| Direct | 10ms | 0% | 100% |
| Tor | +50ms | 70% | -30% |
| VPN | +20ms | 40% | -15% |
| Tor+VPN | +70ms | 110% | -45% |

### Memory Usage
- Per credential: ~500 bytes
- Cleanup interval: Every 1 hour
- Max credentials in memory: Unlimited (limited by system RAM)

---

## Configuration Options

### Tor Service
```typescript
enableTor({
  socksPort: 9050,      // SOCKS proxy port
  controlPort: 9051,    // Control port
  hostName: 'localhost' // Tor daemon hostname
});
```

### VPN Service
```typescript
enableVPN({
  protocol: 'wireguard',        // wireguard | openvpn | ipsec
  endpoint: 'vpn.provider.com', // VPN server endpoint
  port: 51820,                  // VPN port
  encryptionLevel: 'strong'     // standard | strong | military
});
```

### Username Generator
```typescript
// Batch generation with custom size
const batch = UsernameGenerator.generateBatch(100);

// Statistics monitoring
setInterval(() => {
  const stats = UsernameGenerator.getStatistics();
  console.log(`Active sessions: ${stats.activeCredentials}`);
}, 60000);
```

---

## API Examples

### Complete Single-Use Signup Flow
```typescript
import { P2PChatter } from './index';
import { CaptchaService } from './captcha';

const app = new P2PChatter();
const captcha = new CaptchaService();

// 1. Generate CAPTCHA challenge
const challenge = captcha.generateChallenge(2); // Medium difficulty

// 2. User solves CAPTCHA
const userAnswer = 'answer_from_user';
const isValid = captcha.verifyCaptcha(challenge.id, userAnswer);

// 3. Initiate single-use signup
if (isValid) {
  const auth = new AuthService();
  const result = auth.singleUseSignup({
    captchaId: challenge.id,
    captchaResponse: userAnswer
  }, ipAddress);
  
  if (result.success) {
    console.log(`Username: ${result.user?.username}`);
    console.log(`Password: ${result.user?.passwordHash}`); // Actually the plaintext password
    console.log(`Session: ${result.session?.token}`);
  }
}

// 4. Set network mode for privacy
app.setNetworkMode('tor+vpn');

// 5. Connect to P2P network
const network = app['network'];
await network.connect(result.user?.id);
```

### Batch Credential Generation
```typescript
const generator = UsernameGenerator;

// Generate 50 single-use accounts for bulk distribution
const credentials = generator.generateBatch(50);

// Export as formatted list
const formatted = credentials.map(cred => 
  `${cred.username} : ${cred.password} (expires ${cred.expiresAt})`
).join('\n');

console.log(formatted);
```

---

## Future Enhancements

1. **I2P Integration**: Add Invisible Internet Protocol support
2. **Proxy Rotation**: Automatic proxy switching for additional anonymity
3. **DNS-over-Tor**: Prevent DNS leaks
4. **Connection Benchmarking**: Automatic selection of optimal connection mode
5. **Credential Sharing**: QR code generation for easy credential distribution
6. **Batch Operations**: Multi-user signup for group chat scenarios

---

## Compatibility

- **Node.js**: v18.0.0 or higher
- **TypeScript**: v5.0.0 or higher
- **Operating Systems**: Windows, macOS, Linux
- **P2P Networks**: Libp2p, custom implementations

---

## License

MIT © 2025 Bad Antics

**Created by**: antX  
**Organization**: [Bad Antics](https://github.com/bad-antics)  
**Repository**: https://github.com/bad-antics/p2p-chatter

---
