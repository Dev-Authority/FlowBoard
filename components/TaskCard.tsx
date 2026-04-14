'use client';
import { useState, useRef } from 'react';
import { Task, TaskStatus, Subtask } from '@/lib/types';

interface Props {
  task: Task;
  onStatusChange: (task: Task, status: TaskStatus, reason?: string) => void;
  onDelete: (task: Task) => void;
  onFocus: () => void;
  onDoItNow: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

const TAG_BORDER: Record<string, string> = {
  work: '#3b82f6', learning: '#8b5cf6', personal: '#ec4899', health: '#10b981',
};

function ageInDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

export default function TaskCard({ task, onStatusChange, onDelete, onFocus, onDoItNow, onDragStart, onDragEnd, isDragging }: Props) {
  const [postponeOpen,   setPostponeOpen]   = useState(false);
  const [postponeReason, setPostponeReason] = useState('');
  const [reasonError,    setReasonError]    = useState(false);
  const [notesOpen,      setNotesOpen]      = useState(false);
  const [notesValue,     setNotesValue]     = useState(task.notes ?? '');
  const [notesSaving,    setNotesSaving]    = useState(false);

  // Subtasks
  const [subtasksOpen,   setSubtasksOpen]   = useState(false);
  const [subtasks,       setSubtasks]       = useState<Subtask[]>(task.subtasks ?? []);
  const [newSubtask,     setNewSubtask]     = useState('');

  const patchSubtasks = async (updated: Subtask[]) => {
    await fetch(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtasks: updated }),
    });
  };

  const toggleSubtask = (id: string) => {
    const updated = subtasks.map((s) => s._id === id ? { ...s, done: !s.done } : s);
    setSubtasks(updated);
    patchSubtasks(updated);
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    const updated: Subtask[] = [...subtasks, { _id: `tmp-${Date.now()}`, text: newSubtask.trim(), done: false }];
    setSubtasks(updated);
    setNewSubtask('');
    patchSubtasks(updated);
  };

  const removeSubtask = (id: string) => {
    const updated = subtasks.filter((s) => s._id !== id);
    setSubtasks(updated);
    patchSubtasks(updated);
  };

  const subtaskDone = subtasks.filter((s) => s.done).length;

  // Swipe detection
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const isZombie = task.postponeCount >= 3;
  const isDoing  = task.status === 'doing';
  const isDone   = task.status === 'done';

  const age  = ageInDays(task.createdAt);
  const isAging = task.status === 'todo' && age >= 2;
  const isOld   = task.status === 'todo' && age >= 4;

  // ── Postpone ─────────────────────────────────────────────────
  const handlePostpone = () => {
    if (!postponeReason.trim()) { setReasonError(true); return; }
    onStatusChange(task, 'postponed', postponeReason.trim());
    setPostponeOpen(false);
    setPostponeReason('');
    setReasonError(false);
  };

  // ── Notes auto-save ──────────────────────────────────────────
  const handleNotesSave = async () => {
    if (notesValue === (task.notes ?? '')) return;
    setNotesSaving(true);
    await fetch(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesValue }),
    });
    setNotesSaving(false);
  };

  // ── Swipe gestures (mobile) ──────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    // Only horizontal swipes (must be more horizontal than vertical, min 60px)
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx > 0 && !isDone) {
      onStatusChange(task, 'done');
    } else if (dx < 0 && !isDone && task.status !== 'postponed') {
      setPostponeOpen(true);
    }
  };

  // ── Card style ───────────────────────────────────────────────
  const cardBg = isZombie
    ? 'rgba(120,53,15,0.25)'
    : 'var(--color-surface)';

  const agingBorderColor = isOld ? '#ef4444' : isAging ? '#f59e0b' : TAG_BORDER[task.tag];

  return (
    <div
      className="relative rounded-lg group"
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); }}
      onDragEnd={onDragEnd}
      style={{
        background:      cardBg,
        border:          '1px solid var(--color-line)',
        borderLeftWidth: '3px',
        borderLeftColor: isZombie ? '#f59e0b' : agingBorderColor,
        boxShadow:       isZombie ? 'var(--shadow-card), 0 0 0 1px rgba(217,119,6,0.3)'
                       : isDoing  ? 'var(--shadow-card), 0 0 0 1px rgba(59,130,246,0.3)'
                       : 'var(--shadow-card)',
        opacity:         isDragging ? 0.35 : 1,
        cursor:          'grab',
        transition:      'opacity 0.15s ease',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="px-3 pt-2.5 pb-2">

        {/* Zombie label */}
        {isZombie && (
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-1.5"
             style={{ color: '#f59e0b' }}>
            🧟 Zombie · postponed {task.postponeCount}×
          </p>
        )}

        {/* Aging warning */}
        {isAging && !isZombie && (
          <p className="text-[10px] font-semibold mb-1.5"
             style={{ color: isOld ? '#f87171' : '#fbbf24' }}>
            {isOld ? '⚠ Stalled' : '⏳ Aging'} · created {age} day{age !== 1 ? 's' : ''} ago
          </p>
        )}

        {/* Task text */}
        <p
          className="text-sm font-medium leading-snug"
          style={{
            color:          isDone ? 'var(--color-muted)' : 'var(--color-ink)',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {task.text}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                style={task.size === 'big'
                  ? { background: 'rgba(239,68,68,0.12)', color: '#f87171' }
                  : { background: 'var(--color-raised)', color: 'var(--color-muted)' }}>
            {task.size === 'big' ? '▲ big' : '▸ small'}
          </span>
          <span className={`tag-chip-${task.tag} text-[11px] font-medium px-1.5 py-0.5 rounded`}>
            {task.tag}
          </span>
          {task.estimatedMinutes && (
            <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
              ~{task.estimatedMinutes}m
            </span>
          )}
          {task.postponeCount > 0 && !isZombie && (
            <span className="text-[11px]" style={{ color: '#fb923c' }}>
              skipped {task.postponeCount}×
            </span>
          )}
          {task.isRecurring && (
            <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>↻</span>
          )}
          {isDoing && (
            <span className="flex items-center gap-1 text-[11px]" style={{ color: '#60a5fa' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
              in progress
            </span>
          )}
          {/* Subtask indicator */}
          {subtasks.length > 0 && (
            <button onClick={() => setSubtasksOpen((v) => !v)}
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{
                background: subtaskDone === subtasks.length ? 'rgba(16,185,129,0.12)' : 'var(--color-raised)',
                color: subtaskDone === subtasks.length ? '#34d399' : 'var(--color-muted)',
              }}>
              ☑ {subtaskDone}/{subtasks.length}
            </button>
          )}

          {/* Notes indicator */}
          {task.notes && !notesOpen && (
            <button
              onClick={() => setNotesOpen(true)}
              className="text-[11px]" style={{ color: 'var(--color-muted)' }}
              title="Show notes"
            >
              📝
            </button>
          )}
        </div>

        {/* Notes area */}
        {notesOpen && (
          <div className="mt-2">
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              onBlur={handleNotesSave}
              rows={3}
              placeholder="Add context, links, commands…"
              className="w-full text-xs rounded-md px-2 py-1.5 outline-none resize-none"
              style={{
                background: 'var(--color-raised)',
                color: 'var(--color-ink)',
                border: '1px solid var(--color-line)',
              }}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                {notesSaving ? 'Saving…' : 'Auto-saved on blur'}
              </span>
              <button
                onClick={() => setNotesOpen(false)}
                className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                Close
              </button>
            </div>
          </div>
        )}

        {!notesOpen && !task.notes && (
          <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setNotesOpen(true)}
              className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
              + note
            </button>
            <button onClick={() => setSubtasksOpen(true)}
              className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
              + subtasks
            </button>
          </div>
        )}

        {/* Subtask list */}
        {subtasksOpen && (
          <div className="mt-2 space-y-1">
            {subtasks.map((s) => (
              <div key={s._id} className="flex items-center gap-2 group/sub">
                <input type="checkbox" checked={s.done} onChange={() => toggleSubtask(s._id)}
                  className="rounded shrink-0" style={{ accentColor: '#3b82f6' }} />
                <span className="text-xs flex-1"
                      style={{ color: s.done ? 'var(--color-muted)' : 'var(--color-ink)',
                               textDecoration: s.done ? 'line-through' : 'none' }}>
                  {s.text}
                </span>
                <button onClick={() => removeSubtask(s._id)}
                  className="text-xs opacity-0 group-hover/sub:opacity-100 transition-opacity"
                  style={{ color: 'var(--color-muted)' }}>
                  ×
                </button>
              </div>
            ))}
            {/* Add subtask input */}
            <div className="flex items-center gap-1 mt-1.5">
              <input
                type="text" placeholder="Add subtask…" value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addSubtask(); if (e.key === 'Escape') setNewSubtask(''); }}
                className="flex-1 text-xs rounded px-2 py-1 outline-none"
                style={{ background: 'var(--color-raised)', color: 'var(--color-ink)', border: '1px solid var(--color-line)' }}
              />
              <button onClick={addSubtask}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'var(--color-accent)', color: '#fff' }}>
                +
              </button>
            </div>
          </div>
        )}

        {/* Postpone form */}
        {postponeOpen && (
          <div className="mt-2.5 space-y-1.5">
            <input
              autoFocus
              type="text"
              placeholder="Why? Be specific. (required)"
              value={postponeReason}
              onChange={(e) => { setPostponeReason(e.target.value); setReasonError(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handlePostpone()}
              className="w-full text-xs rounded-md px-2.5 py-1.5 outline-none"
              style={{
                background: 'var(--color-raised)',
                color: 'var(--color-ink)',
                border: `1px solid ${reasonError ? '#ef4444' : 'var(--color-line)'}`,
              }}
            />
            {reasonError && (
              <p className="text-[11px]" style={{ color: '#f87171' }}>A reason is required.</p>
            )}
            <div className="flex gap-1.5">
              <button onClick={handlePostpone}
                className="flex-1 text-xs rounded-md px-2 py-1 font-medium"
                style={{ background: 'rgba(234,88,12,0.15)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.3)' }}>
                Confirm postpone
              </button>
              <button onClick={() => { setPostponeOpen(false); setReasonError(false); setPostponeReason(''); }}
                className="text-xs px-2" style={{ color: 'var(--color-muted)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!postponeOpen && (
          <div className="flex items-center gap-1 mt-2.5 flex-wrap">

            {/* "Do it now" — only on postponed tasks */}
            {task.status === 'postponed' && (
              <button onClick={onDoItNow}
                className="text-[11px] font-semibold px-2 py-0.5 rounded"
                style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                ▶ Do it now
              </button>
            )}

            {task.status !== 'doing' && task.status !== 'done' && task.status !== 'postponed' && (
              <Btn onClick={() => onStatusChange(task, 'doing')} color="blue">Start</Btn>
            )}
            {isDoing && (
              <Btn onClick={onFocus} color="violet">Focus</Btn>
            )}
            {!isDone && (
              <Btn onClick={() => onStatusChange(task, 'done')} color="green">Done ✓</Btn>
            )}
            {isDone && (
              <Btn onClick={() => onStatusChange(task, 'todo')} color="muted">Undo</Btn>
            )}
            {!isDone && task.status !== 'postponed' && (
              <Btn onClick={() => setPostponeOpen(true)} color="orange">Postpone</Btn>
            )}
            {task.status === 'postponed' && (
              <Btn onClick={() => onStatusChange(task, 'todo')} color="muted">Restore</Btn>
            )}

            {/* Delete / Kill */}
            <button
              onClick={() => onDelete(task)}
              className="text-xs px-2 py-0.5 rounded transition-opacity opacity-0 group-hover:opacity-100 ml-auto"
              style={isZombie
                ? { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                : { color: 'var(--color-muted)' }}
              title={isZombie ? 'Abandon this zombie task' : 'Delete task'}
            >
              {isZombie ? '☠ Kill' : '×'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const BTN: Record<string, React.CSSProperties> = {
  blue:   { background: 'rgba(59,130,246,0.12)',  color: '#60a5fa',  border: '1px solid rgba(59,130,246,0.2)' },
  violet: { background: 'rgba(139,92,246,0.12)',  color: '#a78bfa',  border: '1px solid rgba(139,92,246,0.2)' },
  green:  { background: 'rgba(16,185,129,0.12)',  color: '#34d399',  border: '1px solid rgba(16,185,129,0.2)' },
  orange: { background: 'rgba(234,88,12,0.12)',   color: '#fb923c',  border: '1px solid rgba(234,88,12,0.2)' },
  muted:  { background: 'var(--color-raised)',     color: 'var(--color-muted)', border: '1px solid var(--color-line)' },
};

function Btn({ onClick, color, children }: {
  onClick: () => void; color: keyof typeof BTN; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className="text-[11px] font-medium px-2 py-0.5 rounded"
      style={BTN[color]}>
      {children}
    </button>
  );
}
