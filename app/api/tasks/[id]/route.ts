import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Task from '@/models/Task';
import UserStats from '@/models/UserStats';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Compute actualMinutes from closed timer sessions
function calcMinutesFromSessions(sessions: { start: Date; end?: Date }[]): number {
  const ms = sessions.reduce((sum, s) => {
    if (s.end) return sum + (s.end.getTime() - s.start.getTime());
    return sum;
  }, 0);
  return Math.max(0, Math.round(ms / 60000));
}

// PATCH /api/tasks/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const body = await req.json();
    const {
      status, postponeReason, timerAction,
      estimatedMinutes, actualMinutes, text, tag, size, notes,
      subtasks, date,
    } = body;

    const task = await Task.findById(params.id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // ── Timer actions (pause / resume) ─────────────────────────
    if (timerAction === 'pause') {
      const last = task.timerSessions[task.timerSessions.length - 1];
      if (last && !last.end) {
        last.end = new Date();
        task.markModified('timerSessions');
      }
    }

    if (timerAction === 'resume') {
      task.timerSessions.push({ start: new Date() });
      task.markModified('timerSessions');
    }

    // ── Status transitions ──────────────────────────────────────
    if (status) {
      if (status === 'postponed') {
        // Require a reason — enforced server-side
        if (!postponeReason || typeof postponeReason !== 'string' || !postponeReason.trim()) {
          return NextResponse.json(
            { error: 'A reason is required to postpone a task.' },
            { status: 422 }
          );
        }
        // Close any open timer session
        const last = task.timerSessions[task.timerSessions.length - 1];
        if (last && !last.end) {
          last.end = new Date();
          task.markModified('timerSessions');
        }
        task.postponeCount += 1;
        task.postponeReasons.push(postponeReason.trim().slice(0, 500)); // cap reason length
        task.postponedAt.push(new Date()); // record exact timestamp for pattern detection
        task.status = 'postponed';

        await UserStats.findOneAndUpdate(
          {},
          { $inc: { totalTasksPostponed: 1 } },
          { upsert: true }
        );

      } else if (status === 'doing') {
        task.status = 'doing';
        if (!task.startedAt) task.startedAt = new Date();
        // Start a new timer session
        task.timerSessions.push({ start: new Date() });
        task.markModified('timerSessions');

      } else if (status === 'done') {
        // Close last open timer session
        const last = task.timerSessions[task.timerSessions.length - 1];
        if (last && !last.end) {
          last.end = new Date();
          task.markModified('timerSessions');
        }
        task.status = 'done';
        task.completedAt = new Date();

        // Prefer session-based timing; fall back to startedAt → completedAt
        if (task.timerSessions.length > 0) {
          const fromSessions = calcMinutesFromSessions(task.timerSessions);
          task.actualMinutes = fromSessions > 0 ? fromSessions : task.actualMinutes;
        } else if (task.startedAt) {
          task.actualMinutes = Math.round(
            (task.completedAt.getTime() - task.startedAt.getTime()) / 60000
          );
        }

        // ── Streak calculation ──────────────────────────────────
        const today    = todayStr();
        const yesterday = yesterdayStr();
        const currentStats = await UserStats.findOne({}).lean() as {
          currentStreak?: number; longestStreak?: number; lastActiveDate?: string;
        } | null;

        let newStreak: number;
        if (!currentStats?.lastActiveDate) {
          newStreak = 1;
        } else if (currentStats.lastActiveDate === today) {
          newStreak = currentStats.currentStreak ?? 1; // already got credit today
        } else if (currentStats.lastActiveDate === yesterday) {
          newStreak = (currentStats.currentStreak ?? 0) + 1; // consecutive day
        } else {
          newStreak = 1; // gap → reset
        }
        const newLongest = Math.max(currentStats?.longestStreak ?? 0, newStreak);

        await UserStats.findOneAndUpdate(
          {},
          {
            $inc: { totalTasksCompleted: 1 },
            $set:  { currentStreak: newStreak, longestStreak: newLongest, lastActiveDate: today },
          },
          { upsert: true }
        );

      } else if (status === 'todo') {
        task.status = 'todo';
      }
    }

    // ── Field updates ───────────────────────────────────────────
    if (estimatedMinutes !== undefined && Number.isFinite(estimatedMinutes))
      task.estimatedMinutes = Math.max(0, Math.round(estimatedMinutes));
    if (actualMinutes !== undefined && Number.isFinite(actualMinutes))
      task.actualMinutes = Math.max(0, Math.round(actualMinutes));
    if (text !== undefined && typeof text === 'string')
      task.text = text.trim().slice(0, 1000);
    if (tag !== undefined && ['work','learning','personal','health'].includes(tag))
      task.tag = tag;
    if (size !== undefined && ['big','small'].includes(size))
      task.size = size;
    if (notes !== undefined && typeof notes === 'string')
      task.notes = notes.slice(0, 2000);
    if (subtasks !== undefined && Array.isArray(subtasks)) {
      // Replace subtasks via splice to preserve Mongoose subdocument typing
      task.subtasks.splice(0, task.subtasks.length,
        ...subtasks
          .filter((s: { text?: unknown }) => typeof s.text === 'string' && String(s.text).trim())
          .map((s: { text: string; done?: unknown }) => ({ text: s.text.trim().slice(0, 500), done: Boolean(s.done) })) as any[]
      );
      task.markModified('subtasks');
    }
    if (date !== undefined && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
      task.date = date;

    await task.save();
    return NextResponse.json(task);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const task = await Task.findById(params.id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.postponeCount >= 3) {
      await UserStats.findOneAndUpdate(
        {},
        { $inc: { totalTasksAbandoned: 1 } },
        { upsert: true }
      );
    }

    await Task.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
