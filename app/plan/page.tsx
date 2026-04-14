'use client';
import { useState, useEffect, useCallback } from 'react';
import { Task, RecurringTask, TaskTag, TaskSize } from '@/lib/types';
import AddTaskForm from '@/components/AddTaskForm';
import ConfirmModal from '@/components/ConfirmModal';

function localStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getTodayString()    { return localStr(new Date()); }
function getYesterdayString() { const d = new Date(); d.setDate(d.getDate()-1); return localStr(d); }
function getTomorrowString()  { const d = new Date(); d.setDate(d.getDate()+1); return localStr(d); }

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function shouldRunTomorrow(rt: RecurringTask, tomorrowStr: string): boolean {
  const t = new Date(tomorrowStr + 'T12:00:00');
  const dow = t.getDay();
  const dom = t.getDate();
  switch (rt.frequency) {
    case 'daily':        return true;
    case 'weekdays':     return dow >= 1 && dow <= 5;
    case 'every_x_days': {
      if (!rt.lastGeneratedDate || !rt.frequencyValue) return true;
      const diff = Math.floor((t.getTime() - new Date(rt.lastGeneratedDate).getTime()) / 86400000);
      return diff >= rt.frequencyValue;
    }
    case 'weekly':   return dow === (rt.frequencyValue ?? 1);
    case 'biweekly': {
      if (!rt.lastGeneratedDate) return true;
      const diff = Math.floor((t.getTime() - new Date(rt.lastGeneratedDate).getTime()) / 86400000);
      return diff >= 14;
    }
    case 'monthly':  return dom === (rt.frequencyValue ?? 1);
    default:         return false;
  }
}

const TAG_BORDER: Record<string, string> = {
  work: '#3b82f6', learning: '#8b5cf6', personal: '#ec4899', health: '#10b981',
};
const TAG_COLOR: Record<string, string> = {
  work: '#3b82f6', learning: '#8b5cf6', personal: '#ec4899', health: '#10b981',
};

function verdictMessage(rate: number, postponed: number): string {
  if (rate >= 90) return 'Exceptional day. You followed through.';
  if (rate >= 70) return 'Solid. A few things slipped — why?';
  if (rate >= 40) return 'Mediocre. You completed less than you planned.';
  if (rate > 0)   return `${postponed > 0 ? `${postponed} postponed. ` : ''}You left most things unfinished.`;
  return 'Nothing completed. That needs to change today.';
}

export default function PlanPage() {
  const today     = getTodayString();
  const yesterday = getYesterdayString();
  const tomorrow  = getTomorrowString();

  // ── Yesterday data ────────────────────────────────────────────
  const [yesterdayTasks, setYesterdayTasks] = useState<Task[]>([]);

  // ── Today data ────────────────────────────────────────────────
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [committed,  setCommitted]  = useState<string[]>([]); // task IDs

  // ── Intention ─────────────────────────────────────────────────
  const [intention,     setIntention]     = useState('');
  const [intentionSaved, setIntentionSaved] = useState(false);

  // ── Tomorrow data ─────────────────────────────────────────────
  const [tomorrowTasks,  setTomorrowTasks]  = useState<Task[]>([]);
  const [deleteTarget,   setDeleteTarget]   = useState<Task | null>(null);
  const [autoTasks,     setAutoTasks]     = useState<RecurringTask[]>([]);

  const fetchAll = useCallback(async () => {
    const [yr, tr, tmr, rr] = await Promise.all([
      fetch(`/api/tasks?date=${yesterday}`),
      fetch(`/api/tasks?date=${today}`),
      fetch(`/api/tasks?date=${tomorrow}`),
      fetch('/api/recurring'),
    ]);
    const [yd, td, tmd, rd] = await Promise.all([yr.json(), tr.json(), tmr.json(), rr.json()]);
    setYesterdayTasks(Array.isArray(yd) ? yd : []);
    setTodayTasks(Array.isArray(td) ? td : []);
    setTomorrowTasks(Array.isArray(tmd) ? tmd : []);
    setAutoTasks(
      Array.isArray(rd)
        ? rd.filter((rt: RecurringTask) => rt.isActive && shouldRunTomorrow(rt, tomorrow))
        : []
    );
  }, [yesterday, today, tomorrow]);

  useEffect(() => {
    fetchAll();
    // Load committed priorities from localStorage
    const saved = localStorage.getItem(`fb_priorities_${today}`);
    if (saved) setCommitted(JSON.parse(saved));
    // Load intention
    const intent = localStorage.getItem(`fb_intention_${today}`);
    if (intent) { setIntention(intent); setIntentionSaved(true); }
  }, [fetchAll, today]);

  const toggleCommit = (id: string) => {
    setCommitted((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter((x) => x !== id);
      } else if (prev.length < 3) {
        next = [...prev, id];
      } else {
        return prev; // max 3
      }
      localStorage.setItem(`fb_priorities_${today}`, JSON.stringify(next));
      return next;
    });
  };

  const saveIntention = () => {
    if (!intention.trim()) return;
    localStorage.setItem(`fb_intention_${today}`, intention.trim());
    setIntentionSaved(true);
  };

  const handleAddTomorrow = async (data: { text: string; size: TaskSize; tag: TaskTag; estimatedMinutes?: number }) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, date: tomorrow }),
    });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    fetchAll();
  };

  const handleDeleteTomorrow = (task: Task) => setDeleteTarget(task);

  const confirmDeleteTomorrow = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/tasks/${deleteTarget._id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    fetchAll();
  };

  // ── Derived stats ─────────────────────────────────────────────
  const ydDone      = yesterdayTasks.filter((t) => t.status === 'done').length;
  const ydPostponed = yesterdayTasks.filter((t) => t.status === 'postponed').length;
  const ydTotal     = yesterdayTasks.length;
  const ydRate      = ydTotal > 0 ? Math.round((ydDone / ydTotal) * 100) : null;

  const todayBig    = todayTasks.filter((t) => t.size === 'big' && t.status !== 'done');
  const todayAll    = todayTasks.filter((t) => t.status !== 'done');
  const tmrBigCount = tomorrowTasks.filter((t) => t.size === 'big').length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-canvas)' }}>
      {deleteTarget && (
        <ConfirmModal
          title="Remove from tomorrow"
          message={deleteTarget.text}
          detail="This only removes it from tomorrow's plan. The task won't be carried elsewhere."
          confirmLabel="Remove"
          onConfirm={confirmDeleteTomorrow}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-1"
             style={{ color: 'var(--color-muted)' }}>Daily Planning Ritual</p>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-ink)' }}>
            {formatDate(today)}
          </h1>
        </div>

        {/* ═══════════════════════════════════════════════════════
            STEP 1 — Yesterday's verdict
        ════════════════════════════════════════════════════════ */}
        <section>
          <StepHeader step={1} label="Yesterday's verdict" date={formatDate(yesterday)} />

          {ydTotal === 0 ? (
            <div className="rounded-xl px-4 py-3"
                 style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No tasks recorded for yesterday.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden"
                 style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
              {/* Rate bar */}
              <div className="h-1.5 w-full" style={{ background: 'var(--color-raised)' }}>
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${ydRate ?? 0}%`,
                    background: (ydRate ?? 0) >= 70 ? '#10b981' : (ydRate ?? 0) >= 40 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>

              <div className="px-4 py-4">
                {/* Numbers */}
                <div className="flex items-center gap-5 mb-3">
                  <Stat value={`${ydDone}/${ydTotal}`} label="completed"
                        color={(ydRate ?? 0) >= 70 ? '#10b981' : (ydRate ?? 0) >= 40 ? '#f59e0b' : '#ef4444'} />
                  <Stat value={`${ydRate ?? 0}%`}      label="rate"
                        color={(ydRate ?? 0) >= 70 ? '#10b981' : (ydRate ?? 0) >= 40 ? '#f59e0b' : '#ef4444'} />
                  {ydPostponed > 0 && (
                    <Stat value={String(ydPostponed)} label="postponed" color="#f59e0b" />
                  )}
                </div>

                {/* Verdict message */}
                <p className="text-sm font-medium" style={{ color: 'var(--color-ink)' }}>
                  {verdictMessage(ydRate ?? 0, ydPostponed)}
                </p>

                {/* Unfinished tasks */}
                {yesterdayTasks.filter((t) => t.status !== 'done').length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-widest"
                       style={{ color: 'var(--color-muted)' }}>Left unfinished</p>
                    {yesterdayTasks
                      .filter((t) => t.status !== 'done')
                      .slice(0, 4)
                      .map((t) => (
                        <div key={t._id} className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: t.status === 'postponed' ? '#f59e0b' : '#ef4444' }}>
                            {t.status === 'postponed' ? '⏸' : '○'}
                          </span>
                          <p className="text-sm truncate" style={{ color: 'var(--color-muted)' }}>{t.text}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════
            STEP 2 — Today's commitment (pick 3 priorities)
        ════════════════════════════════════════════════════════ */}
        <section>
          <StepHeader step={2} label="Today's priorities" subtitle="Pick up to 3 tasks you commit to finishing" />

          {todayAll.length === 0 ? (
            <div className="rounded-xl px-4 py-3"
                 style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                No open tasks for today yet.{' '}
                <a href="/" className="underline" style={{ color: 'var(--color-muted)' }}>Add them on the board.</a>
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Show big tasks first, then small */}
              {[...todayBig, ...todayAll.filter((t) => t.size !== 'big')].map((task) => {
                const isPriority = committed.includes(task._id);
                const accentColor = TAG_COLOR[task.tag];
                return (
                  <button
                    key={task._id}
                    onClick={() => toggleCommit(task._id)}
                    className="w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-all"
                    style={{
                      background: isPriority ? `${accentColor}15` : 'var(--color-surface)',
                      border: `1px solid ${isPriority ? `${accentColor}50` : 'var(--color-line)'}`,
                      borderLeftWidth: '3px',
                      borderLeftColor: accentColor,
                      opacity: committed.length >= 3 && !isPriority ? 0.45 : 1,
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{
                        borderColor: isPriority ? accentColor : 'var(--color-line)',
                        background:  isPriority ? accentColor : 'transparent',
                        color: 'white',
                      }}
                    >
                      {isPriority ? committed.indexOf(task._id) + 1 : ''}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-ink)' }}>
                        {task.text}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium" style={{ color: accentColor }}>{task.tag}</span>
                        <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{task.size}</span>
                        {task.postponeCount > 0 && (
                          <span className="text-[10px]" style={{ color: '#f59e0b' }}>{task.postponeCount}× postponed</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {committed.length > 0 && (
                <p className="text-xs text-center pt-1 font-medium"
                   style={{ color: committed.length === 3 ? '#10b981' : 'var(--color-muted)' }}>
                  {committed.length === 3
                    ? '✓ Committed to 3 tasks. Now do them.'
                    : `${committed.length}/3 selected — pick ${3 - committed.length} more`}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════
            STEP 3 — Daily intention
        ════════════════════════════════════════════════════════ */}
        <section>
          <StepHeader step={3} label="Daily intention" subtitle="One sentence. What must happen today?" />

          <div className="rounded-xl overflow-hidden"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
            {intentionSaved ? (
              <div className="px-4 py-4">
                <p className="text-sm italic leading-relaxed" style={{ color: 'var(--color-ink)' }}>
                  &ldquo;{intention}&rdquo;
                </p>
                <button
                  onClick={() => setIntentionSaved(false)}
                  className="mt-2 text-xs"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Edit
                </button>
              </div>
            ) : (
              <div className="px-4 py-4">
                <textarea
                  value={intention}
                  onChange={(e) => setIntention(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveIntention(); }
                  }}
                  placeholder="Today will be a success if I…"
                  rows={2}
                  className="w-full resize-none bg-transparent text-sm outline-none"
                  style={{ color: 'var(--color-ink)' }}
                  data-no-shortcut=""
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Press Enter to save</span>
                  <button
                    onClick={saveIntention}
                    disabled={!intention.trim()}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: intention.trim() ? 'rgba(59,130,246,0.15)' : 'var(--color-raised)',
                      color: intention.trim() ? '#60a5fa' : 'var(--color-muted)',
                      border: `1px solid ${intention.trim() ? 'rgba(59,130,246,0.3)' : 'var(--color-line)'}`,
                    }}
                  >
                    Save →
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            Tomorrow prep
        ════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px" style={{ background: 'var(--color-line)' }} />
            <p className="text-[11px] font-semibold uppercase tracking-widest shrink-0"
               style={{ color: 'var(--color-muted)' }}>
              Tomorrow — {formatDate(tomorrow)}
            </p>
            <div className="flex-1 h-px" style={{ background: 'var(--color-line)' }} />
          </div>

          {/* Auto-loaded recurring */}
          {autoTasks.length > 0 && (
            <div className="mb-4 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5"
                 style={{ color: 'var(--color-muted)' }}>
                <span>↻</span> Auto-loaded recurring
              </p>
              {autoTasks.map((rt) => (
                <div key={rt._id}
                  className="rounded-lg px-3 py-2.5 flex items-center gap-3"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-line)',
                    borderLeftWidth: '3px',
                    borderLeftColor: TAG_BORDER[rt.tag],
                    opacity: 0.65,
                  }}>
                  <p className="flex-1 text-sm" style={{ color: 'var(--color-ink)' }}>{rt.text}</p>
                  <span className={`tag-chip-${rt.tag} text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0`}>
                    {rt.tag}
                  </span>
                  <span className="text-xs font-semibold shrink-0" style={{ color: '#f59e0b' }}>
                    🔥 {rt.streak}
                  </span>
                  <span className="text-[11px] shrink-0 italic" style={{ color: 'var(--color-muted)' }}>auto</span>
                </div>
              ))}
            </div>
          )}

          {/* Add custom tasks for tomorrow */}
          <div className="mb-4">
            <AddTaskForm onAdd={handleAddTomorrow} />
          </div>

          {tomorrowTasks.length > 0 && (
            <div className="space-y-1.5">
              {tomorrowTasks.map((task) => (
                <div key={task._id}
                  className="rounded-lg px-3 py-2.5 flex items-center gap-3"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-line)',
                    borderLeftWidth: '3px',
                    borderLeftColor: TAG_BORDER[task.tag],
                  }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-ink)' }}>{task.text}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`tag-chip-${task.tag} text-[11px] font-medium px-1.5 py-0.5 rounded`}>
                        {task.tag}
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded"
                            style={task.size === 'big'
                              ? { background: 'rgba(239,68,68,0.12)', color: '#f87171' }
                              : { background: 'var(--color-raised)', color: 'var(--color-muted)' }}>
                        {task.size}
                      </span>
                      {task.estimatedMinutes && (
                        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                          ~{task.estimatedMinutes}m
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteTomorrow(task)}
                    className="text-lg shrink-0 transition-colors"
                    style={{ color: 'var(--color-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = '#ef4444'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'}>
                    ×
                  </button>
                </div>
              ))}
              <p className="text-[11px] text-center pt-1" style={{ color: 'var(--color-muted)' }}>
                {tmrBigCount}/3 big tasks for tomorrow
              </p>
            </div>
          )}

          {tomorrowTasks.length === 0 && autoTasks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                Tomorrow is empty. Plan something meaningful.
              </p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function StepHeader({ step, label, subtitle, date }: {
  step: number; label: string; subtitle?: string; date?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold"
        style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}
      >
        {step}
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>{label}</p>
        {(subtitle || date) && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
            {date ?? subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-muted)' }}>{label}</p>
    </div>
  );
}
