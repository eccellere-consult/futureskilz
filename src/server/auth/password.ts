import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing for accounts that have one. Salted scrypt, with the cost parameters stored beside each hash so they can be
 * raised later without locking anyone out. Plain Node crypto: nothing to install, nothing leaves the server.
 */

const COST = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { ...COST, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

let dummy: Promise<string> | undefined;
/** A real hash to check against when the account does not exist, so "no such account" takes as long as "wrong password". */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword("not-a-real-password-for-timing");
  return dummy;
}

export const MIN_PASSWORD = 12;
export const MAX_PASSWORD = 128;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters.`;
  if (/^(.)\1+$/.test(password)) return "Choose something less repetitive.";
  return null;
}

// No 0/O, 1/l/I: a password read aloud or copied from a screen is not mistyped.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** A random password in four groups, such as "Kf7m-Q2xr-Hn9p-Wd4z" (about 92 bits). */
export function generatePassword(): string {
  const groups = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""));
  return groups.join("-");
}
