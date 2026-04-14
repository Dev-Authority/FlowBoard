import { NextResponse } from 'next/server';
import { getAuthPayload } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const payload = await getAuthPayload();
  if (!payload) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ userId: payload.userId, email: payload.email });
}
