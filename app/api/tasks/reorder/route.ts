import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Task from '@/models/Task';

// PATCH /api/tasks/reorder
// Body: { updates: [{ id: string; sortOrder: number }] }
// Bulk-updates sortOrder so the board persists manual drag ordering.
export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const { updates } = await req.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'updates array required' }, { status: 400 });
    }

    await Task.bulkWrite(
      updates.map(({ id, sortOrder }: { id: string; sortOrder: number }) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { sortOrder } },
        },
      }))
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
