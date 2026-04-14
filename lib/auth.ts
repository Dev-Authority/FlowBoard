import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'fb_token';
const EXPIRY      = '7d';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return new TextEncoder().encode(secret);
}

export interface AuthPayload extends JWTPayload {
  userId: string;
  email:  string;
}

export async function signToken(payload: Omit<AuthPayload, keyof JWTPayload>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as AuthPayload;
}

// Server-component helper — reads the token from the cookie store
export async function getAuthPayload(): Promise<AuthPayload | null> {
  try {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export { COOKIE_NAME, EXPIRY };
