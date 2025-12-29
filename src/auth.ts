import crypto from 'crypto';
import Database from 'better-sqlite3';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import CaptchaService from './captcha';

/**
 * Authentication Module
 * Features:
 * - Username/password authentication (no email required)
 * - CAPTCHA bot protection
 * - Password hashing with salt (PBKDF2)
 * - Session management
 * - Rate limiting per IP/username
 */

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
  private db: Database.Database;
  private captcha: CaptchaService;
  private rateLimits: Map<string, { attempts: number; resetTime: number }> = new Map();
  private readonly PASSWORD_HASH_ITERATIONS = 100000;
  private readonly PASSWORD_SALT_SIZE = 32;
  private readonly SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly RATE_LIMIT_ATTEMPTS = 5;
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private logger = logger;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.captcha = new CaptchaService();
    this.initializeDatabase();
  }

  /**
   * Initialize auth tables in database
   */
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        passwordSalt TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastLogin DATETIME,
        verified BOOLEAN DEFAULT 1,
        status TEXT DEFAULT 'active',
        failedAttempts INTEGER DEFAULT 0,
        lastFailedAttempt DATETIME
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
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

      CREATE TABLE IF NOT EXISTS login_attempts (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL, -- username or IP
        type TEXT NOT NULL, -- 'username' or 'ip'
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        success BOOLEAN,
        ipAddress TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_auth_users_username ON auth_users(username);
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_userId ON auth_sessions(userId);
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier);
    `);

    this.logger.info('Initialized authentication database');
  }

  /**
   * Generate CAPTCHA challenge for signup
   */
  generateSignupCaptcha(): string {
    const challenge = this.captcha.generateChallenge(2); // Medium difficulty
    return challenge.id;
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

    // Hash password
    const { hash, salt } = this.hashPassword(request.password);

    // Create user
    const userId = uuidv4();
    const now = new Date().toISOString();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO auth_users (id, username, passwordHash, passwordSalt, createdAt, verified, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(userId, request.username, hash, salt, now, 1, 'active');

      const user: User = {
        id: userId,
        username: request.username,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: now,
        verified: true,
        status: 'active',
      };

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

    const stmt = this.db.prepare(`
      INSERT INTO auth_sessions (id, userId, token, createdAt, expiresAt, ipAddress, lastActivity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      userId,
      token,
      now.toISOString(),
      expiresAt.toISOString(),
      ipAddress || null,
      now.toISOString()
    );

    return {
      id: sessionId,
      userId,
      token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ipAddress,
    };
  }

  /**
   * Verify session token
   */
  verifySession(token: string): { valid: boolean; userId?: string; user?: User } {
    const stmt = this.db.prepare(`
      SELECT id, userId, expiresAt
      FROM auth_sessions
      WHERE token = ?
      LIMIT 1
    `);

    const session = stmt.get(token) as any;

    if (!session || new Date(session.expiresAt) < new Date()) {
      return { valid: false };
    }

    const user = this.getUserById(session.userId);
    if (!user || user.status !== 'active') {
      return { valid: false };
    }

    // Update last activity
    const updateStmt = this.db.prepare(`
      UPDATE auth_sessions
      SET lastActivity = ?
      WHERE id = ?
    `);
    updateStmt.run(new Date().toISOString(), session.id);

    return { valid: true, userId: session.userId, user };
  }

  /**
   * Logout (invalidate session)
   */
  logout(token: string): boolean {
    const stmt = this.db.prepare('DELETE FROM auth_sessions WHERE token = ?');
    const result = stmt.run(token);
    return result.changes > 0;
  }

  /**
   * Get user by username
   */
  private getUserByUsername(username: string): User | null {
    const stmt = this.db.prepare(`
      SELECT id, username, passwordHash, passwordSalt, createdAt, lastLogin, verified, status
      FROM auth_users
      WHERE username = ?
      LIMIT 1
    `);

    return stmt.get(username) as User | null;
  }

  /**
   * Get user by ID
   */
  private getUserById(id: string): User | null {
    const stmt = this.db.prepare(`
      SELECT id, username, passwordHash, passwordSalt, createdAt, lastLogin, verified, status
      FROM auth_users
      WHERE id = ?
      LIMIT 1
    `);

    return stmt.get(id) as User | null;
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
    const stmt = this.db.prepare(`
      INSERT INTO login_attempts (id, identifier, type, timestamp, success, ipAddress)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(uuidv4(), identifier, 'username', new Date().toISOString(), success ? 1 : 0, ipAddress || null);
  }

  /**
   * Increment failed login attempts
   */
  private incrementFailedAttempts(userId: string): void {
    const stmt = this.db.prepare(`
      UPDATE auth_users
      SET failedAttempts = failedAttempts + 1,
          lastFailedAttempt = ?
      WHERE id = ?
    `);

    stmt.run(new Date().toISOString(), userId);

    // Lock account after 10 failed attempts
    const userStmt = this.db.prepare('SELECT failedAttempts FROM auth_users WHERE id = ?');
    const user = userStmt.get(userId) as any;

    if (user && user.failedAttempts >= 10) {
      const lockStmt = this.db.prepare('UPDATE auth_users SET status = ? WHERE id = ?');
      lockStmt.run('suspended', userId);
      this.logger.warn(`Account suspended due to failed attempts: ${userId}`);
    }
  }

  /**
   * Reset failed login attempts
   */
  private resetFailedAttempts(userId: string): void {
    const stmt = this.db.prepare(`
      UPDATE auth_users
      SET failedAttempts = 0
      WHERE id = ?
    `);

    stmt.run(userId);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

export default AuthService;
