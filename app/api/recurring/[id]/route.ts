import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import RecurringTask from '@/models/RecurringTask';

// PATCH /api/recurring/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
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
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const task = await RecurringTask.findByIdAndDelete(params.id);
    if (!task) {
      return NextResponse.json({ error: 'Recurring task not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
