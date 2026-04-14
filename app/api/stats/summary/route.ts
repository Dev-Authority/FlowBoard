import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Task from '@/models/Task';
import UserStats from '@/models/UserStats';

export const dynamic = 'force-dynamic';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

// GET /api/stats/summary
// Lightweight endpoint: streak + last-two-weeks completion summary.
// Used by the board and display page — avoids running the full 10-aggregation stats query.
export async function GET() {
  try {
    await connectDB();

    const now             = new Date();
    const weekStartStr    = toDateStr(getWeekStart(now));
    const lastWeekD       = new Date(getWeekStart(now));
    lastWeekD.setDate(lastWeekD.getDate() - 7);
    const lastWeekStartStr = toDateStr(lastWeekD);

    const [userStats, twoWeekTasks] = await Promise.all([
      UserStats.findOne({}).select('currentStreak').lean() as Promise<{ currentStreak?: number } | null>,
      Task.find({ date: { $gte: lastWeekStartStr } })
          .select('date status')
          .lean() as Promise<{ date: string; status: string }[]>,
    ]);

    const currentStreak = userStats?.currentStreak ?? 0;

    // Split tasks into this-week and last-week buckets
    const thisWeekTasks = twoWeekTasks.filter((t) => t.date >= weekStartStr);
    const lastWeekTasks = twoWeekTasks.filter((t) => t.date >= lastWeekStartStr && t.date < weekStartStr);

    const toSummary = (tasks: { date: string; status: string }[], week: string) => {
      const created   = tasks.length;
      const completed = tasks.filter((t) => t.status === 'done').length;
      return { week, created, completed, rate: created > 0 ? Math.round((completed / created) * 100) : 0 };
    };

    return NextResponse.json({
      currentStreak,
      lastWeekSummary: lastWeekTasks.length > 0 ? toSummary(lastWeekTasks, lastWeekStartStr) : null,
      thisWeekSummary: thisWeekTasks.length > 0 ? toSummary(thisWeekTasks, weekStartStr) : null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
