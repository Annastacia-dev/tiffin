// Prints a PASSWORD_HASH line for .env.local / Vercel.
// Usage: npm run hash-password -- "your password"
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-password -- "your password"');
  process.exit(1);
}
if (password.length < 8) console.warn("Tip: use at least 8 characters.");

const salt = randomBytes(16).toString("base64");
const hash = scryptSync(password, salt, 64).toString("base64");
console.log(`PASSWORD_HASH=scrypt:${salt}:${hash}`);
