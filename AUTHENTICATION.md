# P2P Chatter Authentication System

## Overview

P2P Chatter implements a **no-email signup** authentication system with built-in **CAPTCHA bot protection**. Users only need a username and password to create an account and start messaging.

## Key Features

### ✅ No Email Required
- Simple username/password signup
- No verification emails
- Instant account creation
- 3-32 alphanumeric usernames (letters, numbers, `_`, `-`)

### 🤖 Bot Protection with CAPTCHA
- **5 difficulty levels** for adaptive challenges
- No external dependencies (all built-in)
- Challenge-response system
- Automatic cleanup of expired challenges (10-minute TTL)
- Max 5 failed attempts per challenge

### 🔐 Security Features
- **PBKDF2-SHA256** password hashing with salt
- 100,000 iterations for brute-force resistance
- Password strength validation
  - Minimum 8 characters
  - Uppercase letters required
  - Lowercase letters required
  - Numbers required
- **Rate limiting** (5 attempts per 15 minutes)
- **Account suspension** after 10 failed login attempts
- **Session tokens** with 30-day expiration
- Login attempt tracking and auditing

## CAPTCHA Difficulty Levels

### Level 1: Easy (Login)
```
What is 5 + 3?
```
Simple addition for quick verification.

### Level 2: Medium (Signup)
```
What is 47 - 12?
```
Subtraction challenges to prevent basic bots.

### Level 3: Hard
```
What is 8 × 7?
```
Multiplication for more security.

### Level 4: Word Sequence
```
Sort these in order: summer, spring, autumn
```
Requires semantic understanding.

### Level 5: Complex
```
What is 15 + 8 × 3 - 5?
```
Multi-operator math challenges.

## Authentication Flow

### Signup Flow

```typescript
1. User enters username (3-32 characters)
   - Validates format: alphanumeric, _, -
   - Checks if username already taken

2. User enters password
   - Validates strength (8+ chars, mixed case, numbers)
   - Shows real-time strength indicator

3. User confirms password
   - Must match exactly

4. User completes CAPTCHA
   - Medium difficulty challenge displayed
   - 5 attempts allowed
   - 10-minute timeout

5. Account created
   - User registered in database
   - Session token generated
   - Logged in automatically
```

### Login Flow

```typescript
1. User enters username
2. User enters password
3. Optional CAPTCHA (if security needed)
   - Easy difficulty challenge
4. Session token issued
5. User authenticated
```

## Database Schema

### `auth_users`
```sql
CREATE TABLE auth_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  passwordSalt TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastLogin DATETIME,
  verified BOOLEAN DEFAULT 1,
  status TEXT DEFAULT 'active', -- 'active', 'suspended', 'deleted'
  failedAttempts INTEGER DEFAULT 0,
  lastFailedAttempt DATETIME
);
```

### `auth_sessions`
```sql
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiresAt DATETIME NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  lastActivity DATETIME,
  FOREIGN KEY (userId) REFERENCES auth_users(id)
);
```

### `login_attempts`
```sql
CREATE TABLE login_attempts (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL, -- username or IP
  type TEXT NOT NULL, -- 'username' or 'ip'
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN,
  ipAddress TEXT
);
```

## API Endpoints

### Generate Signup CAPTCHA
```
POST /api/auth/captcha/signup
Response: { captchaId: string, challenge: string, difficulty: number }
```

### Generate Login CAPTCHA
```
POST /api/auth/captcha/login
Response: { captchaId: string, challenge: string, difficulty: number }
```

### Signup
```typescript
POST /api/auth/signup
Body: {
  username: string,
  password: string,
  captchaId: string,
  captchaResponse: string
}

Response: {
  success: boolean,
  message: string,
  user?: {
    id: string,
    username: string,
    status: string,
    createdAt: string
  },
  session?: {
    id: string,
    userId: string,
    token: string,
    expiresAt: string
  },
  error?: string
}
```

### Login
```typescript
POST /api/auth/login
Body: {
  username: string,
  password: string,
  captchaId?: string,
  captchaResponse?: string
}

Response: {
  success: boolean,
  message: string,
  user?: User,
  session?: Session,
  error?: string
}
```

### Verify Session
```
POST /api/auth/verify
Headers: { Authorization: "Bearer {token}" }

Response: {
  valid: boolean,
  user?: User
}
```

### Logout
```
POST /api/auth/logout
Headers: { Authorization: "Bearer {token}" }

Response: { success: boolean }
```

## Implementation Examples

### React Web UI Signup
```typescript
import { AuthPage } from './pages/AuthPage';

<AuthPage onAuthenticated={() => setIsLoggedIn(true)} />
```

### CLI Signup
```typescript
import { CLIAuth } from './cliAuth';

const cliAuth = new CLIAuth();
const choice = await cliAuth.showAuthMenu();

if (choice === 'signup') {
  const credentials = await cliAuth.signup();
  // Send to API: POST /api/auth/signup
}
```

### Backend Authentication
```typescript
import { AuthService } from './auth';

const authService = new AuthService('./db/auth.db');

// Signup
const signupResponse = authService.signup({
  username: 'alice',
  password: 'SecurePass123',
  captchaId: 'xxx',
  captchaResponse: '56'
});

// Login
const loginResponse = authService.login({
  username: 'alice',
  password: 'SecurePass123'
});

// Verify session
const verification = authService.verifySession(sessionToken);

if (verification.valid) {
  console.log('User:', verification.user?.username);
}
```

## Password Security

### Strength Indicators
- **Very Weak** (1/5): No uppercase, lowercase, and numbers
- **Weak** (2/5): Has uppercase + lowercase or numbers
- **Fair** (3/5): Has uppercase + lowercase + numbers
- **Good** (4/5): Good length + mixed case + numbers
- **Strong** (5/5): Good length + mixed case + numbers + special chars

### Hashing Process
```
1. Generate random 32-byte salt
2. PBKDF2-SHA256(password, salt, 100000 iterations, 32 bytes)
3. Store: salt + hash
4. Never store plain password
```

### Verification
```
1. User provides password
2. Retrieve stored salt from database
3. Hash provided password with stored salt
4. Compare hashes (constant-time comparison)
5. Reject if no match
```

## Rate Limiting

### Per Username
- Max 5 failed attempts per 15 minutes
- Counter resets after 15 minutes
- After 10 total failures → account suspended

### Per IP Address
- Max 5 signup attempts per 15 minutes
- Max 5 login attempts per 15 minutes
- Tracked separately from username limits

## Account Status

### Active
- User can login and use the app

### Suspended
- After 10 failed login attempts
- Admin can manually unsuspend
- Can be auto-unsuspended after time period

### Deleted
- User requested deletion
- Account marked as deleted
- No reactivation available

## CAPTCHA Algorithm

### Challenge Generation
```typescript
// Easy: a + b
generateEasyMath(): "What is 5 + 3?|8"

// Medium: a - b
generateMediumMath(): "What is 47 - 12?|35"

// Hard: a × b
generateHardMath(): "What is 8 × 7?|56"

// Word: sort sequence
generateWordSequence(): "Sort these: [summer, spring, autumn]|[spring, summer, autumn]"

// Complex: a OP b OP c
generateComplexChallenge(): "What is 15 + 8 × 3 - 5?|34"
```

### Verification
```typescript
// For math: parse "|" and compare answer
// For words: calculate string similarity (>0.8 = valid)

validateResponse(challenge, response, difficulty):
  if (difficulty >= 4):
    return stringSimilarity(response, expected) > 0.8
  else:
    return response === expected
```

## Security Considerations

### ✅ Protected Against
- Brute force attacks (rate limiting)
- Bot signup (CAPTCHA)
- Password cracking (PBKDF2, slow hash)
- Session hijacking (token expiration)
- Timing attacks (constant-time comparison)
- SQL injection (parameterized queries)

### ⚠️ Not Protected Against
- Phishing attacks (user responsibility)
- Weak passwords (user choice)
- Compromised user devices (OS-level)
- Network eavesdropping (use HTTPS/TLS)

### 🔒 Recommendations
- Use HTTPS/TLS for all API communication
- Implement 2FA for sensitive operations
- Regular security audits
- Keep dependencies updated
- Monitor login attempts for suspicious patterns
- Implement email notifications for new logins

## Configuration

### Environment Variables
```bash
AUTH_SESSION_DURATION=2592000000  # 30 days in ms
AUTH_RATE_LIMIT_ATTEMPTS=5        # Max failed attempts
AUTH_RATE_LIMIT_WINDOW=900000     # 15 minutes in ms
AUTH_CAPTCHA_TTL=600000           # 10 minutes in ms
AUTH_MAX_CAPTCHA_ATTEMPTS=5       # Max CAPTCHA attempts
```

### Database Path
```typescript
const authService = new AuthService('./data/p2p-chatter.db');
```

## Testing

### Manual Testing

#### Test Signup
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "TestPass123",
    "captchaId": "xxx",
    "captchaResponse": "answer"
  }'
```

#### Test Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "TestPass123"
  }'
```

#### Test Session Verification
```bash
curl -X POST http://localhost:5000/api/auth/verify \
  -H "Authorization: Bearer {token}"
```

### Unit Tests
```typescript
describe('AuthService', () => {
  it('should reject weak passwords', () => {
    // Test validation
  });

  it('should hash passwords securely', () => {
    // Test hashing
  });

  it('should enforce rate limiting', () => {
    // Test rate limit
  });

  it('should verify CAPTCHA correctly', () => {
    // Test CAPTCHA
  });
});
```

## Troubleshooting

### "Username already taken"
- Try a different username
- Check for typos in original attempt
- Usernames are case-sensitive but stored lowercase

### "Password does not meet requirements"
- Must be 8+ characters
- Must have uppercase letters (A-Z)
- Must have lowercase letters (a-z)
- Must have numbers (0-9)

### "CAPTCHA verification failed"
- Ensure exact answer format
- Check for typos
- Some challenges accept partial matches (word ordering)
- Can reload CAPTCHA for a new challenge

### "Too many login attempts"
- Account locked for 15 minutes
- Try again later
- Admin can manually unlock if needed

### "Account is suspended"
- User has exceeded max failed attempts
- Contact admin for unsuspension
- Security feature to prevent brute force

## Future Enhancements

- [ ] Two-Factor Authentication (TOTP/SMS)
- [ ] Biometric authentication (fingerprint/face)
- [ ] OAuth integration (GitHub, Google, etc.)
- [ ] Email verification option
- [ ] Password reset via recovery code
- [ ] Login history and device management
- [ ] Suspicious login alerts
- [ ] IP whitelisting
- [ ] Geographic login restrictions

---

**Last Updated**: December 2025  
**Version**: 1.0  
**Author**: bad-antics  
**License**: MIT
