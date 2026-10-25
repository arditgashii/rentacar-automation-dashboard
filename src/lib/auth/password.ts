import bcrypt from "bcryptjs";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

let dummyHash: Promise<string> | null = null;

/** A real hash to compare against when the email is unknown, so both cases take the same time. */
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= bcrypt.hash("timing-equalizer", 12);
  return dummyHash;
}
