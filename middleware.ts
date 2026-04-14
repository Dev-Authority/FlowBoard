import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { COOKIE_NAME } from '@/lib/auth';

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/api/auth/login',
  '/api/auth/signup',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return unauthorized(req);
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // Token expired or tampered — clear the cookie and redirect
    const res = unauthorized(req);
    res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return res;
  }
}

function unauthorized(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon\\.svg|icon-maskable\\.svg|manifest\\.json).*)'],
};
