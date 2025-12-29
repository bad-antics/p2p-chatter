import * as crypto from 'crypto';

export interface CaptchaChallenge {
  id: string;
  challenge: string;
  difficulty: number;
  expiresAt: Date;
}

export class CaptchaService {
  private challenges: Map<string, CaptchaChallenge> = new Map();
  private readonly difficulties = [
    { difficulty: 1, type: 'math', description: 'Simple math' },
    { difficulty: 2, type: 'word', description: 'Word puzzle' },
    { difficulty: 3, type: 'logic', description: 'Logic puzzle' },
    { difficulty: 4, type: 'complex', description: 'Complex problem' },
    { difficulty: 5, type: 'extreme', description: 'Extreme challenge' }
  ];

  generateChallenge(difficulty: number = 1): CaptchaChallenge {
    const id = crypto.randomUUID();
    const challenge = this.createChallenge(difficulty);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const captcha: CaptchaChallenge = { id, challenge, difficulty, expiresAt };
    this.challenges.set(id, captcha);

    return captcha;
  }

  private createChallenge(difficulty: number): string {
    switch (difficulty) {
      case 1:
        return this.mathChallenge();
      case 2:
        return this.wordChallenge();
      case 3:
        return this.logicChallenge();
      case 4:
        return this.complexChallenge();
      case 5:
        return this.extremeChallenge();
      default:
        return this.mathChallenge();
    }
  }

  private mathChallenge(): string {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const answer = a + b;
    return `What is ${a} + ${b}?|${answer}`;
  }

  private wordChallenge(): string {
    const words = ['elephant', 'butterfly', 'computer', 'keyboard', 'security'];
    const word = words[Math.floor(Math.random() * words.length)];
    return `Spell backwards: ${word}|${word.split('').reverse().join('')}`;
  }

  private logicChallenge(): string {
    const challenges = [
      `If all roses are flowers and some flowers fade, can some roses fade?|yes`,
      `What comes after Monday?|tuesday`,
      `Is a square a rectangle?|yes`
    ];
    return challenges[Math.floor(Math.random() * challenges.length)];
  }

  private complexChallenge(): string {
    const base = Math.floor(Math.random() * 5) + 2;
    const exponent = Math.floor(Math.random() * 5) + 2;
    const answer = Math.pow(base, exponent);
    return `Calculate ${base}^${exponent}|${answer}`;
  }

  private extremeChallenge(): string {
    const num1 = Math.floor(Math.random() * 100) + 1;
    const num2 = Math.floor(Math.random() * 100) + 1;
    const num3 = Math.floor(Math.random() * 10) + 1;
    const answer = num1 * num2 - num3;
    return `Solve: (${num1} * ${num2}) - ${num3}|${answer}`;
  }

  validateAnswer(id: string, answer: string): boolean {
    const captcha = this.challenges.get(id);
    if (!captcha || new Date() > captcha.expiresAt) {
      this.challenges.delete(id);
      return false;
    }

    const [_, correctAnswer] = captcha.challenge.split('|');
    const isValid = answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    
    if (isValid) {
      this.challenges.delete(id);
    }

    return isValid;
  }

  cleanup(): void {
    const now = new Date();
    for (const [id, captcha] of this.challenges.entries()) {
      if (now > captcha.expiresAt) {
        this.challenges.delete(id);
      }
    }
  }
}

export default new CaptchaService();
