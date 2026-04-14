import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Task from '@/models/Task';

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// GET /api/tasks/carryover — unfinished tasks from past dates
export async function GET() {
  try {
    await connectDB();
    const today = localDate();
    const tasks = await Task.find({
      date:   { $lt: today },
      status: { $in: ['todo', 'doing'] },
    }).select('_id text date status postponeCount tag size').sort({ date: -1 }).lean();
    return NextResponse.json(tasks);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/tasks/carryover — move selected tasks to today
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { taskIds } = await req.json();
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: 'taskIds array required' }, { status: 400 });
    }
    const today = localDate();
    const result = await Task.updateMany(
      { _id: { $in: taskIds }, status: { $in: ['todo', 'doing'] } },
      { $set: { date: today, status: 'todo' } }
    );
    return NextResponse.json({ carried: result.modifiedCount });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
