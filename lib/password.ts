import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** "scrypt:<salt>:<hash>" */
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64");
  const hash = scryptSync(password, salt, 64).toString("base64");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = (stored || "").split(":");
  if (algo !== "scrypt" || !salt || !hash || !password) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export function passwordProblem(password: string): string | null {
  if (!password || password.length < 8) return "Use at least 8 characters.";
  if (password.length > 200) return "That password is too long.";
  return null;
}

export function normEmail(email: unknown) {
  return String(email || "").trim().toLowerCase();
}

export function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
}
