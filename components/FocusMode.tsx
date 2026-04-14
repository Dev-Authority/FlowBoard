'use client';
import { useState, useEffect, useCallback } from 'react';
import { Task } from '@/lib/types';

interface Props {
  task: Task;
  onClose: () => void;
  onDone: () => void;
}

function fmt(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pastSeconds(task: Task): number {
  return (task.timerSessions ?? []).reduce((sum, s) => {
    if (s.end) return sum + Math.round((new Date(s.end).getTime() - new Date(s.start).getTime()) / 1000);
    return sum + Math.round((Date.now() - new Date(s.start).getTime()) / 1000);
  }, 0);
}

const HINTS = [
  { after: 0,    text: 'Just getting started…' },
  { after: 60,   text: "You're in it. Keep going." },
  { after: 600,  text: 'Good momentum. Stay focused.' },
  { after: 1200, text: 'Deep work. This is rare.' },
  { after: 2700, text: 'Exceptional. You shipped today.' },
];

const POMO_WORK  = 25 * 60; // 25 min
const POMO_BREAK = 5  * 60; // 5 min

type PomoPhase = 'work' | 'break';

export default function FocusMode({ task, onClose, onDone }: Props) {
  const [elapsed,   setElapsed]   = useState(() => pastSeconds(task));
  const [isPaused,  setIsPaused]  = useState(false);
  const [saving,    setSaving]    = useState(false);

  // Pomodoro
  const [pomoOn,    setPomoOn]    = useState(false);
  const [pomoPhase, setPomoPhase] = useState<PomoPhase>('work');
  const [pomoLeft,  setPomoLeft]  = useState(POMO_WORK);
  const [pomoCount, setPomoCount] = useState(0);
  const [pomoAlert, setPomoAlert] = useState<string | null>(null);

  // Elapsed task timer
  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  // Pomodoro countdown (independent of pause — pomodoro runs even when task is paused)
  useEffect(() => {
    if (!pomoOn) return;
    const id = setInterval(() => {
      setPomoLeft((prev) => {
        if (prev <= 1) {
          // Phase transition
          if (pomoPhase === 'work') {
            setPomoCount((c) => c + 1);
            setPomoPhase('break');
            setPomoAlert('🍅 Pomodoro done! Take a 5-minute break.');
            return POMO_BREAK;
          } else {
            setPomoPhase('work');
            setPomoAlert('⏰ Break over. Ready to focus again?');
            return POMO_WORK;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomoOn, pomoPhase]);

  // Dismiss pomodoro alert after 5s
  useEffect(() => {
    if (!pomoAlert) return;
    // Browser notification if permission granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('FlowBoard', { body: pomoAlert, icon: '/favicon.ico' });
    }
    const t = setTimeout(() => setPomoAlert(null), 5000);
    return () => clearTimeout(t);
  }, [pomoAlert]);

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const callTimer = useCallback(async (action: 'pause' | 'resume') => {
    setSaving(true);
    await fetch(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timerAction: action }),
    }).catch(() => {});
    setSaving(false);
  }, [task._id]);

  const handlePause  = async () => { setIsPaused(true);  await callTimer('pause'); };
  const handleResume = async () => { setIsPaused(false); await callTimer('resume'); };

  const togglePomo = () => {
    setPomoOn((v) => !v);
    setPomoPhase('work');
    setPomoLeft(POMO_WORK);
    setPomoAlert(null);
  };

  const skipPomoPhase = () => {
    if (pomoPhase === 'work') {
      setPomoCount((c) => c + 1);
      setPomoPhase('break');
      setPomoLeft(POMO_BREAK);
    } else {
      setPomoPhase('work');
      setPomoLeft(POMO_WORK);
    }
    setPomoAlert(null);
  };

  const hint = [...HINTS].reverse().find((h) => elapsed >= h.after)?.text ?? '';

  const isBreak     = pomoOn && pomoPhase === 'break';
  const timerColor  = isPaused ? 'var(--color-muted)' : isBreak ? '#10b981' : '#3b82f6';
  const timerBg     = isPaused ? 'var(--color-raised)' : isBreak ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)';
  const timerBorder = isPaused ? 'var(--color-line)' : isBreak ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)';

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50 p-8"
         style={{ background: 'var(--color-canvas)' }}>

      {/* Close */}
      <button onClick={onClose}
        className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-lg text-xl"
        style={{ color: 'var(--color-muted)', background: 'var(--color-raised)', border: '1px solid var(--color-line)' }}>
        ×
      </button>

      {/* Status label */}
      <p className="text-xs font-semibold uppercase tracking-widest mb-8"
         style={{ color: 'var(--color-muted)' }}>
        {isPaused ? '⏸ Paused' : isBreak ? '☕ Break time' : '● Focus mode'}
      </p>

      {/* Task title */}
      <h1 className="text-3xl md:text-5xl font-bold text-center max-w-3xl leading-tight mb-10"
          style={{ color: 'var(--color-ink)' }}>
        {task.text}
      </h1>

      {/* Task elapsed timer */}
      <div className="text-6xl font-mono tabular-nums mb-2 px-8 py-4 rounded-2xl"
           style={{ color: timerColor, background: timerBg, border: `1px solid ${timerBorder}` }}>
        {fmt(elapsed)}
      </div>

      <p className="text-xs mb-6" style={{ color: 'var(--color-muted)' }}>{hint}</p>

      {/* Pomodoro section */}
      {pomoOn && (
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl"
               style={{
                 background: isBreak ? 'rgba(16,185,129,0.08)' : 'rgba(139,92,246,0.08)',
                 border: `1px solid ${isBreak ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.2)'}`,
               }}>
            <span className="text-lg">{isBreak ? '☕' : '🍅'}</span>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                 style={{ color: isBreak ? '#34d399' : '#a78bfa' }}>
                {isBreak ? 'Break' : 'Pomodoro'}
              </p>
              <p className="text-3xl font-mono tabular-nums font-bold"
                 style={{ color: isBreak ? '#34d399' : '#a78bfa' }}>
                {fmt(pomoLeft)}
              </p>
            </div>
            <button onClick={skipPomoPhase}
              className="text-xs px-2 py-1 rounded-lg ml-2"
              style={{ color: 'var(--color-muted)', background: 'var(--color-raised)', border: '1px solid var(--color-line)' }}>
              Skip →
            </button>
          </div>
          {/* Pomodoro count */}
          {pomoCount > 0 && (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              {'🍅'.repeat(Math.min(pomoCount, 8))}
              {pomoCount > 8 && ` ×${pomoCount}`}
            </p>
          )}
        </div>
      )}

      {/* Pomodoro alert toast */}
      {pomoAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium z-50"
             style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', color: 'var(--color-ink)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {pomoAlert}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap justify-center">
        <button onClick={onDone}
          className="text-base font-semibold px-8 py-3 rounded-xl"
          style={{ background: '#10b981', color: '#fff' }}>
          Mark Done ✓
        </button>

        {isPaused ? (
          <button onClick={handleResume} disabled={saving}
            className="text-base font-medium px-6 py-3 rounded-xl disabled:opacity-50"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
            ▶ Resume
          </button>
        ) : (
          <button onClick={handlePause} disabled={saving}
            className="text-base font-medium px-6 py-3 rounded-xl disabled:opacity-50"
            style={{ background: 'var(--color-surface)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}>
            ⏸ Pause
          </button>
        )}

        <button onClick={togglePomo}
          className="text-base font-medium px-6 py-3 rounded-xl"
          style={pomoOn
            ? { background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }
            : { background: 'var(--color-raised)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}>
          🍅 {pomoOn ? 'Pomodoro on' : 'Pomodoro'}
        </button>

        <button onClick={onClose}
          className="text-base font-medium px-6 py-3 rounded-xl"
          style={{ background: 'var(--color-raised)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}>
          Take a break
        </button>
      </div>
    </div>
  );
}
