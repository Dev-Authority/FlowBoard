import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import RecurringTask from '@/models/RecurringTask';

// GET /api/recurring
export async function GET() {
  try {
    await connectDB();
    const tasks = await RecurringTask.find().sort({ createdAt: -1 });
    return NextResponse.json(tasks);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/recurring
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { text, size, tag, frequency, frequencyValue } = body;

    if (!text || !size || !tag || !frequency) {
      return NextResponse.json(
        { error: 'text, size, tag, frequency are required' },
        { status: 400 }
      );
    }

    const validFrequencies = ['daily', 'weekdays', 'every_x_days', 'weekly', 'biweekly', 'monthly'];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json({ error: 'invalid frequency' }, { status: 400 });
    }

    if (['every_x_days', 'weekly', 'monthly'].includes(frequency) && frequencyValue == null) {
      return NextResponse.json(
        { error: 'frequencyValue required for this frequency type' },
        { status: 400 }
      );
    }

    const task = await RecurringTask.create({
      text,
      size,
      tag,
      frequency,
      frequencyValue: frequencyValue ?? undefined,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
