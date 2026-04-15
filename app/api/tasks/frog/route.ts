import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Task from '@/models/Task';

export const dynamic = 'force-dynamic';

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function localYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// GET /api/tasks/frog — returns the single most-avoided unfinished task
export async function GET() {
  try {
    await connectDB();
    const today     = localDate();
    const yesterday = localYesterday();

    const sel = '_id text tag size date status postponeCount';

    // Only surface tasks from today or yesterday (what's on the board).
    // Tasks from older dates are off the board and should not trigger the frog.
    const dateFilter = { date: { $gte: yesterday, $lte: today } };

    // Primary: most postponed unfinished task
    const mostPostponed = await Task.findOne({
      ...dateFilter,
      status: { $ne: 'done' },
      postponeCount: { $gt: 0 },
    }).sort({ postponeCount: -1 }).select(sel).lean() as Record<string, unknown> | null;

    if (mostPostponed) {
      const taskDate = (mostPostponed.date as string) + 'T12:00:00';
      const daysSince = Math.max(0, Math.floor(
        (new Date(today + 'T12:00:00').getTime() - new Date(taskDate).getTime()) / 86400000
      ));
      return NextResponse.json({ task: mostPostponed, daysSince });
    }

    // Fallback: oldest unfinished big task
    const oldestBig = await Task.findOne({
      ...dateFilter,
      status: { $ne: 'done' },
      size: 'big',
    }).sort({ date: 1, createdAt: 1 }).select(sel).lean() as Record<string, unknown> | null;

    if (oldestBig) {
      const taskDate = (oldestBig.date as string) + 'T12:00:00';
      const daysSince = Math.max(0, Math.floor(
        (new Date(today + 'T12:00:00').getTime() - new Date(taskDate).getTime()) / 86400000
      ));
      return NextResponse.json({ task: oldestBig, daysSince });
    }

    return NextResponse.json(null);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
