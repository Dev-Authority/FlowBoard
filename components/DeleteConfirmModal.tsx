'use client';
import { Task } from '@/lib/types';

interface Props {
  task: Task;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ task, onConfirm, onCancel }: Props) {
  const isZombie = task.postponeCount >= 3;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3"
             style={{ color: isZombie ? '#f59e0b' : '#ef4444' }}>
            {isZombie ? '☠ Abandon zombie task' : 'Delete task'}
          </p>

          <p className="text-sm font-medium leading-snug mb-2" style={{ color: 'var(--color-ink)' }}>
            &ldquo;{task.text}&rdquo;
          </p>

          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {isZombie
              ? `Postponed ${task.postponeCount} times. This will be counted as abandoned in your stats.`
              : 'This cannot be undone.'}
          </p>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: isZombie ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
              color: isZombie ? '#f59e0b' : '#f87171',
              border: `1px solid ${isZombie ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget).style.opacity = '0.8'; }}
            onMouseLeave={(e) => { (e.currentTarget).style.opacity = '1'; }}
          >
            {isZombie ? '☠ Yes, abandon it' : 'Delete'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm transition-all"
            style={{
              background: 'var(--color-raised)',
              color: 'var(--color-muted)',
              border: '1px solid var(--color-line)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
