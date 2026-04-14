'use client';
import { Task } from '@/lib/types';

const TAG_COLOR: Record<string, string> = {
  work: '#3b82f6', learning: '#8b5cf6', personal: '#ec4899', health: '#10b981',
};

interface Props {
  task: Task;
  daysSince: number;
  onDoItNow: () => void;
  onDismiss: () => void;
}

export default function EatTheFrogModal({ task, daysSince, onDoItNow, onDismiss }: Props) {
  const accentColor = TAG_COLOR[task.tag] ?? '#6b7280';

  let headline: string;
  let subline: string;
  if (task.postponeCount >= 5) {
    headline = `You've postponed this ${task.postponeCount} times. That's not a task — it's a pattern.`;
    subline   = 'Do it now or delete it. No more hiding.';
  } else if (task.postponeCount > 0) {
    headline = `You've been avoiding this for ${daysSince > 0 ? `${daysSince} day${daysSince !== 1 ? 's' : ''}` : `${task.postponeCount} round${task.postponeCount !== 1 ? 's' : ''}`}.`;
    subline   = 'Do it first. Everything else can wait.';
  } else {
    headline = `This big task has been sitting for ${daysSince} day${daysSince !== 1 ? 's' : ''}.`;
    subline   = 'Start with the hard thing. Today is the day.';
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid rgba(239,68,68,0.35)',
          boxShadow: '0 0 60px rgba(239,68,68,0.12), 0 24px 48px rgba(0,0,0,0.4)',
        }}
      >
        {/* Red top stripe */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #ef4444, #f97316)' }} />

        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">🐸</span>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#ef4444' }}>
              Eat the frog
            </p>
          </div>

          {/* Task */}
          <p className="text-lg font-semibold leading-snug mb-3" style={{ color: 'var(--color-ink)' }}>
            {task.text}
          </p>

          {/* Tags */}
          <div className="flex items-center gap-2 mb-5">
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded"
              style={{ background: `${accentColor}20`, color: accentColor }}
            >
              {task.tag}
            </span>
            <span
              className="text-[11px] px-2 py-0.5 rounded"
              style={{ background: 'var(--color-raised)', color: 'var(--color-muted)' }}
            >
              {task.size}
            </span>
            {task.postponeCount > 0 && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
              >
                {task.postponeCount}× postponed
              </span>
            )}
          </div>

          {/* Hard message */}
          <div
            className="rounded-xl px-4 py-3 mb-5"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}
          >
            <p className="text-sm font-semibold mb-0.5" style={{ color: '#f87171' }}>{headline}</p>
            <p className="text-xs" style={{ color: 'rgba(248,113,113,0.65)' }}>{subline}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onDoItNow}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: 'rgba(239,68,68,0.15)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.35)',
              }}
              onMouseEnter={(e) => { (e.currentTarget).style.background = 'rgba(239,68,68,0.28)'; }}
              onMouseLeave={(e) => { (e.currentTarget).style.background = 'rgba(239,68,68,0.15)'; }}
            >
              Do it now →
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{ color: 'var(--color-muted)' }}
              onMouseEnter={(e) => { (e.currentTarget).style.color = 'var(--color-ink)'; }}
              onMouseLeave={(e) => { (e.currentTarget).style.color = 'var(--color-muted)'; }}
            >
              I&apos;ll deal with it later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
