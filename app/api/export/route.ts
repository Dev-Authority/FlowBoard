import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Task from '@/models/Task';

// Proper CSV cell escaping — prevents formula injection and handles commas/newlines
function cell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Strip any leading = + - @ which spreadsheets interpret as formula starters
  const safe = s.replace(/^[=+\-@\t\r]+/, "'$&");
  // Wrap in quotes if contains comma, newline, or double-quote
  if (safe.includes(',') || safe.includes('\n') || safe.includes('\r') || safe.includes('"')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

// GET /api/export
export async function GET() {
  try {
    await connectDB();

    const tasks = await Task.find({})
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const header = [
      'id', 'date', 'text', 'size', 'status', 'tag',
      'estimatedMinutes', 'actualMinutes', 'postponeCount',
      'postponeReasons', 'isRecurring', 'notes',
      'createdAt', 'completedAt',
    ].join(',');

    const rows = (tasks as {
      _id: { toString(): string };
      date: string; text: string; size: string; status: string; tag: string;
      estimatedMinutes?: number; actualMinutes?: number;
      postponeCount: number; postponeReasons: string[];
      isRecurring: boolean; notes?: string;
      createdAt: Date; completedAt?: Date;
    }[]).map((t) => [
      cell(t._id.toString()),
      cell(t.date),
      cell(t.text),
      cell(t.size),
      cell(t.status),
      cell(t.tag),
      cell(t.estimatedMinutes),
      cell(t.actualMinutes),
      cell(t.postponeCount),
      cell(t.postponeReasons.join(' | ')),
      cell(t.isRecurring),
      cell(t.notes),
      cell(t.createdAt?.toISOString()),
      cell(t.completedAt?.toISOString()),
    ].join(','));

    const csv = [header, ...rows].join('\r\n');

    return new Response(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="flowboard-${new Date().toISOString().slice(0,10)}.csv"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
