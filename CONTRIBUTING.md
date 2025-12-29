# Contributing to P2P Chatter

We love your input! We want to make contributing to P2P Chatter as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

1. Fork the repo and create your branch from `develop`
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. If you've added code that should be tested, add tests
4. Ensure your code follows our TypeScript style guide
5. Make sure your code compiles: `npm run build`
6. Submit a pull request to the `develop` branch

## Pull Request Process

1. Update README.md with details of changes to the interface, if applicable
2. Update AUTHENTICATION.md or other docs if changing auth behavior
3. Increase version numbers in package.json following [Semantic Versioning](https://semver.org/)
4. Ensure all tests pass (when available)
5. Request review from maintainers
6. Address any review feedback

## Reporting Bugs

When reporting a bug, please include:

- A clear, descriptive title
- A detailed description of the issue
- Steps to reproduce the problem
- Expected behavior vs actual behavior
- Relevant code samples if applicable
- Your environment (OS, Node version, etc.)

## Proposing Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement request:

- Use a clear, descriptive title
- Provide a detailed description of the suggested enhancement
- List some examples of existing systems that have this feature
- Explain why this enhancement would be useful

## Code Style

- Use TypeScript (strict mode)
- Follow ESLint configuration in the repository
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Example:
```
Add CAPTCHA verification to signup process

- Implement 5-difficulty CAPTCHA system
- Add challenge-response validation
- Integrate with AuthService

Closes #42
```

## License

By contributing, you agree that your contributions will be licensed under its MIT License.

## Questions?

Feel free to open an issue with the label `question` or contact the maintainers.

Thank you for contributing to P2P Chatter! 🎉
