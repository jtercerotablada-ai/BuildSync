import crypto from "crypto";
import prisma from "./prisma";

/**
 * Create a verification token with a namespaced identifier.
 * Identifier format: "email-verify:user@example.com" or "password-reset:user@example.com"
 */
export async function createToken(
  identifier: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Delete any existing tokens for this identifier
  await prisma.verificationToken.deleteMany({
    where: { identifier },
  });

  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });

  return token;
}

/**
 * Validate a token by looking it up and checking prefix + expiry.
 * Returns the record if valid, null otherwise.
 */
export async function validateToken(
  token: string,
  identifierPrefix: string
) {
  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record) return null;
  if (!record.identifier.startsWith(identifierPrefix)) return null;

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
    return null;
  }

  return record;
}

/**
 * Delete a token after successful use.
 */
export async function consumeToken(token: string) {
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
}
