'use client';
import { useState, useEffect } from 'react';
import { RecurringTask, TaskTag, TaskSize, Frequency } from '@/lib/types';
import ConfirmModal from '@/components/ConfirmModal';

function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const TAGS: TaskTag[] = ['work', 'learning', 'personal', 'health'];
const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily',        label: 'Daily' },
  { value: 'weekdays',     label: 'Weekdays only' },
  { value: 'every_x_days', label: 'Every X days' },
  { value: 'weekly',       label: 'Weekly (pick day)' },
  { value: 'biweekly',     label: 'Biweekly' },
  { value: 'monthly',      label: 'Monthly (pick date)' },
];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const TAG_BORDER: Record<string, string> = {
  work: '#3b82f6', learning: '#8b5cf6', personal: '#ec4899', health: '#10b981',
};

interface TagLimits { work: number; learning: number; personal: number; health: number; }

function freqLabel(t: RecurringTask): string {
  switch (t.frequency) {
    case 'daily':        return 'Every day';
    case 'weekdays':     return 'Mon – Fri';
    case 'every_x_days': return `Every ${t.frequencyValue} days`;
    case 'weekly':       return `Every ${DAYS[t.frequencyValue ?? 1]}`;
    case 'biweekly':     return 'Every 2 weeks';
    case 'monthly':      return `Day ${t.frequencyValue} of month`;
    default:             return t.frequency;
  }
}

export default function RecurringPage() {
  const [tasks,       setTasks]       = useState<RecurringTask[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecurringTask | null>(null);

  // New task form
  const [text,      setText]      = useState('');
  const [size,      setSize]      = useState<TaskSize>('small');
  const [tag,       setTag]       = useState<TaskTag>('work');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [freqValue, setFreqValue] = useState('1');

  // Tag daily limits
  const [limits,       setLimits]       = useState<TagLimits>({ work: 0, learning: 0, personal: 0, health: 0 });
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsSaved,  setLimitsSaved]  = useState(false);

  const fetchTasks = async () => {
    const r = await fetch('/api/recurring');
    setTasks(await r.json());
    setLoading(false);
  };

  const fetchPrefs = async () => {
    const r = await fetch('/api/preferences');
    if (r.ok) {
      const d = await r.json();
      if (d.tagLimits) setLimits(d.tagLimits);
    }
  };

  useEffect(() => { fetchTasks(); fetchPrefs(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const needsValue = ['every_x_days', 'weekly', 'monthly'].includes(frequency);
    await fetch('/api/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(), size, tag, frequency,
        frequencyValue: needsValue ? parseInt(freqValue) : undefined,
      }),
    });
    setText(''); setFrequency('daily'); setFreqValue('1');
    setShowForm(false);
    fetchTasks();

    // Immediately generate today's instance then prefill future boards/calendar.
    // Sequential: generate must finish first so lastGeneratedDate is written before
    // prefill reads it — otherwise both can produce tasks for the same date.
    const today = localDateStr();
    localStorage.removeItem(`fb_prefilled_${today}`);
    fetch(`/api/recurring/generate?date=${today}`)
      .then(() => fetch(`/api/recurring/prefill?date=${today}`))
      .catch(() => {});
  };

  const toggleActive = async (t: RecurringTask) => {
    await fetch(`/api/recurring/${t._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    fetchTasks();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/recurring/${deleteTarget._id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    fetchTasks();
  };

  const handleSaveLimits = async () => {
    setLimitsSaving(true);
    await fetch('/api/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagLimits: limits }),
    });
    setLimitsSaving(false);
    setLimitsSaved(true);
    setTimeout(() => setLimitsSaved(false), 2000);
  };

  const needsValue = ['every_x_days', 'weekly', 'monthly'].includes(frequency);
  const inputStyle = {
    background: 'var(--color-raised)',
    color: 'var(--color-ink)',
    border: '1px solid var(--color-line)',
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-canvas)' }}>
      {deleteTarget && (
        <ConfirmModal
          title="Delete recurring task"
          message={deleteTarget.text}
          detail="This will also remove all scheduled instances from today onwards. Past completed instances are kept."
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-ink)' }}>
            Recurring Tasks
          </h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            style={{ background: showForm ? 'var(--color-raised)' : 'var(--color-accent)', color: showForm ? 'var(--color-muted)' : '#fff' }}>
            {showForm ? 'Cancel' : '+ New recurring task'}
          </button>
        </div>

        {/* ── Create form ─────────────────────────────────── */}
        {showForm && (
          <form onSubmit={handleCreate}
                className="rounded-xl p-4 space-y-3"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-accent)', boxShadow: '0 0 0 3px rgba(59,130,246,0.08)' }}>
            <input
              autoFocus type="text" placeholder="Task description"
              value={text} onChange={(e) => setText(e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2 outline-none"
              style={inputStyle}
            />
            <div className="flex flex-wrap gap-2">
              {/* Size */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-line)' }}>
                {(['small', 'big'] as TaskSize[]).map((s) => (
                  <button key={s} type="button" onClick={() => setSize(s)}
                    className="px-3 py-1.5 text-xs font-medium transition-all"
                    style={size === s
                      ? { background: 'var(--color-accent)', color: '#fff' }
                      : { color: 'var(--color-muted)', background: 'transparent' }}>
                    {s === 'big' ? '▲ big' : '▸ small'}
                  </button>
                ))}
              </div>
              {/* Tag */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-line)' }}>
                {TAGS.map((t) => (
                  <button key={t} type="button" onClick={() => setTag(t)}
                    className="px-3 py-1.5 text-xs capitalize transition-all"
                    style={tag === t
                      ? { background: `${TAG_BORDER[t]}22`, color: TAG_BORDER[t] }
                      : { color: 'var(--color-muted)', background: 'transparent' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {/* Frequency */}
            <div className="flex flex-wrap gap-2 items-center">
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}
                className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                {FREQUENCIES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {frequency === 'every_x_days' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--color-muted)' }}>Every</span>
                  <input type="number" min="2" max="365" value={freqValue}
                    onChange={(e) => setFreqValue(e.target.value)}
                    className="w-16 text-sm text-center rounded-lg px-2 py-2 outline-none"
                    style={inputStyle} />
                  <span className="text-sm" style={{ color: 'var(--color-muted)' }}>days</span>
                </div>
              )}
              {frequency === 'weekly' && (
                <select value={freqValue} onChange={(e) => setFreqValue(e.target.value)}
                  className="text-sm rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              )}
              {frequency === 'monthly' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--color-muted)' }}>Day</span>
                  <input type="number" min="1" max="31" value={freqValue}
                    onChange={(e) => setFreqValue(e.target.value)}
                    className="w-16 text-sm text-center rounded-lg px-2 py-2 outline-none"
                    style={inputStyle} />
                  <span className="text-sm" style={{ color: 'var(--color-muted)' }}>of month</span>
                </div>
              )}
            </div>
            <button type="submit"
              className="text-sm font-medium px-4 py-1.5 rounded-lg"
              style={{ background: 'var(--color-accent)', color: '#fff' }}>
              Create
            </button>
          </form>
        )}

        {/* ── Tag daily limits ─────────────────────────────── */}
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-ink)' }}>
            Daily tag limits
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-muted)' }}>
            Maximum tasks per tag per day. Set to 0 for unlimited.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TAGS.map((t) => (
              <div key={t}>
                <label className="block text-xs font-medium capitalize mb-1.5"
                       style={{ color: TAG_BORDER[t] }}>
                  {t}
                </label>
                <input
                  type="number" min="0" max="50"
                  value={limits[t]}
                  onChange={(e) => setLimits((prev) => ({ ...prev, [t]: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full text-sm text-center rounded-lg px-3 py-2 outline-none"
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleSaveLimits}
              disabled={limitsSaving}
              className="text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-50"
              style={{ background: 'var(--color-accent)', color: '#fff' }}>
              {limitsSaving ? 'Saving…' : 'Save limits'}
            </button>
            {limitsSaved && (
              <span className="text-xs" style={{ color: '#10b981' }}>✓ Saved</span>
            )}
          </div>
        </div>

        {/* ── Task list ────────────────────────────────────── */}
        {loading ? (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--color-muted)' }}>Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--color-muted)' }}>
            No recurring tasks yet.
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task._id}
                className="rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity"
                style={{
                  background:      'var(--color-surface)',
                  border:          '1px solid var(--color-line)',
                  borderLeftWidth: '3px',
                  borderLeftColor: TAG_BORDER[task.tag],
                  opacity:         task.isActive ? 1 : 0.45,
                }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate" style={{ color: 'var(--color-ink)' }}>{task.text}</p>
                    <span className={`tag-chip-${task.tag} text-[11px] font-medium px-1.5 py-0.5 rounded`}>
                      {task.tag}
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded"
                          style={task.size === 'big'
                            ? { background: 'rgba(239,68,68,0.12)', color: '#f87171' }
                            : { background: 'var(--color-raised)', color: 'var(--color-muted)' }}>
                      {task.size}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{freqLabel(task)}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-semibold" style={{ color: '#f59e0b' }}>🔥 {task.streak}</span>
                    <span className="text-xs" style={{ color: 'var(--color-muted)' }}>best: {task.bestStreak}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActive(task)}
                    className="text-xs px-3 py-1 rounded-full font-medium transition-colors"
                    style={task.isActive
                      ? { background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }
                      : { background: 'var(--color-raised)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}>
                    {task.isActive ? 'Active' : 'Paused'}
                  </button>
                  <button onClick={() => setDeleteTarget(task)}
                    className="text-lg px-1 transition-colors"
                    style={{ color: 'var(--color-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = '#ef4444'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-muted)'}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
