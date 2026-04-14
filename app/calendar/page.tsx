'use client';
import { useState, useEffect, useCallback } from 'react';
import { Task } from '@/lib/types';

const TAG_COLOR: Record<string, string> = {
  work: '#3b82f6', learning: '#8b5cf6', personal: '#ec4899', health: '#10b981',
};
const STATUS_COLOR: Record<string, string> = {
  done: '#10b981', doing: '#3b82f6', postponed: '#f59e0b', todo: '#6b7280',
};
const DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Local date string — avoids UTC offset timezone bugs
function localStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function todayStr(): string { return localStr(new Date()); }

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return days;
}

export default function CalendarPage() {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selected,  setSelected]  = useState<string>(todayStr());

  // Month tasks (for calendar grid)
  const [monthTasks, setMonthTasks] = useState<Task[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Range mode
  const [rangeFrom,     setRangeFrom]     = useState('');
  const [rangeTo,       setRangeTo]       = useState('');
  const [rangeTasks,    setRangeTasks]    = useState<Task[]>([]);
  const [rangeMode,     setRangeMode]     = useState(false);
  const [rangeLoading,  setRangeLoading]  = useState(false);
  const [rangeDayFilter, setRangeDayFilter] = useState<string | null>(null); // null = show all

  const monthStart = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-01`;
  const monthEnd   = localStr(new Date(viewYear, viewMonth+1, 0));

  const fetchMonth = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/tasks?from=${monthStart}&to=${monthEnd}`);
    const data = await res.json();
    setMonthTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [monthStart, monthEnd]);

  useEffect(() => { fetchMonth(); }, [fetchMonth]);

  const handleRangeSearch = async () => {
    if (!rangeFrom || !rangeTo || rangeFrom > rangeTo) return;
    setRangeLoading(true);
    const res  = await fetch(`/api/tasks?from=${rangeFrom}&to=${rangeTo}`);
    const data = await res.json();
    setRangeTasks(Array.isArray(data) ? data : []);
    setRangeMode(true);
    setRangeDayFilter(null); // reset to show all
    setRangeLoading(false);
  };

  const clearRange = () => {
    setRangeMode(false);
    setRangeFrom('');
    setRangeTo('');
    setRangeTasks([]);
    setRangeDayFilter(null);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y-1); }
    else setViewMonth((m) => m-1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y+1); }
    else setViewMonth((m) => m+1);
  };

  // Calendar grid data: in range mode, use rangeTasks for this month; otherwise monthTasks
  const gridSource = rangeMode
    ? rangeTasks.filter((t) => t.date >= monthStart && t.date <= monthEnd)
    : monthTasks;

  const byDate: Record<string, Task[]> = {};
  for (const t of gridSource) {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  }

  const days          = getMonthDays(viewYear, viewMonth);
  const leadingBlanks = new Date(viewYear, viewMonth, 1).getDay();
  const today         = todayStr();

  // Handle day click
  const handleDayClick = (dateStr: string) => {
    if (rangeMode) {
      // Toggle filter: clicking same day again shows all
      setRangeDayFilter((prev) => prev === dateStr ? null : dateStr);
    } else {
      setSelected(dateStr);
    }
  };

  // Panel content
  const panelTasks = rangeMode
    ? (rangeDayFilter ? rangeTasks.filter((t) => t.date === rangeDayFilter) : rangeTasks)
    : (byDate[selected] ?? []);

  const panelDone  = panelTasks.filter((t) => t.status === 'done').length;
  const panelTitle = rangeMode
    ? rangeDayFilter
      ? new Date(rangeDayFilter + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : `${rangeFrom} → ${rangeTo}`
    : new Date(selected + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Group tasks by date (for range panel)
  const rangeGrouped = panelTasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (!acc[t.date]) acc[t.date] = [];
    acc[t.date].push(t);
    return acc;
  }, {});
  const rangeGroupedEntries = Object.entries(rangeGrouped).sort(([a], [b]) => a.localeCompare(b));

  // Stats for range banner
  const rangeStats = rangeMode && !rangeDayFilter ? {
    total:    rangeTasks.length,
    done:     rangeTasks.filter((t) => t.status === 'done').length,
    days:     Object.keys(rangeTasks.reduce<Record<string,boolean>>((a,t) => { a[t.date]=true; return a; }, {})).length,
    zombies:  rangeTasks.filter((t) => t.postponeCount >= 3).length,
  } : null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-canvas)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-ink)' }}>Calendar</h1>

          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={rangeFrom} max={rangeTo || undefined}
              onChange={(e) => setRangeFrom(e.target.value)}
              className="text-xs rounded-lg px-2 py-1.5 outline-none"
              style={{ background: 'var(--color-raised)', color: 'var(--color-ink)', border: '1px solid var(--color-line)' }} />
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>to</span>
            <input type="date" value={rangeTo} min={rangeFrom || undefined}
              onChange={(e) => setRangeTo(e.target.value)}
              className="text-xs rounded-lg px-2 py-1.5 outline-none"
              style={{ background: 'var(--color-raised)', color: 'var(--color-ink)', border: '1px solid var(--color-line)' }} />
            <button onClick={handleRangeSearch}
              disabled={!rangeFrom || !rangeTo || rangeFrom > rangeTo || rangeLoading}
              className="text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-40"
              style={{ background: 'var(--color-accent)', color: '#fff' }}>
              {rangeLoading ? 'Loading…' : 'View range'}
            </button>
            {rangeMode && (
              <button onClick={clearRange}
                className="text-xs px-2.5 py-1.5 rounded-lg"
                style={{ background: 'var(--color-raised)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}>
                × Clear range
              </button>
            )}
          </div>
        </div>

        {/* ── Range summary banner ─────────────────────────── */}
        {rangeStats && (
          <div className="mb-4 px-4 py-3 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
            <Stat label="Tasks"     value={String(rangeStats.total)} />
            <Stat label="Completed" value={`${rangeStats.done} (${rangeStats.total > 0 ? Math.round(rangeStats.done/rangeStats.total*100) : 0}%)`} color="#10b981" />
            <Stat label="Active days" value={String(rangeStats.days)} />
            <Stat label="Zombies"   value={String(rangeStats.zombies)} color={rangeStats.zombies > 0 ? '#f59e0b' : undefined} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Month calendar ──────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--color-raised)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}>
                ‹
              </button>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                {MONTHS[viewMonth]} {viewYear}
                {rangeMode && (
                  <span className="ml-2 text-[10px] font-normal"
                        style={{ color: 'var(--color-muted)' }}>
                    showing range tasks
                  </span>
                )}
              </p>
              <button onClick={nextMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--color-raised)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}>
                ›
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {DOW.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-widest py-1"
                     style={{ color: 'var(--color-muted)' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            {loading && !rangeMode ? (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="rounded-lg animate-pulse"
                       style={{ height: 60, background: 'var(--color-raised)' }} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}

                {days.map((day) => {
                  const dateStr    = localStr(day);
                  const dayTasks   = byDate[dateStr] ?? [];
                  const total      = dayTasks.length;
                  const done       = dayTasks.filter((t) => t.status === 'done').length;
                  const isToday    = dateStr === today;
                  const isPast     = dateStr < today;
                  const isSelected = rangeMode
                    ? dateStr === rangeDayFilter
                    : dateStr === selected;
                  const inRange    = rangeMode && rangeFrom && rangeTo
                    ? dateStr >= rangeFrom && dateStr <= rangeTo
                    : false;

                  let dotColor = 'transparent';
                  if (total > 0) {
                    if (done === total)   dotColor = '#10b981';
                    else if (done > 0)    dotColor = '#f59e0b';
                    else                  dotColor = isPast ? '#ef4444' : '#6b7280';
                  }

                  const tags = Array.from(new Set(dayTasks.map((t) => t.tag)));

                  let bg = 'var(--color-surface)';
                  let border = '1px solid var(--color-line)';
                  if (isSelected) { bg = 'rgba(59,130,246,0.18)'; border = '1px solid rgba(59,130,246,0.5)'; }
                  else if (isToday) { bg = 'rgba(59,130,246,0.06)'; border = '1px solid rgba(59,130,246,0.25)'; }
                  else if (inRange && total > 0) { bg = 'rgba(59,130,246,0.04)'; border = '1px solid rgba(59,130,246,0.15)'; }

                  return (
                    <button key={dateStr} onClick={() => handleDayClick(dateStr)}
                      className="rounded-lg p-1.5 text-left flex flex-col transition-all"
                      style={{ minHeight: 60, background: bg, border }}>
                      <p className="text-xs font-semibold"
                         style={{ color: isToday ? '#60a5fa' : 'var(--color-ink)' }}>
                        {day.getDate()}
                      </p>
                      {total > 0 && (
                        <div className="mt-auto">
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
                            <span className="text-[10px] font-mono" style={{ color: 'var(--color-muted)' }}>
                              {done}/{total}
                            </span>
                          </div>
                          <div className="flex gap-0.5 mt-0.5">
                            {tags.slice(0, 4).map((tag) => (
                              <span key={tag} className="w-1 h-1 rounded-full"
                                    style={{ background: TAG_COLOR[tag] }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 mt-3 px-0.5">
              {[
                { color: '#10b981', label: 'All done' },
                { color: '#f59e0b', label: 'Partial' },
                { color: '#ef4444', label: 'Missed (past)' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{label}</span>
                </div>
              ))}
              {Object.entries(TAG_COLOR).map(([tag, color]) => (
                <div key={tag} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{tag}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Task panel ──────────────────────────────────── */}
          <div className="rounded-xl p-4 flex flex-col"
               style={{
                 background: 'var(--color-surface)',
                 border: '1px solid var(--color-line)',
                 minHeight: 300,
                 maxHeight: 'calc(100vh - 160px)',
               }}>
            {/* Panel header */}
            <div className="mb-3 shrink-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>{panelTitle}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {panelTasks.length > 0 && (
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {panelDone}/{panelTasks.length} done
                  </p>
                )}
                {/* In range mode with day filter: show "← All dates" link */}
                {rangeMode && rangeDayFilter && (
                  <button onClick={() => setRangeDayFilter(null)}
                    className="text-xs"
                    style={{ color: 'var(--color-accent)' }}>
                    ← All dates
                  </button>
                )}
                {/* In range mode without filter: show hint */}
                {rangeMode && !rangeDayFilter && (
                  <p className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                    Click a day to filter
                  </p>
                )}
              </div>
            </div>

            {panelTasks.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                {rangeMode
                  ? rangeDayFilter ? 'No tasks on this day in the range.' : 'No tasks in this range.'
                  : 'No tasks for this day.'}
              </p>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-1 pr-0.5">
                {/* Range mode: group by date (when showing all) */}
                {rangeMode && !rangeDayFilter ? (
                  rangeGroupedEntries.map(([date, dt]) => (
                    <div key={date}>
                      <button
                        onClick={() => setRangeDayFilter(date)}
                        className="w-full text-left text-[10px] font-semibold uppercase tracking-widest px-1 py-1.5 mt-1 rounded"
                        style={{ color: 'var(--color-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--color-raised)'}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        <span className="ml-1 font-normal normal-case tracking-normal">
                          ({dt.filter(t=>t.status==='done').length}/{dt.length})
                        </span>
                      </button>
                      <div className="space-y-1">
                        {dt.map((task) => <TaskRow key={task._id} task={task} />)}
                      </div>
                    </div>
                  ))
                ) : (
                  panelTasks.map((task) => <TaskRow key={task._id} task={task} />)
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold" style={{ color: color ?? 'var(--color-ink)' }}>{value}</p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-muted)' }}>{label}</p>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  return (
    <div className="rounded-lg px-2.5 py-2"
         style={{ background: 'var(--color-raised)', borderLeft: `3px solid ${TAG_COLOR[task.tag] ?? '#6b7280'}` }}>
      <p className="text-xs font-medium leading-snug"
         style={{
           color: task.status === 'done' ? 'var(--color-muted)' : 'var(--color-ink)',
           textDecoration: task.status === 'done' ? 'line-through' : 'none',
         }}>
        {task.text}
      </p>
      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        <span className="text-[10px]" style={{ color: TAG_COLOR[task.tag] }}>{task.tag}</span>
        <span className="text-[10px] font-medium" style={{ color: STATUS_COLOR[task.status] ?? '#6b7280' }}>
          {task.status}
        </span>
        {task.size === 'big' && (
          <span className="text-[10px]" style={{ color: '#f87171' }}>▲ big</span>
        )}
        {task.estimatedMinutes != null && (
          <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>~{task.estimatedMinutes}m</span>
        )}
        {task.postponeCount > 0 && (
          <span className="text-[10px]" style={{ color: '#f59e0b' }}>{task.postponeCount}× skipped</span>
        )}
      </div>
    </div>
  );
}
