# Contributing to P2P Chatter

Thank you for your interest in contributing to P2P Chatter! We welcome contributions from everyone.

## Code of Conduct

This project adheres to the Contributor Covenant Code of Conduct. By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs
- Check if the bug has already been reported in Issues
- If not, create a new issue with:
  - Clear title and description
  - Steps to reproduce
  - Expected vs actual behavior
  - Your environment details (Node.js version, OS, etc.)

### Suggesting Enhancements
- Check existing issues and discussions first
- Describe the enhancement clearly
- Explain the use case and benefits
- List any alternative approaches

### Pull Requests
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request with detailed description

## Development Setup

```bash
# Clone the repository
git clone https://github.com/bad-antics/p2p-chatter.git
cd p2p-chatter

# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build
```

## Code Standards
- Follow TypeScript strict mode
- Write clear, descriptive variable names
- Include JSDoc comments for public APIs
- Add tests for new functionality
- Keep functions focused and single-purpose
- Use async/await instead of callbacks

## Testing

```bash
# Run the test suite
npm test

# Run tests in watch mode
npm test -- --watch

# Check code coverage
npm test -- --coverage
```

## Documentation

- Update README.md for user-facing changes
- Update API documentation for technical changes
- Include examples for new features
- Keep documentation in sync with code

## Getting Help
- Check the README.md for general usage
- Review AUTHENTICATION.md for auth-related questions
- Check existing issues and pull requests
- Open a GitHub Discussion for questions

Thank you for contributing!
