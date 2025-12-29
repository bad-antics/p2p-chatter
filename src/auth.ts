import * as crypto from 'crypto';
import Database from 'better-sqlite3';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: Date;
  lastLogin?: Date;
  suspended: boolean;
  suspendedUntil?: Date;
  failedAttempts: number;
}

export interface SessionToken {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  valid: boolean;
}

export class AuthService {
  private db: Database.Database;
  private readonly HASH_ITERATIONS = 100000;
  private readonly HASH_ALGORITHM = 'sha256';
  private readonly SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly MAX_FAILED_ATTEMPTS = 10;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private sessions: Map<string, SessionToken> = new Map();

  constructor(dbPath: string = './p2p_chatter.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        suspended INTEGER DEFAULT 0,
        suspended_until DATETIME,
        failed_attempts INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        valid INTEGER DEFAULT 1,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);
  }

  register(username: string, password: string): { success: boolean; userId?: string; error?: string } {
    if (username.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters' };
    }

    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    try {
      const userId = crypto.randomUUID();
      const salt = crypto.randomBytes(32).toString('hex');
      const hash = this.hashPassword(password, salt);

      const stmt = this.db.prepare(`
        INSERT INTO users (id, username, password_hash, password_salt)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(userId, username, hash, salt);
      return { success: true, userId };
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Username already exists' };
      }
      return { success: false, error: error.message };
    }
  }

  login(username: string, password: string): { success: boolean; token?: string; userId?: string; error?: string } {
    const user = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Check if account is suspended
    if (user.suspended) {
      const suspendedUntil = new Date(user.suspended_until);
      if (new Date() < suspendedUntil) {
        return { success: false, error: 'Account temporarily suspended' };
      }
      // Lift suspension
      const unsuspendStmt = this.db.prepare('UPDATE users SET suspended = 0 WHERE id = ?');
      unsuspendStmt.run(user.id);
    }

    // Verify password
    const hash = this.hashPassword(password, user.password_salt);
    if (hash !== user.password_hash) {
      // Increment failed attempts
      const failedAttempts = (user.failed_attempts || 0) + 1;
      const updateStmt = this.db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?');
      updateStmt.run(failedAttempts, user.id);

      // Suspend if too many failed attempts
      if (failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
        const suspendUntil = new Date(Date.now() + this.LOCKOUT_DURATION);
        const suspendStmt = this.db.prepare(
          'UPDATE users SET suspended = 1, suspended_until = ? WHERE id = ?'
        );
        suspendStmt.run(suspendUntil.toISOString(), user.id);
        return { success: false, error: 'Account suspended due to too many failed attempts' };
      }

      return { success: false, error: 'Invalid username or password' };
    }

    // Reset failed attempts on successful login
    const resetStmt = this.db.prepare('UPDATE users SET failed_attempts = 0, last_login = ? WHERE id = ?');
    resetStmt.run(new Date().toISOString(), user.id);

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.SESSION_DURATION);

    const sessionStmt = this.db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `);

    sessionStmt.run(token, user.id, expiresAt.toISOString());

    return {
      success: true,
      token,
      userId: user.id
    };
  }

  validateSession(token: string): { valid: boolean; userId?: string } {
    const session = this.db.prepare(
      'SELECT * FROM sessions WHERE token = ? AND valid = 1'
    ).get(token) as any;

    if (!session) {
      return { valid: false };
    }

    const expiresAt = new Date(session.expires_at);
    if (new Date() > expiresAt) {
      const invalidateStmt = this.db.prepare('UPDATE sessions SET valid = 0 WHERE token = ?');
      invalidateStmt.run(token);
      return { valid: false };
    }

    return { valid: true, userId: session.user_id };
  }

  private hashPassword(password: string, salt: string): string {
    return crypto
      .pbkdf2Sync(password, salt, this.HASH_ITERATIONS, 64, this.HASH_ALGORITHM)
      .toString('hex');
  }

  changePassword(userId: string, oldPassword: string, newPassword: string): { success: boolean; error?: string } {
    const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const oldHash = this.hashPassword(oldPassword, user.password_salt);
    if (oldHash !== user.password_hash) {
      return { success: false, error: 'Incorrect current password' };
    }

    const newSalt = crypto.randomBytes(32).toString('hex');
    const newHash = this.hashPassword(newPassword, newSalt);

    const updateStmt = this.db.prepare(
      'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?'
    );
    updateStmt.run(newHash, newSalt, userId);

    return { success: true };
  }

  logout(token: string): void {
    const invalidateStmt = this.db.prepare('UPDATE sessions SET valid = 0 WHERE token = ?');
    invalidateStmt.run(token);
  }

  closeConnection(): void {
    this.db.close();
  }
}

export default AuthService;
