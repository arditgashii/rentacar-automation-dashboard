// Slows down password guessing: after 5 wrong passwords for one email within 15 minutes, that email
// waits until the window ends. Kept in memory, which is enough for one app process.

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60_000;

type Entry = { failures: number; since: number };

export class LoginThrottle {
  private entries = new Map<string, Entry>();

  /** Milliseconds this email still has to wait, or 0. */
  waitFor(email: string, now = Date.now()): number {
    const entry = this.entries.get(email);
    if (!entry) return 0;
    if (now - entry.since >= WINDOW_MS) {
      this.entries.delete(email);
      return 0;
    }
    return entry.failures >= MAX_FAILURES ? entry.since + WINDOW_MS - now : 0;
  }

  failed(email: string, now = Date.now()): void {
    const entry = this.entries.get(email);
    if (!entry || now - entry.since >= WINDOW_MS) this.entries.set(email, { failures: 1, since: now });
    else entry.failures++;
  }

  succeeded(email: string): void {
    this.entries.delete(email);
  }
}

const globalForThrottle = globalThis as unknown as { loginThrottle?: LoginThrottle };
export const loginThrottle = (globalForThrottle.loginThrottle ??= new LoginThrottle());
