import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import RecurringTask from '@/models/RecurringTask';
import Task from '@/models/Task';

// PATCH /api/recurring/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    if (!/^[a-f\d]{24}$/i.test(params.id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    const body = await req.json();
    const { text, size, tag, frequency, frequencyValue, isActive } = body;

    const task = await RecurringTask.findById(params.id);
    if (!task) {
      return NextResponse.json({ error: 'Recurring task not found' }, { status: 404 });
    }

    if (text !== undefined) task.text = text;
    if (size !== undefined) task.size = size;
    if (tag !== undefined) task.tag = tag;
    if (frequency !== undefined) task.frequency = frequency;
    if (frequencyValue !== undefined) task.frequencyValue = frequencyValue;
    if (isActive !== undefined) task.isActive = isActive;

    await task.save();
    return NextResponse.json(task);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/recurring/[id]
// Deletes the recurring template AND all generated task instances for today
// and future dates. Past instances are intentionally kept for stats/history.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    if (!/^[a-f\d]{24}$/i.test(params.id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    const [task] = await Promise.all([
      RecurringTask.findByIdAndDelete(params.id),
      // Delete all instances on today or any future date
      Task.deleteMany({ recurringId: params.id, date: { $gte: todayStr } }),
    ]);

    if (!task) {
      return NextResponse.json({ error: 'Recurring task not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
