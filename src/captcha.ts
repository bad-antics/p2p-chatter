/**
 * P2P Chatter - CAPTCHA Module
 * Created by antX | Organization: Bad Antics (https://github.com/bad-antics)
 * ©2025 Bad Antics. All rights reserved.
 * 
 * Challenge-response based bot protection
 * No external dependencies required
 */

import crypto from 'crypto';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ name: 'CaptchaService' });

export interface CaptchaChallenge {
  id: string;
  challenge: string;
  difficulty: number; // 1-5, higher = more complex
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
}

export interface CaptchaVerification {
  isValid: boolean;
  timeTaken: number;
  difficulty: number;
}

export class CaptchaService {
  private challenges: Map<string, CaptchaChallenge> = new Map();
  private readonly CHALLENGE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_ATTEMPTS = 5;
  private logger = logger;

  constructor() {
    // Clean up expired challenges every 5 minutes
    setInterval(() => this.cleanupExpiredChallenges(), 5 * 60 * 1000);
  }

  /**
   * Generate a CAPTCHA challenge
   * Types: math, word-sequence, image-grid (text-based)
   */
  generateChallenge(difficulty: number = 1): CaptchaChallenge {
    const challengeId = uuidv4();
    const now = Date.now();

    // Adjust difficulty: 1-5
    const clampedDifficulty = Math.min(Math.max(difficulty, 1), 5);
    
    let challenge: string;
    switch (clampedDifficulty) {
      case 1:
        challenge = this.generateEasyMath();
        break;
      case 2:
        challenge = this.generateMediumMath();
        break;
      case 3:
        challenge = this.generateHardMath();
        break;
      case 4:
        challenge = this.generateWordSequence();
        break;
      case 5:
        challenge = this.generateComplexChallenge();
        break;
      default:
        challenge = this.generateEasyMath();
    }

    const captchaChallenge: CaptchaChallenge = {
      id: challengeId,
      challenge,
      difficulty: clampedDifficulty,
      createdAt: now,
      expiresAt: now + this.CHALLENGE_TTL,
      attempts: 0,
      maxAttempts: this.MAX_ATTEMPTS,
    };

    this.challenges.set(challengeId, captchaChallenge);
    this.logger.debug(`Generated CAPTCHA challenge (difficulty: ${clampedDifficulty})`);

    return captchaChallenge;
  }

  /**
   * Verify CAPTCHA response
   */
  verifyCaptcha(challengeId: string, response: string): CaptchaVerification {
    const challenge = this.challenges.get(challengeId);

    if (!challenge) {
      return {
        isValid: false,
        timeTaken: 0,
        difficulty: 0,
      };
    }

    // Check if challenge is expired
    if (Date.now() > challenge.expiresAt) {
      this.challenges.delete(challengeId);
      return {
        isValid: false,
        timeTaken: Date.now() - challenge.createdAt,
        difficulty: challenge.difficulty,
      };
    }

    // Check attempts
    challenge.attempts++;
    if (challenge.attempts > challenge.maxAttempts) {
      this.challenges.delete(challengeId);
      return {
        isValid: false,
        timeTaken: Date.now() - challenge.createdAt,
        difficulty: challenge.difficulty,
      };
    }

    const timeTaken = Date.now() - challenge.createdAt;
    const isValid = this.validateResponse(challenge.challenge, response, challenge.difficulty);

    if (isValid) {
      this.challenges.delete(challengeId); // Remove after successful verification
      this.logger.info(`CAPTCHA verified (difficulty: ${challenge.difficulty}, time: ${timeTaken}ms)`);
    }

    return {
      isValid,
      timeTaken,
      difficulty: challenge.difficulty,
    };
  }

  /**
   * Validate the response against challenge
   */
  private validateResponse(challenge: string, response: string, difficulty: number): boolean {
    // Extract expected answer from challenge string
    const parts = challenge.split('|');
    if (parts.length < 2) return false;

    const expectedAnswer = parts[parts.length - 1];
    const userAnswer = response.trim().toLowerCase();

    // Allow some flexibility for word challenges
    if (difficulty >= 4) {
      return this.stringSimilarity(userAnswer, expectedAnswer) > 0.8;
    }

    return userAnswer === expectedAnswer;
  }

  /**
   * Calculate string similarity (0-1)
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private getEditDistance(s1: string, s2: string): number {
    const costs: number[] = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }

    return costs[s2.length];
  }

  // Challenge generators
  private generateEasyMath(): string {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const answer = a + b;
    return `What is ${a} + ${b}?|${answer}`;
  }

  private generateMediumMath(): string {
    const a = Math.floor(Math.random() * 50) + 10;
    const b = Math.floor(Math.random() * 50) + 10;
    const answer = a - b;
    return `What is ${a} - ${b}?|${answer}`;
  }

  private generateHardMath(): string {
    const a = Math.floor(Math.random() * 12) + 2;
    const b = Math.floor(Math.random() * 12) + 2;
    const answer = a * b;
    return `What is ${a} × ${b}?|${answer}`;
  }

  private generateWordSequence(): string {
    const sequences = [
      ['apple', 'banana', 'cherry'],
      ['red', 'orange', 'yellow'],
      ['cat', 'dog', 'bird'],
      ['monday', 'tuesday', 'wednesday'],
      ['spring', 'summer', 'autumn'],
    ];

    const sequence = sequences[Math.floor(Math.random() * sequences.length)];
    const shuffled = [...sequence].sort(() => Math.random() - 0.5);
    return `Sort these in order: ${shuffled.join(', ')}|${sequence.join(', ')}`;
  }

  private generateComplexChallenge(): string {
    const operators = ['+', '-', '×'];
    const op1 = operators[Math.floor(Math.random() * operators.length)];
    const op2 = operators[Math.floor(Math.random() * operators.length)];
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const c = Math.floor(Math.random() * 20) + 1;

    let answer = 0;
    if (op1 === '+') answer += a + b;
    else if (op1 === '-') answer += a - b;
    else answer += a * b;

    if (op2 === '+') answer += c;
    else if (op2 === '-') answer -= c;
    else answer *= c;

    return `What is ${a} ${op1} ${b} ${op2} ${c}?|${answer}`;
  }

  /**
   * Clean up expired challenges
   */
  private cleanupExpiredChallenges(): void {
    const now = Date.now();
    let cleaned = 0;

    this.challenges.forEach((challenge, id) => {
      if (now > challenge.expiresAt) {
        this.challenges.delete(id);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired CAPTCHA challenges`);
    }
  }

  /**
   * Get challenge info (for display without revealing answer)
   */
  getChallengDisplay(challengeId: string): { challenge: string; difficulty: number } | null {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return null;

    return {
      challenge: challenge.challenge.split('|')[0], // Return only the question part
      difficulty: challenge.difficulty,
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeChallenges: number;
    totalCreated: number;
  } {
    return {
      activeChallenges: this.challenges.size,
      totalCreated: 0, // Would need to track this separately
    };
  }
}

export default CaptchaService;
