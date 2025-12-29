/**
 * P2P Chatter - Auto Username Generator
 * Created by antX | Organization: Bad Antics (https://github.com/bad-antics)
 * ©2025 Bad Antics. All rights reserved.
 * 
 * Generates random funny usernames and single-use credentials for anonymous P2P messaging
 */

import crypto from 'crypto';
import pino from 'pino';

const logger = pino({ name: 'UsernameGenerator' });

export interface GeneratedCredentials {
  username: string;
  password: string;
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  isUsed: boolean;
  usedAt?: Date;
}

// Funny adjectives for username generation
const ADJECTIVES = [
  'Mysterious', 'Sneaky', 'Quirky', 'Zany', 'Witty', 'Clever', 'Sly', 'Playful',
  'Funky', 'Groovy', 'Zippy', 'Zippy', 'Bouncy', 'Peppy', 'Snappy', 'Spiffy',
  'Swift', 'Nimble', 'Dapper', 'Jazzy', 'Rad', 'Cool', 'Slick', 'Sharp',
  'Smooth', 'Mellow', 'Groovy', 'Hip', 'Posh', 'Swanky', 'Sassy', 'Spicy',
  'Wild', 'Crazy', 'Bonkers', 'Wacky', 'Goofy', 'Silly', 'Cheeky', 'Impish'
];

// Funny animals/creatures for username generation
const CREATURES = [
  'Panda', 'Penguin', 'Platypus', 'Lemur', 'Koala', 'Sloth', 'Otter', 'Badger',
  'Wombat', 'Quokka', 'Narwhal', 'Capybara', 'Llama', 'Alpaca', 'Hedgehog',
  'Ferret', 'Meerkat', 'Squirrel', 'Chipmunk', 'Hamster', 'Porcupine', 'Armadillo',
  'Flamingo', 'Toucan', 'Ocelot', 'Lynx', 'Mole', 'Newt', 'Gecko', 'Kiwi',
  'Emu', 'Yak', 'Moose', 'Elk', 'Bobcat', 'Puma', 'Cheetah', 'Coyote'
];

// Silly action verbs
const ACTIONS = [
  'Bouncing', 'Dancing', 'Jumping', 'Spinning', 'Flying', 'Sliding', 'Zooming',
  'Dashing', 'Rushing', 'Speeding', 'Racing', 'Gliding', 'Floating', 'Surfing',
  'Skiing', 'Skating', 'Whirling', 'Twirling', 'Bouncing', 'Bounding', 'Leaping',
  'Hopping', 'Skipping', 'Shuffling', 'Strolling', 'Waddling', 'Crawling', 'Creeping',
  'Sneaking', 'Slinking', 'Prancing', 'Galloping', 'Trotting', 'Strutting', 'Striding'
];

export class UsernameGenerator {
  private logger = logger;
  private credentialCache: Map<string, GeneratedCredentials> = new Map();
  private readonly USERNAME_PREFIX = 'p2p-';
  private readonly PASSWORD_LENGTH = 32;
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.logger.info('Username Generator initialized');
    this.startCleanupInterval();
  }

  /**
   * Generate a funny random username
   */
  generateFunnyUsername(): string {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const creature = CREATURES[Math.floor(Math.random() * CREATURES.length)];
    const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    const number = Math.floor(Math.random() * 1000);

    const funnyName = `${adjective}${creature}${action}${number}`.toLowerCase();
    return `${this.USERNAME_PREFIX}${funnyName}`;
  }

  /**
   * Generate a cryptographically secure single-use password
   */
  generatePassword(length: number = this.PASSWORD_LENGTH): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate complete single-use credentials
   */
  generateSingleUseCredentials(): GeneratedCredentials {
    const username = this.generateFunnyUsername();
    const password = this.generatePassword();
    const sessionId = crypto.randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + this.SESSION_DURATION);

    const credentials: GeneratedCredentials = {
      username,
      password,
      sessionId,
      createdAt,
      expiresAt,
      isUsed: false
    };

    this.credentialCache.set(sessionId, credentials);

    this.logger.info(
      { username, sessionId, expiresIn: `${this.SESSION_DURATION / 1000 / 60} minutes` },
      'Single-use credentials generated'
    );

    return credentials;
  }

  /**
   * Mark credentials as used
   */
  markCredentialsAsUsed(sessionId: string): boolean {
    const credentials = this.credentialCache.get(sessionId);
    if (!credentials) {
      this.logger.warn({ sessionId }, 'Credentials not found');
      return false;
    }

    if (credentials.isUsed) {
      this.logger.warn({ sessionId }, 'Credentials already used');
      return false;
    }

    credentials.isUsed = true;
    credentials.usedAt = new Date();
    this.credentialCache.set(sessionId, credentials);

    this.logger.info({ username: credentials.username }, 'Credentials marked as used');
    return true;
  }

  /**
   * Validate credentials are still valid
   */
  isCredentialsValid(sessionId: string): boolean {
    const credentials = this.credentialCache.get(sessionId);
    if (!credentials) {
      return false;
    }

    if (credentials.isUsed) {
      return false;
    }

    const now = new Date();
    if (now > credentials.expiresAt) {
      return false;
    }

    return true;
  }

  /**
   * Get credentials by session ID
   */
  getCredentials(sessionId: string): GeneratedCredentials | null {
    const credentials = this.credentialCache.get(sessionId);
    if (!credentials || !this.isCredentialsValid(sessionId)) {
      return null;
    }
    return credentials;
  }

  /**
   * Get credentials by username
   */
  getCredentialsByUsername(username: string): GeneratedCredentials | null {
    for (const credentials of this.credentialCache.values()) {
      if (credentials.username === username && this.isCredentialsValid(credentials.sessionId)) {
        return credentials;
      }
    }
    return null;
  }

  /**
   * Clean up expired credentials
   */
  private cleanupExpiredCredentials(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, credentials] of this.credentialCache.entries()) {
      if (now > credentials.expiresAt) {
        this.credentialCache.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info({ count: cleanedCount }, 'Cleaned up expired credentials');
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanupInterval(): void {
    setInterval(() => this.cleanupExpiredCredentials(), this.CLEANUP_INTERVAL);
    this.logger.info('Cleanup interval started');
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalGenerated: number;
    activeCredentials: number;
    usedCredentials: number;
    expiredCredentials: number;
  } {
    let totalGenerated = 0;
    let activeCredentials = 0;
    let usedCredentials = 0;
    let expiredCredentials = 0;
    const now = new Date();

    for (const credentials of this.credentialCache.values()) {
      totalGenerated++;

      if (credentials.isUsed) {
        usedCredentials++;
      } else if (now > credentials.expiresAt) {
        expiredCredentials++;
      } else {
        activeCredentials++;
      }
    }

    return {
      totalGenerated,
      activeCredentials,
      usedCredentials,
      expiredCredentials
    };
  }

  /**
   * Generate multiple credentials for batch signup
   */
  generateBatch(count: number): GeneratedCredentials[] {
    const batch: GeneratedCredentials[] = [];
    for (let i = 0; i < count; i++) {
      batch.push(this.generateSingleUseCredentials());
    }
    this.logger.info({ count }, 'Batch credentials generated');
    return batch;
  }

  /**
   * Export credentials as formatted string (for user display)
   */
  formatCredentials(credentials: GeneratedCredentials): string {
    return `
Username: ${credentials.username}
Password: ${credentials.password}
Session ID: ${credentials.sessionId}
Expires: ${credentials.expiresAt.toISOString()}
Generated: ${credentials.createdAt.toISOString()}
    `.trim();
  }
}

export default new UsernameGenerator();
