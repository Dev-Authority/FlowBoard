import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import UserPreferences from '@/models/UserPreferences';

// GET /api/preferences
export async function GET() {
  try {
    await connectDB();
    const prefs = await UserPreferences.findOne({});
    return NextResponse.json(prefs ?? { theme: 'dark', eveningReminderTime: '21:00', morningReminderTime: '08:00' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/preferences
export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const allowed = ['theme', 'eveningReminderTime', 'morningReminderTime', 'tagLimits'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    const prefs = await UserPreferences.findOneAndUpdate({}, update, {
      upsert: true,
      new: true,
    });
    return NextResponse.json(prefs);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
