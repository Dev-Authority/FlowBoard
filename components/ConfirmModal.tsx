'use client';

interface Props {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title, message, detail, confirmLabel = 'Delete', danger = true, onConfirm, onCancel,
}: Props) {
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
          <p
            className="text-[11px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: danger ? '#ef4444' : 'var(--color-muted)' }}
          >
            {title}
          </p>
          <p className="text-sm font-medium leading-snug mb-2" style={{ color: 'var(--color-ink)' }}>
            &ldquo;{message}&rdquo;
          </p>
          {detail && (
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>{detail}</p>
          )}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: danger ? 'rgba(239,68,68,0.15)' : 'var(--color-raised)',
              color: danger ? '#f87171' : 'var(--color-ink)',
              border: danger ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--color-line)',
            }}
            onMouseEnter={(e) => { (e.currentTarget).style.opacity = '0.8'; }}
            onMouseLeave={(e) => { (e.currentTarget).style.opacity = '1'; }}
          >
            {confirmLabel}
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
