import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connectDB();
  return NextResponse.json({ ok: true });
}
