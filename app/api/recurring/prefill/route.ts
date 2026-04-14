import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import RecurringTask from '@/models/RecurringTask';
import Task from '@/models/Task';

export const dynamic = 'force-dynamic';

function localStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isValidDateStr(s: string | null): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

interface RTLike {
  _id: { toString(): string };
  text: string; size: string; tag: string;
  frequency: string; frequencyValue?: number;
}

function shouldRunOnDate(rt: RTLike, date: Date, lastGenDate: string): boolean {
  const dow = date.getDay();
  const dom = date.getDate();
  switch (rt.frequency) {
    case 'daily':    return true;
    case 'weekdays': return dow >= 1 && dow <= 5;
    case 'every_x_days': {
      if (!lastGenDate || !rt.frequencyValue) return true;
      const diff = Math.floor(
        (date.getTime() - new Date(lastGenDate + 'T12:00:00').getTime()) / 86400000
      );
      return diff >= rt.frequencyValue;
    }
    case 'weekly':   return dow === (rt.frequencyValue ?? 1);
    case 'biweekly': {
      if (!lastGenDate) return true;
      const diff = Math.floor(
        (date.getTime() - new Date(lastGenDate + 'T12:00:00').getTime()) / 86400000
      );
      return diff >= 14;
    }
    case 'monthly':  return dom === (rt.frequencyValue ?? 1);
    default:         return false;
  }
}

// GET /api/recurring/prefill?date=YYYY-MM-DD
// Client passes its local date so we start from the correct "tomorrow".
// Generates recurring tasks for the next 30 days so future boards + calendar are populated.
// Client calls this once per day (localStorage dedup), AFTER generate completes.
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const url       = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    const todayStr  = isValidDateStr(dateParam) ? dateParam : localStr(new Date());

    const activeRecurring = await RecurringTask.find({ isActive: true }).lean();
    if (activeRecurring.length === 0) return NextResponse.json({ generated: 0 });

    // Simulate last-generated date per task as we march forward in time
    const simLastGen: Record<string, string> = {};
    for (const rt of activeRecurring) {
      simLastGen[rt._id.toString()] = rt.lastGeneratedDate ?? '';
    }

    // Collect (date, recurringId) pairs for all occurrences in next 30 days.
    // Start from i=1 (tomorrow in client's local timezone) so we never overlap
    // with what generate already created for today.
    const candidates: { date: string; rtId: string; rt: RTLike }[] = [];
    const today = new Date(todayStr + 'T12:00:00');
    today.setHours(12, 0, 0, 0);

    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = localStr(d);

      for (const rt of activeRecurring) {
        const id = rt._id.toString();
        if (shouldRunOnDate(rt, d, simLastGen[id])) {
          candidates.push({ date: dateStr, rtId: id, rt });
          simLastGen[id] = dateStr; // advance for next iteration
        }
      }
    }

    if (candidates.length === 0) return NextResponse.json({ generated: 0 });

    // Batch-check which already exist
    const allDates  = Array.from(new Set(candidates.map((c) => c.date)));
    const allRtIds  = Array.from(new Set(candidates.map((c) => c.rtId)));
    const existing  = await Task.find({
      date:        { $in: allDates },
      recurringId: { $in: allRtIds },
    }).select('date recurringId').lean();

    const existingSet = new Set(
      existing.map((t) => `${t.date}__${t.recurringId?.toString()}`)
    );

    const toInsert = candidates.filter(
      ({ date, rtId }) => !existingSet.has(`${date}__${rtId}`)
    );

    if (toInsert.length === 0) return NextResponse.json({ generated: 0 });

    await Task.insertMany(
      toInsert.map(({ date, rtId, rt }) => ({
        text: rt.text, size: rt.size, tag: rt.tag,
        date, isRecurring: true, recurringId: rtId,
      }))
    );

    return NextResponse.json({ generated: toInsert.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
