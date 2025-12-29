# P2P Chatter - Launcher Guide

## Prerequisites

Before launching P2P Chatter, ensure you have installed:

- **Node.js v16.0.0+** - https://nodejs.org/
- **npm v7.0.0+** - Comes with Node.js

### Install Node.js

#### Windows
1. Download from https://nodejs.org/
2. Run the installer
3. Follow the installation wizard
4. Verify installation:
   ```bash
   node --version
   npm --version
   ```

#### macOS
```bash
# Using Homebrew
brew install node

# Or download from https://nodejs.org/
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt-get install nodejs npm

# Fedora/RedHat
sudo dnf install nodejs npm

# Arch
sudo pacman -S nodejs npm
```

## Launching P2P Chatter

### Step 1: Navigate to Project Directory
```bash
cd /path/to/p2p-chatter
```

### Step 2: Install Dependencies
```bash
npm install
```

This installs all required packages:
- `better-sqlite3` - Database engine
- `typescript` - TypeScript compiler
- `jest` - Testing framework
- All type definitions and dev tools

### Step 3: Build the Project
```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Step 4: Run Tests (Optional)
```bash
npm test
```

Verifies that all components are working correctly.

### Step 5: Start Development Server
```bash
npm run dev
```

Or for production:
```bash
npm start
```

## Complete Startup Script

Create a file named `start-p2p.sh` (Linux/macOS) or `start-p2p.bat` (Windows):

### Linux/macOS (start-p2p.sh)
```bash
#!/bin/bash
cd "$(dirname "$0")"

echo "Installing dependencies..."
npm install

echo ""
echo "Building project..."
npm run build

echo ""
echo "Running tests..."
npm test

echo ""
echo "Starting P2P Chatter..."
npm run dev
```

Make executable:
```bash
chmod +x start-p2p.sh
./start-p2p.sh
```

### Windows (start-p2p.bat)
```batch
@echo off
cd /d "%~dp0"

echo Installing dependencies...
npm install

echo.
echo Building project...
npm run build

echo.
echo Running tests...
npm test

echo.
echo Starting P2P Chatter...
npm run dev

pause
```

Run:
```cmd
start-p2p.bat
```

## Using P2P Chatter

Once started, you can import and use P2P Chatter in your code:

```typescript
import { AuthService, P2PNetwork, MessageStore } from 'p2p-chatter';

// Initialize
const auth = new AuthService();
const network = new P2PNetwork();
const messages = new MessageStore();

// Register user
const { userId } = auth.register('alice', 'password123');

// Login
const { token } = auth.login('alice', 'password123');

// Send message
const conversation = messages.createConversation(userId, 'bob_id');
messages.storeMessage(conversation.id, userId, 'bob_id', 'Hello!');
```

## Troubleshooting

### npm: command not found
- Node.js not installed correctly
- PATH not configured
- Restart terminal/system after Node.js installation

### Module not found errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build failures
```bash
# Update npm
npm install -g npm@latest

# Rebuild native modules
npm rebuild
```

### Port already in use
- Change port in configuration
- Kill process using the port
- Use different terminal session

## Development Workflow

### Watch Mode
```bash
# Watch TypeScript changes
npx tsc --watch
```

### Running Tests in Watch Mode
```bash
npm test -- --watch
```

### Code Coverage
```bash
npm test -- --coverage
```

### Type Checking
```bash
npx tsc --noEmit
```

## Performance Tips

1. **Install globally (optional)**
   ```bash
   npm install -g p2p-chatter
   ```

2. **Use development build**
   ```bash
   npm run dev
   ```

3. **Monitor performance**
   ```bash
   npm test -- --verbose
   ```

## Next Steps

1. Read [USAGE.md](../docs/USAGE.md) for detailed API documentation
2. Review [SECURITY.md](../docs/SECURITY.md) for security best practices
3. Check [ARCHITECTURE.md](../docs/ARCHITECTURE.md) for system design

## Getting Help

- Check [INSTALL.md](../INSTALL.md) for setup issues
- See [FAQ section in USAGE.md](../docs/USAGE.md#faq)
- Open an issue on [GitHub](https://github.com/bad-antics/p2p-chatter/issues)

---

**Version:** 1.0.0  
**Last Updated:** December 2025
