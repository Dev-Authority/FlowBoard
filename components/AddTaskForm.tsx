'use client';
import { useState, useEffect, useRef } from 'react';
import { TaskSize, TaskTag } from '@/lib/types';

interface Props {
  onAdd: (data: { text: string; size: TaskSize; tag: TaskTag; estimatedMinutes?: number }) => void;
  // Optional controlled mode (for keyboard shortcut N on board)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TAGS: { value: TaskTag; color: string }[] = [
  { value: 'work',     color: '#3b82f6' },
  { value: 'learning', color: '#8b5cf6' },
  { value: 'personal', color: '#ec4899' },
  { value: 'health',   color: '#10b981' },
];

export default function AddTaskForm({ onAdd, open: controlledOpen, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen  = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  const [text,      setText]      = useState('');
  const [size,      setSize]      = useState<TaskSize>('small');
  const [tag,       setTag]       = useState<TaskTag>('work');
  const [estimated, setEstimated] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened via keyboard shortcut
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd({ text: text.trim(), size, tag, estimatedMinutes: estimated ? parseInt(estimated) : undefined });
    setText('');
    setEstimated('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setText(''); }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all"
        style={{ background: 'var(--color-raised)', color: 'var(--color-muted)', border: '1px dashed var(--color-line)' }}
      >
        <span className="text-base leading-none">+</span>
        <span>Add a task</span>
        <span className="ml-auto text-[11px] opacity-50">N</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-accent)', boxShadow: '0 0 0 3px rgba(59,130,246,0.08)' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder="What needs to be done?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full text-sm outline-none bg-transparent"
        style={{ color: 'var(--color-ink)' }}
      />
      <div className="h-px" style={{ background: 'var(--color-line)' }} />
      <div className="flex flex-wrap items-center gap-2">
        {/* Size */}
        <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--color-line)' }}>
          {(['small', 'big'] as TaskSize[]).map((s) => (
            <button key={s} type="button" onClick={() => setSize(s)}
              className="px-3 py-1 text-xs font-medium transition-all"
              style={size === s
                ? s === 'big' ? { background: 'rgba(239,68,68,0.15)', color: '#f87171' }
                               : { background: 'var(--color-raised)', color: 'var(--color-ink)' }
                : { color: 'var(--color-muted)', background: 'transparent' }}>
              {s === 'big' ? '▲ big' : '▸ small'}
            </button>
          ))}
        </div>
        {/* Tags */}
        <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--color-line)' }}>
          {TAGS.map(({ value, color }) => (
            <button key={value} type="button" onClick={() => setTag(value)}
              className="px-2.5 py-1 text-xs font-medium capitalize transition-all"
              style={tag === value
                ? { background: `${color}22`, color }
                : { color: 'var(--color-muted)', background: 'transparent' }}>
              {value}
            </button>
          ))}
        </div>
        <input
          type="number" min="1" placeholder="min?" value={estimated}
          onChange={(e) => setEstimated(e.target.value)}
          className="w-16 text-xs text-center rounded-md px-2 py-1 outline-none"
          style={{ background: 'var(--color-raised)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}
        />
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <button type="submit"
          className="text-sm font-medium px-4 py-1.5 rounded-md"
          style={{ background: 'var(--color-accent)', color: '#fff' }}>
          Add task
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="text-sm px-3" style={{ color: 'var(--color-muted)' }}>
          Cancel
        </button>
        <span className="ml-auto text-[11px]" style={{ color: 'var(--color-muted)' }}>Esc to close</span>
      </div>
    </form>
  );
}
