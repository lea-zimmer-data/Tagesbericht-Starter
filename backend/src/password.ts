import argon2 from 'argon2';

// Argon2id (NF-9) mit den Standardparametern von argon2 (m=64 MiB, t=3, p=4).
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

// Ungültige oder fremde Hash-Formate gelten als falsches Passwort.
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
