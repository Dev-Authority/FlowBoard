import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import RecurringTask from '@/models/RecurringTask';
import Task from '@/models/Task';

// Uses a passed-in date string so the client can supply its local date,
// avoiding UTC vs local-timezone mismatch on the server.
function shouldRunToday(
  task: { frequency: string; frequencyValue?: number; lastGeneratedDate?: string },
  todayStr: string,
): boolean {
  const today = new Date(todayStr + 'T12:00:00');
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  const dayOfMonth = today.getDate();

  switch (task.frequency) {
    case 'daily':
      return true;

    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;

    case 'every_x_days': {
      if (!task.lastGeneratedDate || !task.frequencyValue) return true;
      const last = new Date(task.lastGeneratedDate + 'T12:00:00');
      const diffMs = today.getTime() - last.getTime();
      const diffDays = Math.floor(diffMs / 86400000);
      return diffDays >= task.frequencyValue;
    }

    case 'weekly': {
      // frequencyValue is day of week (0-6)
      return dayOfWeek === (task.frequencyValue ?? 1);
    }

    case 'biweekly': {
      if (!task.lastGeneratedDate) return true;
      const last = new Date(task.lastGeneratedDate + 'T12:00:00');
      const diffMs = today.getTime() - last.getTime();
      const diffDays = Math.floor(diffMs / 86400000);
      return diffDays >= 14;
    }

    case 'monthly': {
      return dayOfMonth === (task.frequencyValue ?? 1);
    }

    default:
      return false;
  }
}

async function runGenerate(todayStr: string) {
  await connectDB();

  // 1 query: all active recurring tasks
  const activeRecurring = await RecurringTask.find({ isActive: true }).lean();
  const toRun = activeRecurring.filter((rt) => shouldRunToday(rt, todayStr));

  if (toRun.length === 0) {
    return { generated: 0, skipped: activeRecurring.length, date: todayStr };
  }

  // 1 query: which ones already have a task today (dedup)
  const toRunIds = toRun.map((rt) => rt._id);
  const existing = await Task.find({ recurringId: { $in: toRunIds }, date: todayStr })
    .select('recurringId').lean();
  const existingIds = new Set(existing.map((t) => t.recurringId?.toString()));

  const toCreate = toRun.filter((rt) => !existingIds.has(rt._id.toString()));
  const skipped  = activeRecurring.length - toCreate.length;

  if (toCreate.length === 0) {
    return { generated: 0, skipped, date: todayStr };
  }

  // 1 insertMany: create all at once
  await Task.insertMany(
    toCreate.map((rt) => ({
      text: rt.text, size: rt.size, tag: rt.tag,
      date: todayStr, isRecurring: true, recurringId: rt._id,
    }))
  );

  // 1 updateMany: mark lastGeneratedDate for all created
  await RecurringTask.updateMany(
    { _id: { $in: toCreate.map((rt) => rt._id) } },
    { $set: { lastGeneratedDate: todayStr } }
  );

  return { generated: toCreate.length, skipped, date: todayStr };
}

// GET /api/recurring/generate — unauthenticated, for client-side trigger on board load
// GET /api/recurring/generate?date=YYYY-MM-DD
// Client passes its local date to avoid UTC vs local-timezone mismatch.
export async function GET(req: NextRequest) {
  try {
    const url      = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    // Validate format; fall back to UTC date if absent/malformed
    const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? '')
      ? dateParam!
      : new Date().toISOString().slice(0, 10);
    const result = await runGenerate(todayStr);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/recurring/generate — cron-secret protected, for Vercel cron
export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('authorization');
    const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (cronSecret && headerSecret !== cronSecret && bearerSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const result = await runGenerate(todayStr);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
