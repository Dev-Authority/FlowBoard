'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Task } from '@/lib/types';

interface Cmd {
  id:          string;
  label:       string;
  description?: string;
  icon:        string;
  category:    'page' | 'action' | 'task';
  action:      () => void;
}

const TAG_COLOR: Record<string, string> = {
  work: '#3b82f6', learning: '#8b5cf6', personal: '#ec4899', health: '#10b981',
};
const STATUS_ICON: Record<string, string> = {
  todo: '○', doing: '⚡', done: '✓', postponed: '⏸',
};

export default function CommandPalette() {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [cursor,  setCursor]  = useState(0);
  const [tasks,   setTasks]   = useState<Task[]>([]);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  // Today string (local)
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const closeAndRun = useCallback((fn: () => void) => {
    setOpen(false);
    setQuery('');
    setCursor(0);
    fn();
  }, []);

  // Static commands
  const PAGES: Cmd[] = [
    { id: 'board',     label: 'Board',           icon: '📋', category: 'page',   action: () => closeAndRun(() => router.push('/')) },
    { id: 'calendar',  label: 'Calendar',         icon: '📅', category: 'page',   action: () => closeAndRun(() => router.push('/calendar')) },
    { id: 'stats',     label: 'Statistics',       icon: '📊', category: 'page',   action: () => closeAndRun(() => router.push('/stats')) },
    { id: 'plan',      label: 'Plan',             icon: '🗂',  category: 'page',   action: () => closeAndRun(() => router.push('/plan')) },
    { id: 'review',    label: 'Review',           icon: '📝', category: 'page',   action: () => closeAndRun(() => router.push('/review')) },
    { id: 'recurring', label: 'Recurring Tasks',  icon: '↻',  category: 'page',   action: () => closeAndRun(() => router.push('/recurring')) },
    { id: 'display',   label: 'Display Mode',     icon: '🖥',  category: 'page',   action: () => closeAndRun(() => router.push('/display')) },
  ];

  const ACTIONS: Cmd[] = [
    {
      id: 'add', label: 'Add task', description: 'Open add task form on board', icon: '+', category: 'action',
      action: () => closeAndRun(() => {
        router.push('/');
        setTimeout(() => window.dispatchEvent(new CustomEvent('flowboard:openaddform')), 100);
      }),
    },
    {
      id: 'focus', label: 'Start focus mode', description: 'Focus on in-progress task', icon: '⚡', category: 'action',
      action: () => closeAndRun(() => {
        router.push('/');
        setTimeout(() => window.dispatchEvent(new CustomEvent('flowboard:startfocus')), 100);
      }),
    },
    {
      id: 'export', label: 'Export CSV', description: 'Download all tasks as CSV', icon: '↓', category: 'action',
      action: () => closeAndRun(() => { window.location.href = '/api/export'; }),
    },
    {
      id: 'display-go', label: 'Enter display mode', icon: '🖥', category: 'action',
      action: () => closeAndRun(() => router.push('/display')),
    },
  ];

  // Task commands from today's tasks
  const taskCmds: Cmd[] = tasks
    .filter((t) => !query || t.text.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6)
    .map((t) => ({
      id:          `task-${t._id}`,
      label:       t.text,
      description: `${t.status} · ${t.tag}`,
      icon:        STATUS_ICON[t.status] ?? '○',
      category:    'task' as const,
      action:      () => closeAndRun(() => {
        router.push('/');
        if (t.status === 'doing') {
          setTimeout(() => window.dispatchEvent(new CustomEvent('flowboard:startfocus')), 100);
        }
      }),
    }));

  // Filter static commands
  const q = query.toLowerCase();
  const filtered: Cmd[] = [
    ...(q ? PAGES.filter((c) => c.label.toLowerCase().includes(q)) : PAGES),
    ...(q ? ACTIONS.filter((c) => c.label.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q)) : ACTIONS),
    ...(taskCmds),
  ];

  // Open / close via Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        if (!open) { setQuery(''); setCursor(0); }
      }
      if (e.key === 'Escape' && open) { setOpen(false); setQuery(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      // Load today's tasks for search
      fetch(`/api/tasks?date=${todayStr()}`)
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d)) setTasks(d); })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Arrow key navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      if (e.key === 'Enter' && filtered[cursor]) { filtered[cursor].action(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, cursor, filtered]);

  // Scroll cursor into view
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  // Reset cursor when query changes
  useEffect(() => { setCursor(0); }, [query]);

  if (!open) return null;

  const grouped = {
    page:   filtered.filter((c) => c.category === 'page'),
    action: filtered.filter((c) => c.category === 'action'),
    task:   filtered.filter((c) => c.category === 'task'),
  };

  let globalIdx = 0;

  const renderGroup = (label: string, items: Cmd[]) => {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <p className="text-[10px] font-semibold uppercase tracking-widest px-3 pt-2 pb-1"
           style={{ color: 'var(--color-muted)' }}>
          {label}
        </p>
        {items.map((cmd) => {
          const idx = globalIdx++;
          const active = idx === cursor;
          return (
            <button key={cmd.id} onMouseEnter={() => setCursor(idx)} onClick={cmd.action}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-all"
              style={{
                background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: 'var(--color-ink)',
              }}>
              <span className="w-6 text-center text-sm shrink-0"
                    style={{ color: cmd.category === 'task' ? TAG_COLOR[(tasks.find(t=>`task-${t._id}`===cmd.id)?.tag??'')] ?? 'var(--color-muted)' : 'var(--color-muted)' }}>
                {cmd.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-medium">{cmd.label}</span>
                {cmd.description && (
                  <span className="ml-2 text-xs" style={{ color: 'var(--color-muted)' }}>{cmd.description}</span>
                )}
              </span>
              {active && (
                <span className="text-xs shrink-0 px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--color-raised)', color: 'var(--color-muted)' }}>
                  ↵
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
         style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
         onClick={() => { setOpen(false); setQuery(''); }}>
      <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl"
           style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}
           onClick={(e) => e.stopPropagation()}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3"
             style={{ borderBottom: '1px solid var(--color-line)' }}>
          <span style={{ color: 'var(--color-muted)' }}>⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions, tasks…"
            className="flex-1 outline-none bg-transparent text-sm"
            style={{ color: 'var(--color-ink)' }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded"
               style={{ background: 'var(--color-raised)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="p-2 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--color-muted)' }}>
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <>
              {renderGroup('Pages',   grouped.page)}
              {renderGroup('Actions', grouped.action)}
              {renderGroup('Tasks',   grouped.task)}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2"
             style={{ borderTop: '1px solid var(--color-line)' }}>
          {[['↑↓', 'navigate'], ['↵', 'select'], ['Esc', 'close']].map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <kbd className="text-[10px] px-1.5 py-0.5 rounded"
                   style={{ background: 'var(--color-raised)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}>
                {key}
              </kbd>
              <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
