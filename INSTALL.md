# Installation Guide - P2P Chatter

## Prerequisites

Before installing P2P Chatter, ensure you have the following installed:

- **Node.js** v16.0.0 or higher
- **npm** v7.0.0 or higher (comes with Node.js)
- **Python** v3.8+ (for native modules compilation)
- **Build Tools** (required for building native dependencies)

### Windows Users

Install Windows Build Tools:

```bash
npm install -g windows-build-tools
```

### macOS Users

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

### Linux Users

Install build essentials:

```bash
# Ubuntu/Debian
sudo apt-get install build-essential python3

# Fedora/RedHat
sudo dnf install gcc gcc-c++ make python3

# Arch
sudo pacman -S base-devel python3
```

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/bad-antics/p2p-chatter.git
cd p2p-chatter
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- `better-sqlite3` - Local database
- `typescript` - TypeScript compiler
- `jest` - Testing framework
- Development tools and type definitions

### 3. Build the Project

```bash
npm run build
```

This compiles TypeScript source files to JavaScript in the `dist/` directory.

### 4. Verify Installation

```bash
npm test
```

Run the test suite to verify everything is working correctly.

## Installation Issues & Solutions

### Issue: `better-sqlite3` Build Error

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Rebuild dependencies
npm rebuild

# Reinstall
npm install
```

### Issue: Python Not Found

**Solution:** Set Python path explicitly:
```bash
npm install --python=/path/to/python3
```

### Issue: Permission Denied (Linux/macOS)

**Solution:** Use `sudo` if necessary:
```bash
sudo npm install -g npm
npm install
```

### Issue: Module Not Found

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Post-Installation

Once installed successfully:

1. **Database Setup** - Automatically created on first use
2. **Configuration** - Create `.env` file for custom settings
3. **Development** - Use `npm run dev` for development mode
4. **Production** - Use `npm run build && npm start`

## Verifying the Installation

```bash
# Check compiled output
ls -la dist/

# Run a quick test
node -e "const p2p = require('./dist/index.js'); console.log(p2p.NAME, p2p.VERSION);"
```

Output should be:
```
P2P Chatter 1.0.0
```

## Next Steps

- See [USAGE.md](./docs/USAGE.md) for how to use P2P Chatter
- Check [API Documentation](./docs/API.md) for detailed API reference
- Read [SECURITY.md](./docs/SECURITY.md) for security considerations

## Getting Help

If you encounter issues:

1. Check the [FAQ](./docs/FAQ.md)
2. Search [existing issues](https://github.com/bad-antics/p2p-chatter/issues)
3. Create a [new issue](https://github.com/bad-antics/p2p-chatter/issues/new)

## Uninstallation

To remove P2P Chatter:

```bash
# Remove node_modules and cache
rm -rf node_modules package-lock.json

# Remove compiled files
rm -rf dist/

# Remove database (optional)
rm -f p2p_chatter.db
```

---

**Last Updated:** December 2025  
**Version:** 1.0.0
