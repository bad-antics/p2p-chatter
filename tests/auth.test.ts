import { AuthService } from '../src/auth';
import { CaptchaService } from '../src/captcha';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

describe('Authentication System', () => {
  let authService: AuthService;
  let captchaService: CaptchaService;
  let testDb: Database.Database;

  beforeAll(() => {
    // Create temporary test database
    const testDbPath = path.join(__dirname, 'test-auth.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    testDb = new Database(testDbPath);
    captchaService = new CaptchaService();
    authService = new AuthService(testDb, captchaService);
  });

  afterAll(() => {
    testDb.close();
    const testDbPath = path.join(__dirname, 'test-auth.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Signup', () => {
    it('should successfully create a new user account', () => {
      const captchaChallenge = captchaService.generateChallenge(1);
      
      const result = authService.signup(
        {
          username: 'testuser',
          password: 'TestPassword123!',
          captchaId: captchaChallenge.id,
          captchaAnswer: captchaChallenge.answer,
        },
        '127.0.0.1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.token).toBeDefined();
      expect(result.data?.user.username).toBe('testuser');
    });

    it('should reject duplicate usernames', () => {
      const captchaChallenge = captchaService.generateChallenge(1);
      
      // First signup
      authService.signup(
        {
          username: 'duplicate',
          password: 'TestPassword123!',
          captchaId: captchaChallenge.id,
          captchaAnswer: captchaChallenge.answer,
        },
        '127.0.0.1'
      );

      // Attempt duplicate
      const captchaChallenge2 = captchaService.generateChallenge(1);
      const result = authService.signup(
        {
          username: 'duplicate',
          password: 'TestPassword123!',
          captchaId: captchaChallenge2.id,
          captchaAnswer: captchaChallenge2.answer,
        },
        '127.0.0.1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should reject weak passwords', () => {
      const captchaChallenge = captchaService.generateChallenge(1);
      
      const result = authService.signup(
        {
          username: 'weakpass',
          password: 'weak', // Too short and weak
          captchaId: captchaChallenge.id,
          captchaAnswer: captchaChallenge.answer,
        },
        '127.0.0.1'
      );

      expect(result.success).toBe(false);
    });

    it('should reject invalid CAPTCHA', () => {
      const captchaChallenge = captchaService.generateChallenge(1);
      
      const result = authService.signup(
        {
          username: 'badcaptcha',
          password: 'TestPassword123!',
          captchaId: captchaChallenge.id,
          captchaAnswer: 'wrong answer',
        },
        '127.0.0.1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('captcha');
    });
  });

  describe('Login', () => {
    beforeEach(() => {
      const captchaChallenge = captchaService.generateChallenge(1);
      authService.signup(
        {
          username: 'logintest',
          password: 'TestPassword123!',
          captchaId: captchaChallenge.id,
          captchaAnswer: captchaChallenge.answer,
        },
        '127.0.0.1'
      );
    });

    it('should successfully login with correct credentials', () => {
      const captchaChallenge = captchaService.generateChallenge(1);
      
      const result = authService.login(
        {
          username: 'logintest',
          password: 'TestPassword123!',
          captchaId: captchaChallenge.id,
          captchaAnswer: captchaChallenge.answer,
        },
        '127.0.0.1'
      );

      expect(result.success).toBe(true);
      expect(result.data?.token).toBeDefined();
    });

    it('should reject incorrect password', () => {
      const captchaChallenge = captchaService.generateChallenge(1);
      
      const result = authService.login(
        {
          username: 'logintest',
          password: 'WrongPassword123!',
          captchaId: captchaChallenge.id,
          captchaAnswer: captchaChallenge.answer,
        },
        '127.0.0.1'
      );

      expect(result.success).toBe(false);
    });
  });

  describe('Session Verification', () => {
    it('should verify valid session tokens', () => {
      const captchaChallenge = captchaService.generateChallenge(1);
      const signupResult = authService.signup(
        {
          username: 'sessiontest',
          password: 'TestPassword123!',
          captchaId: captchaChallenge.id,
          captchaAnswer: captchaChallenge.answer,
        },
        '127.0.0.1'
      );

      const token = signupResult.data?.token;
      const verified = authService.verifySession(token!);

      expect(verified).toBeDefined();
      expect(verified?.username).toBe('sessiontest');
    });

    it('should reject invalid tokens', () => {
      const verified = authService.verifySession('invalid-token-12345');
      expect(verified).toBeNull();
    });
  });
});
