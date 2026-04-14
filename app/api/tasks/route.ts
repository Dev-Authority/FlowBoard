import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Task from '@/models/Task';
import UserStats from '@/models/UserStats';
import UserPreferences from '@/models/UserPreferences';

const VALID_TAGS  = ['work', 'learning', 'personal', 'health'];
const VALID_SIZES = ['big', 'small'];

// GET /api/tasks?date=YYYY-MM-DD  OR  ?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = req.nextUrl;
    const date  = searchParams.get('date');
    const from  = searchParams.get('from');
    const to    = searchParams.get('to');
    const dateRx = /^\d{4}-\d{2}-\d{2}$/;

    if (from && to) {
      if (!dateRx.test(from) || !dateRx.test(to)) {
        return NextResponse.json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 });
      }
      const tasks = await Task.find({ date: { $gte: from, $lte: to } })
        .sort({ date: 1, sortOrder: 1, createdAt: 1 }).lean();
      return NextResponse.json(tasks);
    }

    if (!date || !dateRx.test(date)) {
      return NextResponse.json({ error: 'Valid date query param required (YYYY-MM-DD)' }, { status: 400 });
    }
    const tasks = await Task.find({ date }).sort({ sortOrder: 1, createdAt: 1 }).lean();
    return NextResponse.json(tasks);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/tasks
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { text, size, tag, date, estimatedMinutes, isRecurring, recurringId, notes } = body;

    // ── Input validation ────────────────────────────────────────
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    if (!VALID_SIZES.includes(size)) {
      return NextResponse.json({ error: 'size must be big or small' }, { status: 400 });
    }
    if (!VALID_TAGS.includes(tag)) {
      return NextResponse.json({ error: 'invalid tag' }, { status: 400 });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    // ── Enforce limits (big tasks cap + tag limits) ─────────────
    const [bigCount, tagCount, prefs] = await Promise.all([
      size === 'big' ? Task.countDocuments({ date, size: 'big' }) : Promise.resolve(0),
      Task.countDocuments({ date, tag }),
      UserPreferences.findOne({}).lean() as Promise<{ tagLimits?: Record<string, number> } | null>,
    ]);

    if (size === 'big' && bigCount >= 3) {
      return NextResponse.json(
        { error: 'Maximum 3 big tasks per day. Focus on what matters.' },
        { status: 422 }
      );
    }

    const tagLimit = prefs?.tagLimits?.[tag as string] ?? 0;
    if (tagLimit > 0 && tagCount >= tagLimit) {
      return NextResponse.json(
        { error: `Daily limit of ${tagLimit} ${tag} tasks reached.` },
        { status: 422 }
      );
    }

    // ── Create ──────────────────────────────────────────────────
    const task = await Task.create({
      text:             text.trim().slice(0, 1000),
      size,
      tag,
      date,
      estimatedMinutes: estimatedMinutes != null && Number.isFinite(estimatedMinutes)
        ? Math.max(0, Math.round(estimatedMinutes)) : undefined,
      isRecurring:      isRecurring === true,
      recurringId:      recurringId ?? undefined,
      notes:            notes && typeof notes === 'string' ? notes.slice(0, 2000) : '',
    });

    await UserStats.findOneAndUpdate(
      {},
      { $inc: { totalTasksCreated: 1 } },
      { upsert: true }
    );

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
