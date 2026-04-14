'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Task } from '@/lib/types';

const QUOTES = [
  "The secret of getting ahead is getting started.",
  "You don't have to be great to start, but you have to start to be great.",
  "Done is better than perfect.",
  "Ship it. Improve it. Ship it again.",
  "Every day you don't ship is a day your users wait.",
  "The best time to start was yesterday. The second best time is now.",
  "Discipline equals freedom.",
  "Motivation gets you going. Discipline keeps you growing.",
  "You will never feel like it. Do it anyway.",
  "Stop waiting. Start doing.",
  "The pain of discipline is far less than the pain of regret.",
  "One task done is worth ten tasks planned.",
  "Your future self is watching you right now through memories.",
  "Procrastination is the thief of time.",
  "Small consistent effort beats occasional bursts of motivation.",
  "Clarity comes from engagement, not thought.",
  "The resistance is always loudest just before you start.",
  "Someday is not a day of the week.",
  "Execution separates dreamers from achievers.",
  "Fear is temporary. Regret is permanent.",
  "If not now, when?",
  "The task you avoid most is the task you need most.",
  "Start before you're ready. Refine as you go.",
];

function getTodayQuote(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return QUOTES[dayOfYear % QUOTES.length];
}

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// SVG progress ring
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r       = 48;
  const circ    = 2 * Math.PI * r;
  const pct     = total > 0 ? Math.min(done / total, 1) : 0;
  const offset  = circ * (1 - pct);
  const color   = pct >= 1 ? '#10b981' : pct >= 0.5 ? '#3b82f6' : '#f59e0b';

  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
      />
      <text x="60" y="55" textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="monospace">
        {done}
      </text>
      <text x="60" y="74" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="11" fontFamily="monospace">
        of {total}
      </text>
    </svg>
  );
}

const TAG_COLOR: Record<string, string> = {
  work: '#3b82f6', learning: '#8b5cf6', personal: '#ec4899', health: '#10b981',
};

export default function DisplayPage() {
  const [tasks,         setTasks]         = useState<Task[]>([]);
  const [streak,        setStreak]        = useState(0);
  const [now,           setNow]           = useState(new Date());
  const [captureOpen,   setCaptureOpen]   = useState(false);
  const [captureText,   setCaptureText]   = useState('');
  const [captureSaving, setCaptureSaving] = useState(false);
  const captureRef = useRef<HTMLInputElement>(null);
  const today = getTodayString();

  const fetchData = useCallback(async () => {
    const [tRes, sRes] = await Promise.all([
      fetch(`/api/tasks?date=${today}`),
      fetch('/api/stats/summary'),
    ]);
    const [tData, sData] = await Promise.all([tRes.json(), sRes.json()]);
    if (Array.isArray(tData)) setTasks(tData);
    setStreak(sData.currentStreak ?? 0);
  }, [today]);

  useEffect(() => {
    fetchData();
    const di = setInterval(fetchData, 30000);
    const ci = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(di); clearInterval(ci); };
  }, [fetchData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' && !captureOpen) {
        e.preventDefault();
        setCaptureOpen(true);
        setTimeout(() => captureRef.current?.focus(), 50);
      } else if (e.key === 'Escape' && captureOpen) {
        setCaptureOpen(false);
        setCaptureText('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [captureOpen]);

  const handleCapture = async () => {
    if (!captureText.trim() || captureSaving) return;
    setCaptureSaving(true);
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: captureText.trim(), size: 'small', tag: 'work', date: today }),
    }).catch(() => {});
    setCaptureSaving(false);
    setCaptureText('');
    setCaptureOpen(false);
    fetchData();
  };

  const doingTask     = tasks.find((t) => t.status === 'doing');
  const todoTasks     = tasks.filter((t) => t.status === 'todo').slice(0, 5);
  const doneTasks     = tasks.filter((t) => t.status === 'done');
  const zombieTasks   = tasks.filter((t) => t.postponeCount >= 3 && t.status !== 'done');
  const zombie        = zombieTasks[0];
  const total         = tasks.length;

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none flex flex-col"
      style={{
        background: 'radial-gradient(ellipse at 20% 50%, #0d1117 0%, #060810 60%, #020307 100%)',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ── Quick-capture overlay ────────────────────────────── */}
      {captureOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-xl px-6">
            <p className="text-center text-xs tracking-widest uppercase mb-4"
               style={{ color: 'rgba(255,255,255,0.3)' }}>
              Quick capture — Enter to save · Esc to cancel
            </p>
            <input
              ref={captureRef}
              type="text"
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCapture();
                if (e.key === 'Escape') { setCaptureOpen(false); setCaptureText(''); }
              }}
              placeholder="What needs to be captured?"
              className="w-full outline-none rounded-2xl px-6 py-5 text-2xl font-medium"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(59,130,246,0.5)',
                boxShadow: '0 0 0 4px rgba(59,130,246,0.1), 0 0 40px rgba(59,130,246,0.15)',
                color: '#fff',
              }}
            />
            {captureSaving && (
              <p className="text-center text-sm mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Saving…
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Top bar: clock + streak + progress ──────────────── */}
      <div className="flex items-center justify-between px-10 pt-8 pb-6 shrink-0">

        {/* Clock + date */}
        <div>
          <div className="font-mono tabular-nums leading-none"
               style={{ fontSize: '4.5rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            {formatTime(now)}
          </div>
          <div className="mt-1 text-base" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {formatDate(now)}
          </div>
        </div>

        {/* Streak + progress ring */}
        <div className="flex items-center gap-8">
          {/* Streak */}
          <div className="text-center">
            <div className="text-4xl leading-none">🔥</div>
            <div className="mt-1 font-bold tabular-nums text-3xl" style={{ color: '#fb923c' }}>
              {streak}
            </div>
            <div className="text-xs tracking-widest uppercase mt-0.5"
                 style={{ color: 'rgba(255,255,255,0.3)' }}>
              day streak
            </div>
          </div>

          {/* Progress ring */}
          <div className="flex flex-col items-center gap-1">
            <ProgressRing done={doneTasks.length} total={total} />
            <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>
              today
            </p>
          </div>
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────── */}
      <div className="mx-10 shrink-0" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* ── Main content ────────────────────────────────────── */}
      <div className="flex-1 flex gap-8 px-10 py-6 min-h-0">

        {/* Left: in-progress hero + next up */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">

          {/* IN PROGRESS */}
          <div>
            <p className="text-[11px] font-semibold tracking-widest uppercase mb-3"
               style={{ color: 'rgba(255,255,255,0.3)' }}>
              Now working on
            </p>
            {doingTask ? (
              <div className="rounded-2xl px-6 py-5"
                   style={{
                     background: 'rgba(59,130,246,0.08)',
                     border: '1px solid rgba(59,130,246,0.3)',
                     boxShadow: '0 0 40px rgba(59,130,246,0.12)',
                   }}>
                <div className="flex items-start gap-4">
                  <span className="mt-1 text-2xl shrink-0">⚡</span>
                  <div className="min-w-0">
                    <p className="text-2xl font-semibold leading-snug" style={{ color: '#93c5fd' }}>
                      {doingTask.text}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: `${TAG_COLOR[doingTask.tag]}22`, color: TAG_COLOR[doingTask.tag] }}>
                        {doingTask.tag}
                      </span>
                      {doingTask.estimatedMinutes && (
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          ~{doingTask.estimatedMinutes}m estimated
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: '#60a5fa' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                        in progress
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl px-6 py-5"
                   style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                <p className="text-xl" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Nothing in progress. Start something.
                </p>
              </div>
            )}
          </div>

          {/* NEXT UP */}
          {todoTasks.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase mb-3"
                 style={{ color: 'rgba(255,255,255,0.3)' }}>
                Next up
              </p>
              <div className="space-y-2">
                {todoTasks.map((task, i) => (
                  <div key={task._id}
                       className="flex items-center gap-4 px-5 py-3 rounded-xl"
                       style={{
                         background: 'rgba(255,255,255,0.03)',
                         border: '1px solid rgba(255,255,255,0.06)',
                         opacity: 1 - i * 0.12,
                       }}>
                    <span className="text-lg shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }}>○</span>
                    <p className="text-base flex-1 min-w-0 truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      {task.text}
                    </p>
                    <span className="text-xs shrink-0 px-2 py-0.5 rounded-full"
                          style={{ background: `${TAG_COLOR[task.tag]}15`, color: TAG_COLOR[task.tag] }}>
                      {task.tag}
                    </span>
                    {task.size === 'big' && (
                      <span className="text-xs shrink-0" style={{ color: 'rgba(248,113,113,0.7)' }}>▲</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DONE TODAY */}
          {doneTasks.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase mb-3"
                 style={{ color: 'rgba(255,255,255,0.3)' }}>
                Done today
              </p>
              <div className="space-y-1.5">
                {doneTasks.slice(0, 4).map((task) => (
                  <div key={task._id} className="flex items-center gap-3 px-4 py-2 rounded-lg"
                       style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.08)' }}>
                    <span className="text-sm" style={{ color: '#10b981' }}>✓</span>
                    <p className="text-sm line-through" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {task.text}
                    </p>
                  </div>
                ))}
                {doneTasks.length > 4 && (
                  <p className="text-xs px-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    +{doneTasks.length - 4} more done
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: zombie + big tasks overview */}
        <div className="w-72 shrink-0 flex flex-col gap-5">

          {/* Big tasks status */}
          {tasks.filter((t) => t.size === 'big').length > 0 && (
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase mb-3"
                 style={{ color: 'rgba(255,255,255,0.3)' }}>
                Big tasks
              </p>
              <div className="space-y-2">
                {tasks.filter((t) => t.size === 'big').map((task) => (
                  <div key={task._id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                       style={{
                         background: task.status === 'done'
                           ? 'rgba(16,185,129,0.06)'
                           : task.status === 'doing'
                           ? 'rgba(59,130,246,0.08)'
                           : 'rgba(255,255,255,0.03)',
                         border: task.status === 'done'
                           ? '1px solid rgba(16,185,129,0.15)'
                           : task.status === 'doing'
                           ? '1px solid rgba(59,130,246,0.2)'
                           : '1px solid rgba(255,255,255,0.06)',
                       }}>
                    <span className="text-base shrink-0">
                      {task.status === 'done' ? '✓' : task.status === 'doing' ? '⚡' : '▲'}
                    </span>
                    <p className="text-sm leading-snug min-w-0"
                       style={{
                         color: task.status === 'done' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
                         textDecoration: task.status === 'done' ? 'line-through' : 'none',
                       }}>
                      {task.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zombie spotlight */}
          {zombie && (
            <div className="rounded-2xl px-5 py-4"
                 style={{
                   background: 'rgba(120,53,15,0.25)',
                   border: '1px solid rgba(217,119,6,0.35)',
                   boxShadow: '0 0 30px rgba(217,119,6,0.08)',
                 }}>
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-2"
                 style={{ color: 'rgba(251,191,36,0.6)' }}>
                🧟 Zombie · {Math.floor((Date.now() - new Date(zombie.createdAt).getTime()) / 86400000)}d old
              </p>
              <p className="text-base font-semibold leading-snug" style={{ color: '#fde68a' }}>
                {zombie.text}
              </p>
              <p className="text-xs mt-2" style={{ color: 'rgba(251,191,36,0.45)' }}>
                Postponed {zombie.postponeCount}× — deal with it.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom bar: quote + hint ─────────────────────────── */}
      <div className="shrink-0 px-10 pb-6 pt-4 flex items-center justify-between gap-6"
           style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-sm italic flex-1 min-w-0 truncate"
           style={{ color: 'rgba(255,255,255,0.2)' }}>
          &ldquo;{getTodayQuote()}&rdquo;
        </p>
        <p className="text-xs shrink-0 px-3 py-1 rounded-lg"
           style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.06)' }}>
          Space · capture
        </p>
      </div>
    </div>
  );
}
