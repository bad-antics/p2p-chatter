/**
 * P2P Chatter - Authentication Module
 * Created by antX | Organization: Bad Antics (https://github.com/bad-antics)
 * ©2025 Bad Antics. All rights reserved.
 * 
 * Features:
 * - Username/password authentication (no email required)
 * - CAPTCHA bot protection
 * - Password hashing with salt (PBKDF2)
 * - Session management
 * - Rate limiting per IP/username
 */

import crypto from 'crypto';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import CaptchaService from './captcha';
import UsernameGenerator from './usernameGenerator';

const logger = pino({ name: 'AuthService' });

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  lastLogin?: string;
  verified: boolean;
  status: 'active' | 'suspended' | 'deleted';
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SignupRequest {
  username: string;
  password: string;
  captchaId: string;
  captchaResponse: string;
}

export interface SingleUseSignupRequest {
  captchaId: string;
  captchaResponse: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  captchaId?: string;
  captchaResponse?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  session?: Session;
  error?: string;
}

export class AuthService {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private captcha: CaptchaService;
  private rateLimits: Map<string, { attempts: number; resetTime: number }> = new Map();
  private readonly PASSWORD_HASH_ITERATIONS = 100000;
  private readonly PASSWORD_SALT_SIZE = 32;
  private readonly SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly RATE_LIMIT_ATTEMPTS = 5;
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private logger = logger;

  constructor(dbPath?: string) {
    this.captcha = new CaptchaService();
    this.logger.info('AuthService initialized (in-memory)');
  }

  /**
   * Generate CAPTCHA challenge for signup
   */
  generateSignupCaptcha(): string {
    const challenge = this.captcha.generateChallenge(2); // Medium difficulty
    return challenge.id;
  }

  /**
   * Single-use signup with auto-generated credentials
   * Returns auto-generated username and password
   */
  singleUseSignup(request: SingleUseSignupRequest, ipAddress?: string): AuthResponse {
    // Check CAPTCHA
    const captchaVerification = this.captcha.verifyCaptcha(
      request.captchaId,
      request.captchaResponse
    );

    if (!captchaVerification.isValid) {
      this.recordLoginAttempt('single-use-signup', false, ipAddress);
      return {
        success: false,
        message: 'CAPTCHA verification failed. Please try again.',
        error: 'CAPTCHA_FAILED',
      };
    }

    // Check rate limiting
    if (this.isRateLimited(`signup:${ipAddress}`)) {
      return {
        success: false,
        message: 'Too many signup attempts. Please try again later.',
        error: 'RATE_LIMITED',
      };
    }

    // Generate credentials
    const generatedCreds = UsernameGenerator.generateSingleUseCredentials();
    const username = generatedCreds.username;
    const password = generatedCreds.password;

    // Hash password
    const { hash, salt } = this.hashPassword(password);

    // Create user
    const userId = uuidv4();
    const now = new Date().toISOString();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO auth_users (id, username, passwordHash, passwordSalt, createdAt, verified, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(userId, username, hash, salt, now, 1, 'active');

      const user: User = {
        id: userId,
        username,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: now,
        verified: true,
        status: 'active',
      };

      this.recordLoginAttempt(username, true, ipAddress);
      this.logger.info(`Single-use account created: ${username} (Session: ${generatedCreds.sessionId})`);

      // Create initial session
      const session = this.createSession(userId, ipAddress);

      return {
        success: true,
        message: 'Account created with auto-generated credentials!',
        user: { ...user, passwordHash: password }, // Return plaintext password for display
        session,
      };
    } catch (error) {
      this.logger.error(`Single-use signup error: ${error}`);
      return {
        success: false,
        message: 'An error occurred during signup.',
        error: 'SIGNUP_ERROR',
      };
    }
  }

  /**
   * Generate CAPTCHA challenge for login
   */
  generateLoginCaptcha(): string {
    const challenge = this.captcha.generateChallenge(1); // Easy difficulty
    return challenge.id;
  }

  /**
   * Get CAPTCHA challenge for display
   */
  getCaptchaChallenge(captchaId: string): { challenge: string; difficulty: number } | null {
    return this.captcha.getChallengDisplay(captchaId);
  }

  /**
   * Register a new user
   */
  signup(request: SignupRequest, ipAddress?: string): AuthResponse {
    // Validate username
    if (!this.isValidUsername(request.username)) {
      return {
        success: false,
        message: 'Invalid username. Use 3-32 alphanumeric characters.',
        error: 'INVALID_USERNAME',
      };
    }

    // Validate password
    if (!this.isValidPassword(request.password)) {
      return {
        success: false,
        message: 'Password must be at least 8 characters with uppercase, lowercase, and numbers.',
        error: 'INVALID_PASSWORD',
      };
    }

    // Check CAPTCHA
    const captchaVerification = this.captcha.verifyCaptcha(
      request.captchaId,
      request.captchaResponse
    );

    if (!captchaVerification.isValid) {
      this.recordLoginAttempt(request.username, false, ipAddress);
      return {
        success: false,
        message: 'CAPTCHA verification failed. Please try again.',
        error: 'CAPTCHA_FAILED',
      };
    }

    // Check rate limiting
    if (this.isRateLimited(`signup:${ipAddress}`)) {
      return {
        success: false,
        message: 'Too many signup attempts. Please try again later.',
        error: 'RATE_LIMITED',
      };
    }

    // Check if username already exists
    const existingUser = this.getUserByUsername(request.username);
    if (existingUser) {
      this.recordLoginAttempt(request.username, false, ipAddress);
      return {
        success: false,
        message: 'Username already taken.',
        error: 'USERNAME_TAKEN',
      };
    }

    // Create user
    const userId = uuidv4();
    const now = new Date().toISOString();

    const user: User = {
      id: userId,
      username: request.username,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: now,
      verified: true,
      status: 'active',
    };

    this.users.set(userId, user);
    this.recordLoginAttempt(request.username, true, ipAddress);
    this.logger.info(`New user registered: ${request.username}`);

    // Create initial session
    const session = this.createSession(userId, ipAddress);

    return {
      success: true,
      message: 'Account created successfully!',
      user,
      session,
    };
  } catch (error) {
    this.logger.error(`Signup error: ${error}`);
    return {
      success: false,
      message: 'An error occurred during signup.',
      error: 'SIGNUP_ERROR',
    };
  }

  /**
   * Login with username and password
   */
  login(request: LoginRequest, ipAddress?: string): AuthResponse {
    // Check rate limiting
    if (this.isRateLimited(`login:${request.username}`)) {
      return {
        success: false,
        message: 'Too many login attempts. Account temporarily locked.',
        error: 'RATE_LIMITED',
      };
    }

    if (ipAddress && this.isRateLimited(`login:${ipAddress}`)) {
      return {
        success: false,
        message: 'Too many login attempts from this IP.',
        error: 'RATE_LIMITED',
      };
    }

    // Get user
    const user = this.getUserByUsername(request.username);
    if (!user) {
      this.recordLoginAttempt(request.username, false, ipAddress);
      return {
        success: false,
        message: 'Invalid username or password.',
        error: 'INVALID_CREDENTIALS',
      };
    }

    // Check account status
    if (user.status !== 'active') {
      return {
        success: false,
        message: `Account is ${user.status}.`,
        error: 'ACCOUNT_NOT_ACTIVE',
      };
    }

    // Verify password
    if (!this.verifyPassword(request.password, user.passwordHash, user.passwordSalt)) {
      this.incrementFailedAttempts(user.id);
      this.recordLoginAttempt(request.username, false, ipAddress);
      return {
        success: false,
        message: 'Invalid username or password.',
        error: 'INVALID_CREDENTIALS',
      };
    }

    // Verify CAPTCHA if provided (for suspicious activity)
    if (request.captchaId && request.captchaResponse) {
      const captchaVerification = this.captcha.verifyCaptcha(
        request.captchaId,
        request.captchaResponse
      );

      if (!captchaVerification.isValid) {
        return {
          success: false,
          message: 'CAPTCHA verification failed.',
          error: 'CAPTCHA_FAILED',
        };
      }
    }

    // Reset failed attempts
    this.resetFailedAttempts(user.id);
    this.recordLoginAttempt(request.username, true, ipAddress);

    // Update last login
    const stmt = this.db.prepare(`
      UPDATE auth_users
      SET lastLogin = ?
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), user.id);

    // Create session
    const session = this.createSession(user.id, ipAddress);

    this.logger.info(`User logged in: ${request.username}`);

    return {
      success: true,
      message: 'Login successful!',
      user,
      session,
    };
  }

  /**
   * Create a new session
   */
  private createSession(userId: string, ipAddress?: string): Session {
    const sessionId = uuidv4();
    const token = this.generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_DURATION);

    const session: Session = {
      id: sessionId,
      userId,
      token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ipAddress,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Verify session token
   */
  verifySession(token: string): { valid: boolean; userId?: string; user?: User } {
    for (const session of this.sessions.values()) {
      if (session.token === token) {
        if (new Date(session.expiresAt) < new Date()) {
          return { valid: false };
        }

        const user = this.getUserById(session.userId);
        if (!user || user.status !== 'active') {
          return { valid: false };
        }

        return { valid: true, userId: session.userId, user };
      }
    }
    return { valid: false };
  }

  /**
   * Logout (invalidate session)
   */
  logout(token: string): boolean {
    for (const [id, session] of this.sessions.entries()) {
      if (session.token === token) {
        this.sessions.delete(id);
        return true;
      }
    }
    return false;
  }

  /**
   * Get user by username
   */
  private getUserByUsername(username: string): User | null {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  }

  /**
   * Get user by ID
   */
  private getUserById(id: string): User | null {
    return this.users.get(id) || null;
  }

  /**
   * Hash password with salt
   */
  private hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(this.PASSWORD_SALT_SIZE).toString('hex');
    const hash = crypto
      .pbkdf2Sync(password, salt, this.PASSWORD_HASH_ITERATIONS, 32, 'sha256')
      .toString('hex');

    return { hash, salt };
  }

  /**
   * Verify password
   */
  private verifyPassword(password: string, hash: string, salt: string): boolean {
    const computed = crypto
      .pbkdf2Sync(password, salt, this.PASSWORD_HASH_ITERATIONS, 32, 'sha256')
      .toString('hex');

    return computed === hash;
  }

  /**
   * Generate session token
   */
  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate username format
   */
  private isValidUsername(username: string): boolean {
    return /^[a-zA-Z0-9_-]{3,32}$/.test(username);
  }

  /**
   * Validate password strength
   */
  private isValidPassword(password: string): boolean {
    return (
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password)
    );
  }

  /**
   * Check rate limiting
   */
  private isRateLimited(identifier: string): boolean {
    const limit = this.rateLimits.get(identifier);

    if (!limit) {
      this.rateLimits.set(identifier, {
        attempts: 1,
        resetTime: Date.now() + this.RATE_LIMIT_WINDOW,
      });
      return false;
    }

    if (Date.now() > limit.resetTime) {
      this.rateLimits.set(identifier, {
        attempts: 1,
        resetTime: Date.now() + this.RATE_LIMIT_WINDOW,
      });
      return false;
    }

    limit.attempts++;
    return limit.attempts > this.RATE_LIMIT_ATTEMPTS;
  }

  /**
   * Record login attempt
   */
  private recordLoginAttempt(
    identifier: string,
    success: boolean,
    ipAddress?: string
  ): void {
    this.logger.debug({ identifier, success, ipAddress }, 'Login attempt recorded');
    // In-memory logging only
  }

  /**
   * Increment failed login attempts
   */
  private incrementFailedAttempts(userId: string): void {
    const user = this.getUserById(userId);
    if (user) {
      user.status = user.status || 'active';
      this.logger.debug({ userId }, 'Failed attempt incremented');
    }
  }

  /**
   * Reset failed login attempts
   */
  private resetFailedAttempts(userId: string): void {
    // In-memory only
  }

  /**
   * Close (no-op for in-memory storage)
   */
  close(): void {
    this.logger.info('AuthService closed');
  }
}

export default AuthService;
