'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Task, TaskStatus, TaskTag, TaskSize } from '@/lib/types';
import TaskCard from '@/components/TaskCard';
import AddTaskForm from '@/components/AddTaskForm';
import FocusMode from '@/components/FocusMode';
import EatTheFrogModal from '@/components/EatTheFrogModal';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';

function localStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getTodayString() { return localStr(new Date()); }

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return localStr(d);
}

const COLUMNS: { status: TaskStatus; label: string; accent: string; emptyMsg: string }[] = [
  { status: 'todo',      label: 'Todo',        accent: '#4d7498', emptyMsg: 'Nothing queued.' },
  { status: 'doing',     label: 'In Progress', accent: '#3b82f6', emptyMsg: 'Nothing running.' },
  { status: 'done',      label: 'Done',        accent: '#10b981', emptyMsg: 'Nothing done yet.' },
  { status: 'postponed', label: 'Postponed',   accent: '#f59e0b', emptyMsg: 'Clean slate.' },
];

interface WeekSummary { week: string; completed: number; created: number; rate: number; }

export default function BoardPage() {
  const today = getTodayString();

  // ── Core state ──────────────────────────────────────────────
  const [selectedDate,    setSelectedDate]    = useState(today);
  const [tasks,           setTasks]           = useState<Task[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [streak,          setStreak]          = useState(0);
  const [focusTask,       setFocusTask]       = useState<Task | null>(null);
  const [addFormOpen,     setAddFormOpen]     = useState(false);
  const [lastWeekSummary, setLastWeekSummary] = useState<WeekSummary | null>(null);
  const [thisWeekSummary, setThisWeekSummary] = useState<WeekSummary | null>(null);

  // ── Today-only banners ──────────────────────────────────────
  const [carryover,     setCarryover]     = useState<Task[]>([]);
  const [carryoverDone, setCarryoverDone] = useState(false);
  const [frogTask,      setFrogTask]      = useState<Task | null>(null);
  const [frogDaysSince, setFrogDaysSince] = useState(0);

  // ── Delete modal ────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  // ── Drag state ──────────────────────────────────────────────
  const [draggingId,    setDraggingId]    = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const dragTaskRef = useRef<Task | null>(null);

  // ── Drop-to-postpone modal ──────────────────────────────────
  const [dropPostponeTask,   setDropPostponeTask]   = useState<Task | null>(null);
  const [dropPostponeReason, setDropPostponeReason] = useState('');
  const [dropPostponeError,  setDropPostponeError]  = useState(false);

  const isToday  = selectedDate === today;
  const todayDOW = new Date().getDay();

  // ── Fetch ───────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    const res  = await fetch(`/api/tasks?date=${selectedDate}`);
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [selectedDate]);

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/stats/summary');
    const d   = await res.json();
    setStreak(d.currentStreak ?? 0);
    setLastWeekSummary(d.lastWeekSummary ?? null);
    setThisWeekSummary(d.thisWeekSummary ?? null);
  }, []);

  // Recurring: generate today on every board load (fast + idempotent, passes local
  // date to avoid UTC mismatch); prefill future 30 days once per day.
  // generate must complete BEFORE prefill so lastGeneratedDate is up-to-date
  // when prefill simulates occurrences — otherwise the two can produce the same date.
  useEffect(() => {
    const fillKey = `fb_prefilled_${today}`;
    fetch(`/api/recurring/generate?date=${today}`)
      .then(() => {
        fetchTasks();
        if (!localStorage.getItem(fillKey)) {
          return fetch(`/api/recurring/prefill?date=${today}`)
            .then(() => localStorage.setItem(fillKey, '1'));
        }
      })
      .catch(() => {});
  }, [today, fetchTasks]);

  useEffect(() => { fetchTasks(); fetchStats(); }, [fetchTasks, fetchStats]);

  // Carry-over (today only)
  useEffect(() => {
    if (!isToday) return;
    const key = `fb_carryover_dismissed_${today}`;
    if (localStorage.getItem(key)) { setCarryoverDone(true); return; }
    fetch('/api/tasks/carryover')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d) && d.length > 0) setCarryover(d); })
      .catch(() => {});
  }, [today, isToday]);

  // Eat the frog (today only)
  useEffect(() => {
    if (!isToday) return;
    const key = `fb_frog_${today}`;
    if (localStorage.getItem(key)) return;
    fetch('/api/tasks/frog')
      .then((r) => r.json())
      .then((d) => { if (d && d.task) { setFrogTask(d.task as Task); setFrogDaysSince(d.daysSince ?? 0); } })
      .catch(() => {});
  }, [today, isToday]);

  // ── handleDoItNow — must be defined before useEffects that reference it ──
  const handleDoItNow = useCallback(async (task: Task) => {
    const res = await fetch(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'doing' }),
    });
    if (res.ok) {
      const updated: Task = await res.json();
      fetchTasks();
      setFocusTask(updated);
    }
  }, [fetchTasks]);

  // Command palette events
  useEffect(() => {
    const openForm   = () => setAddFormOpen(true);
    const startFocus = () => {
      const doingTask = tasks.find((t) => t.status === 'doing');
      if (doingTask) { setFocusTask(doingTask); return; }
      const firstTodo = tasks.find((t) => t.status === 'todo');
      if (firstTodo) handleDoItNow(firstTodo);
    };
    window.addEventListener('flowboard:openaddform', openForm);
    window.addEventListener('flowboard:startfocus',  startFocus);
    return () => {
      window.removeEventListener('flowboard:openaddform', openForm);
      window.removeEventListener('flowboard:startfocus',  startFocus);
    };
  }, [tasks, handleDoItNow]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return;
      if (el.isContentEditable) return;
      if (el.closest('[data-no-shortcut]')) return;
      if (focusTask) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setAddFormOpen(true);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        const doingTask = tasks.find((t) => t.status === 'doing');
        if (doingTask) { setFocusTask(doingTask); return; }
        const firstTodo = tasks.find((t) => t.status === 'todo');
        if (firstTodo) handleDoItNow(firstTodo);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusTask, tasks, handleDoItNow]);

  // ── Status change (optimistic) ──────────────────────────────
  const handleStatusChange = async (task: Task, newStatus: TaskStatus, postponeReason?: string) => {
    setTasks((prev) => prev.map((t) => t._id === task._id ? { ...t, status: newStatus } : t));
    const body: Record<string, unknown> = { status: newStatus };
    if (postponeReason) body.postponeReason = postponeReason;
    const res = await fetch(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) fetchTasks();
    else setTasks((prev) => prev.map((t) => t._id === task._id ? task : t));
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = (task: Task) => setDeleteTarget(task);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/tasks/${deleteTarget._id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    fetchTasks();
  };

  // ── Add task ────────────────────────────────────────────────
  const handleAddTask = async (data: {
    text: string; size: TaskSize; tag: TaskTag; estimatedMinutes?: number;
  }) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, date: selectedDate }),
    });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    fetchTasks();
  };

  // ── Carry-over ──────────────────────────────────────────────
  const handleCarryOver = async () => {
    await fetch('/api/tasks/carryover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: carryover.map((t) => t._id) }),
    });
    setCarryover([]);
    setCarryoverDone(true);
    localStorage.setItem(`fb_carryover_dismissed_${today}`, '1');
    fetchTasks();
  };
  const dismissCarryover = () => {
    setCarryover([]);
    setCarryoverDone(true);
    localStorage.setItem(`fb_carryover_dismissed_${today}`, '1');
  };

  // ── Drag & drop ─────────────────────────────────────────────
  const handleDragStart = useCallback((task: Task) => {
    dragTaskRef.current = task;
    setDraggingId(task._id);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragTaskRef.current = null;
    setDraggingId(null);
    setDragOverStatus(null);
    setDragOverTaskId(null);
  }, []);

  const handleColumnDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
    setDragOverTaskId(null); // hovering empty column area — clear task highlight
  };

  // Persist a new column ordering via bulk update
  const persistReorder = useCallback((updated: Task[]) => {
    fetch('/api/tasks/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: updated.map((t, i) => ({ id: t._id, sortOrder: i })) }),
    }).catch(() => fetchTasks());
  }, [fetchTasks]);

  // Move dragged task to just before dropBeforeTask within the same column
  const reorderTasks = useCallback((dragId: string, dropBeforeId: string) => {
    setTasks((prev) => {
      const dragged = prev.find((t) => t._id === dragId);
      if (!dragged) return prev;
      const col = prev.filter((t) => t.status === dragged.status);
      const others = prev.filter((t) => t.status !== dragged.status);
      const without = col.filter((t) => t._id !== dragId);
      const idx = without.findIndex((t) => t._id === dropBeforeId);
      if (idx === -1) return prev;
      const newCol = [...without];
      newCol.splice(idx, 0, dragged);
      const updated = newCol.map((t, i) => ({ ...t, sortOrder: i }));
      persistReorder(updated);
      return [...others, ...updated];
    });
  }, [persistReorder]);

  // Move dragged task to end of its column
  const moveTaskToEnd = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) => {
      const col = prev.filter((t) => t.status === status);
      const others = prev.filter((t) => t.status !== status);
      const dragged = col.find((t) => t._id === taskId);
      if (!dragged) return prev;
      const newCol = [...col.filter((t) => t._id !== taskId), dragged];
      const updated = newCol.map((t, i) => ({ ...t, sortOrder: i }));
      persistReorder(updated);
      return [...others, ...updated];
    });
  }, [persistReorder]);

  const handleColumnDrop = (targetStatus: TaskStatus) => {
    setDragOverStatus(null);
    setDragOverTaskId(null);
    const task = dragTaskRef.current;
    dragTaskRef.current = null;
    setDraggingId(null);
    if (!task) return;
    if (task.status === targetStatus) {
      // Same column, dropped on empty area → move to end
      moveTaskToEnd(task._id, targetStatus);
      return;
    }
    if (targetStatus === 'postponed') {
      setDropPostponeTask(task);
      return;
    }
    handleStatusChange(task, targetStatus);
  };

  // Dropped on a specific task card
  const handleTaskDrop = useCallback((targetTask: Task) => {
    setDragOverTaskId(null);
    setDragOverStatus(null);
    const dragging = dragTaskRef.current;
    dragTaskRef.current = null;
    setDraggingId(null);
    if (!dragging || dragging._id === targetTask._id) return;
    if (dragging.status !== targetTask.status) {
      // Cross-column drop → status change
      if (targetTask.status === 'postponed') {
        setDropPostponeTask(dragging);
      } else {
        handleStatusChange(dragging, targetTask.status);
      }
      return;
    }
    // Same column → reorder: insert before targetTask
    reorderTasks(dragging._id, targetTask._id);
  }, [reorderTasks, handleStatusChange]);

  const confirmDropPostpone = () => {
    if (!dropPostponeReason.trim()) { setDropPostponeError(true); return; }
    if (!dropPostponeTask) return;
    handleStatusChange(dropPostponeTask, 'postponed', dropPostponeReason.trim());
    setDropPostponeTask(null);
    setDropPostponeReason('');
    setDropPostponeError(false);
  };

  // ── Derived ─────────────────────────────────────────────────
  const zombieTasks    = tasks.filter((t) => t.postponeCount >= 3 && t.status !== 'done');
  const recurringTasks = tasks.filter((t) => t.isRecurring);
  const doneTasks      = tasks.filter((t) => t.status === 'done');

  if (focusTask) {
    return (
      <FocusMode
        task={focusTask}
        onClose={() => setFocusTask(null)}
        onDone={() => { handleStatusChange(focusTask, 'done'); setFocusTask(null); }}
      />
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-canvas)' }}>

      {/* ── Modals ──────────────────────────────────────────── */}
      {frogTask && isToday && (
        <EatTheFrogModal
          task={frogTask}
          daysSince={frogDaysSince}
          onDoItNow={() => { const t = frogTask; setFrogTask(null); localStorage.setItem(`fb_frog_${today}`, '1'); handleDoItNow(t); }}
          onDismiss={() => { setFrogTask(null); localStorage.setItem(`fb_frog_${today}`, '1'); }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          task={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {dropPostponeTask && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
             onClick={() => { setDropPostponeTask(null); setDropPostponeReason(''); setDropPostponeError(false); }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
               onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#f59e0b' }}>
                Postpone task
              </p>
              <p className="text-sm font-medium mb-3 truncate" style={{ color: 'var(--color-ink)' }}>
                &ldquo;{dropPostponeTask.text}&rdquo;
              </p>
              <input
                autoFocus
                type="text"
                placeholder="Why are you postponing this? (required)"
                value={dropPostponeReason}
                onChange={(e) => { setDropPostponeReason(e.target.value); setDropPostponeError(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmDropPostpone(); if (e.key === 'Escape') { setDropPostponeTask(null); setDropPostponeReason(''); } }}
                className="w-full text-sm rounded-xl px-3 py-2 outline-none"
                style={{ background: 'var(--color-raised)', color: 'var(--color-ink)', border: `1px solid ${dropPostponeError ? '#ef4444' : 'var(--color-line)'}` }}
              />
              {dropPostponeError && <p className="text-xs mt-1" style={{ color: '#f87171' }}>A reason is required.</p>}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={confirmDropPostpone}
                className="flex-1 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(234,88,12,0.15)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.3)' }}>
                Confirm postpone
              </button>
              <button onClick={() => { setDropPostponeTask(null); setDropPostponeReason(''); setDropPostponeError(false); }}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ background: 'var(--color-raised)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-5">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
          <div>
            {/* Date navigation */}
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => setSelectedDate((d) => addDays(d, -1))}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', color: 'var(--color-muted)' }}
                onMouseEnter={(e) => { (e.currentTarget).style.color = 'var(--color-ink)'; }}
                onMouseLeave={(e) => { (e.currentTarget).style.color = 'var(--color-muted)'; }}>
                ‹
              </button>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--color-ink)' }}>
                {formatDate(selectedDate)}
              </h1>
              <button onClick={() => setSelectedDate((d) => addDays(d, 1))}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', color: 'var(--color-muted)' }}
                onMouseEnter={(e) => { (e.currentTarget).style.color = 'var(--color-ink)'; }}
                onMouseLeave={(e) => { (e.currentTarget).style.color = 'var(--color-muted)'; }}>
                ›
              </button>
              {!isToday && (
                <button onClick={() => setSelectedDate(today)}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium ml-1"
                  style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                  Today
                </button>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {doneTasks.length}/{tasks.length} tasks completed
              <span className="ml-3 text-[11px] opacity-40">N · new&nbsp;&nbsp;F · focus</span>
            </p>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
            <span className="text-xl">🔥</span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted)' }}>Streak</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: '#f59e0b' }}>
                {streak}
                <span className="text-sm font-normal ml-1" style={{ color: 'var(--color-muted)' }}>days</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Not-today banner ──────────────────────────────── */}
        {!isToday && (
          <div className="mb-4 px-4 py-2.5 rounded-xl flex items-center gap-3"
               style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <span className="text-base">📅</span>
            <p className="text-sm font-medium flex-1" style={{ color: '#818cf8' }}>
              {selectedDate < today ? 'Viewing past board' : 'Viewing future board'} — {selectedDate < today ? 'read/edit past tasks' : 'plan ahead'}
            </p>
            <button onClick={() => setSelectedDate(today)}
              className="text-xs px-2.5 py-1 rounded-lg font-medium shrink-0"
              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
              Back to today
            </button>
          </div>
        )}

        {/* ── Monday banner ─────────────────────────────────── */}
        {isToday && todayDOW === 1 && lastWeekSummary && (
          <div className="mb-4 px-4 py-3 rounded-xl flex items-start gap-3"
               style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <span className="text-xl shrink-0">📅</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#60a5fa' }}>
                Last week: {lastWeekSummary.completed}/{lastWeekSummary.created} tasks done ({lastWeekSummary.rate}%)
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(96,165,250,0.65)' }}>
                {lastWeekSummary.rate >= 70 ? 'Solid week. Keep the momentum.' : lastWeekSummary.rate >= 40 ? 'Decent. Push harder this week.' : 'Rough week. Today is a new start.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Sunday banner ─────────────────────────────────── */}
        {isToday && todayDOW === 0 && thisWeekSummary && (
          <div className="mb-4 px-4 py-3 rounded-xl flex items-start gap-3"
               style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <span className="text-xl shrink-0">🗓</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>
                End of week: {thisWeekSummary.completed}/{thisWeekSummary.created} done ({thisWeekSummary.rate}%)
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(167,139,250,0.65)' }}>
                {thisWeekSummary.rate >= 70 ? 'Great week. Finish strong today.' : thisWeekSummary.rate >= 40 ? 'Not bad. A few more before midnight?' : 'Unfinished business. Pick one thing and ship it.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Carry-over banner ────────────────────────────── */}
        {isToday && carryover.length > 0 && !carryoverDone && (
          <div className="mb-4 px-4 py-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">📥</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>
                  {carryover.length} unfinished task{carryover.length > 1 ? 's' : ''} from yesterday
                </p>
                <div className="mt-1 space-y-0.5">
                  {carryover.slice(0, 3).map((t) => (
                    <p key={t._id} className="text-xs truncate" style={{ color: 'rgba(167,139,250,0.7)' }}>· {t.text}</p>
                  ))}
                  {carryover.length > 3 && (
                    <p className="text-xs" style={{ color: 'rgba(167,139,250,0.5)' }}>+ {carryover.length - 3} more</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleCarryOver}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                  Carry over all
                </button>
                <button onClick={dismissCarryover} className="text-xs px-2 py-1.5 rounded-lg" style={{ color: 'var(--color-muted)' }}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Zombie banner ─────────────────────────────────── */}
        {zombieTasks.length > 0 && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl"
               style={{ background: 'rgba(120,53,15,0.2)', border: '1px solid rgba(217,119,6,0.4)' }}>
            <span className="text-xl shrink-0">🧟</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
                {zombieTasks.length} zombie task{zombieTasks.length > 1 ? 's' : ''} — you can&apos;t keep ignoring {zombieTasks.length > 1 ? 'these' : 'this'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(251,191,36,0.6)' }}>
                Complete them or kill them. No more postponing.
              </p>
            </div>
          </div>
        )}

        {/* ── Add task ──────────────────────────────────────── */}
        <div className="mb-5">
          <AddTaskForm onAdd={handleAddTask} open={addFormOpen} onOpenChange={setAddFormOpen} />
        </div>

        {/* ── Kanban board ──────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {COLUMNS.map(({ status }) => <ColumnSkeleton key={status} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {COLUMNS.map(({ status, label, accent, emptyMsg }) => {
              const colTasks = tasks.filter((t) => t.status === status);
              const isOver   = dragOverStatus === status;
              return (
                <div key={status}
                  className="flex flex-col gap-2"
                  onDragOver={(e) => handleColumnDragOver(e, status)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      setDragOverStatus(null);
                  }}
                  onDrop={() => handleColumnDrop(status)}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: accent }}>
                        {label}
                      </span>
                    </div>
                    {colTasks.length > 0 && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                            style={{ background: `${accent}20`, color: accent }}>
                        {colTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Drop zone */}
                  <div
                    className="flex flex-col gap-2 rounded-xl min-h-[80px] p-1.5 transition-all"
                    style={{
                      background: isOver ? `${accent}10` : 'transparent',
                      border:     isOver ? `1.5px dashed ${accent}60` : '1.5px dashed transparent',
                    }}
                  >
                    {colTasks.map((task) => (
                      <div
                        key={task._id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                          setDragOverTaskId(task._id);
                          setDragOverStatus(null);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node))
                            setDragOverTaskId(null);
                        }}
                        onDrop={(e) => { e.stopPropagation(); handleTaskDrop(task); }}
                        style={{
                          borderTop: dragOverTaskId === task._id
                            ? '2px solid #3b82f6'
                            : '2px solid transparent',
                        }}
                      >
                        <TaskCard
                          task={task}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                          onFocus={() => setFocusTask(task)}
                          onDoItNow={() => handleDoItNow(task)}
                          onDragStart={() => handleDragStart(task)}
                          onDragEnd={handleDragEnd}
                          isDragging={draggingId === task._id}
                        />
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div className="rounded-lg px-3 py-6 text-center text-xs flex-1"
                           style={{
                             background: isOver ? 'transparent' : 'var(--color-raised)',
                             border: isOver ? 'none' : '1px dashed var(--color-line)',
                             color: 'var(--color-muted)',
                           }}>
                        {isOver ? `Drop here → ${label}` : emptyMsg}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Recurring tasks today ─────────────────────────── */}
        {recurringTasks.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">↻</span>
              <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted)' }}>
                Recurring {isToday ? 'today' : `on ${selectedDate}`}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {recurringTasks.map((task) => (
                <div key={task._id}
                  className="rounded-lg px-3 py-2.5 flex items-center gap-2.5"
                  style={{
                    background:      'var(--color-surface)',
                    border:          '1px solid var(--color-line)',
                    borderLeftWidth: '3px',
                    borderLeftColor: TAG_BORDER_COLORS[task.tag],
                    opacity:         task.status === 'done' ? 0.5 : 1,
                  }}>
                  <span className="text-base">{task.status === 'done' ? '✓' : '○'}</span>
                  <p className="text-sm flex-1 min-w-0 truncate"
                     style={{
                       color:          task.status === 'done' ? 'var(--color-muted)' : 'var(--color-ink)',
                       textDecoration: task.status === 'done' ? 'line-through' : 'none',
                     }}>
                    {task.text}
                  </p>
                  <span className={`tag-chip-${task.tag} text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0`}>
                    {task.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TAG_BORDER_COLORS: Record<string, string> = {
  work: '#3b82f6', learning: '#8b5cf6', personal: '#ec4899', health: '#10b981',
};

function ColumnSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-4 w-20 rounded animate-pulse" style={{ background: 'var(--color-raised)' }} />
      {[1, 2].map((i) => (
        <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: 'var(--color-surface)' }} />
      ))}
    </div>
  );
}
