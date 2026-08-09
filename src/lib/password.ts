/**
 * Staff password hashing (SHA-256 + random salt, via Web Crypto — no
 * dependency). Pure module shared by the Convex backend (`convex/staff.ts`)
 * and the unit tests, so the security-critical logic is exercised directly.
 *
 * This is a v1 scheme for individual staff accounts: a random 128-bit salt
 * per password with a salted SHA-256 digest. It is not meant to replace a
 * dedicated KDF (bcrypt/argon2) in a production deployment — noted in
 * `convex/staff.ts` for whoever hardens this later.
 */

/** Hex SHA-256 digest of a string (Web Crypto, async). */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Random 128-bit salt, hex-encoded (32 characters). */
export function randomSalt(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash a password with a fresh random salt. */
export async function hashPassword(
  password: string,
): Promise<{ hash: string; salt: string }> {
  const salt = randomSalt();
  return { salt, hash: await sha256Hex(`${salt}::${password}`) };
}

/**
 * Constant-time check of a password against its stored hash. Returns false
 * when the salt or hash is missing (account with no individual password).
 */
export async function verifyPassword(
  password: string,
  salt: string | undefined,
  hash: string | undefined,
): Promise<boolean> {
  if (!salt || !hash) return false;
  const candidate = await sha256Hex(`${salt}::${password}`);
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}
