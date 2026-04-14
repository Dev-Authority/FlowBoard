'use client';
import { useState, useEffect } from 'react';

interface StatsData {
  userStats: {
    currentStreak: number;
    longestStreak: number;
    totalTasksCreated: number;
    totalTasksCompleted: number;
    totalTasksPostponed: number;
    totalTasksAbandoned: number;
  };
  weeklyCompletion: { week: string; rate: number; completed: number; created: number }[];
  topPostponed: { _id: string; text: string; postponeCount: number; tag: string }[];
  postponeReasons: { reason: string; count: number }[];
  heatmap: { hour: number; count: number }[];
  tagBreakdown: { tag: string; total: number; done: number; rate: number }[];
  recurringTasks: { _id: string; text: string; streak: number; bestStreak: number; frequency: string; isActive: boolean }[];
  honestyScore: number;
  honestyTrend: 'up' | 'down' | 'flat';
  lastWeekHonesty: number;
  personalRecords: { longestStreak: number; mostTasksInDay: number; bestWeekCompleted: number };
  procrastination: {
    byDay: { day: string; count: number }[];
    byHour: { hour: number; count: number }[];
    worstDay:  { day: string;  count: number } | null;
    worstHour: { hour: number; count: number } | null;
  };
  timeAccuracy: {
    overall: { ratio: number | null; count: number };
    byTag: Record<string, { ratio: number; count: number }>;
  } | null;
}

const TAG_BAR: Record<string, string> = {
  work: '#3b82f6', learning: '#8b5cf6', personal: '#ec4899', health: '#10b981',
};

function honestyColor(s: number) {
  if (s >= 70) return '#10b981';
  if (s >= 40) return '#f59e0b';
  return '#ef4444';
}

function fmtHour(h: number): string {
  if (h === 0)  return '12 AM';
  if (h < 12)  return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch('/api/stats').then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'var(--color-canvas)', color: 'var(--color-muted)' }}>
        Loading stats...
      </div>
    );
  }

  const { userStats, weeklyCompletion, topPostponed, postponeReasons,
    heatmap, tagBreakdown, recurringTasks, honestyScore, honestyTrend,
    personalRecords, procrastination, timeAccuracy } = stats;

  const completionRate = userStats.totalTasksCreated > 0
    ? Math.round((userStats.totalTasksCompleted / userStats.totalTasksCreated) * 100)
    : 0;

  const maxBar     = Math.max(1, ...weeklyCompletion.map((w) => w.rate));
  const maxHeat    = Math.max(1, ...heatmap.map((h) => h.count));
  const maxProcDay = Math.max(1, ...(procrastination?.byDay ?? []).map((d) => d.count));
  const maxProcHr  = Math.max(1, ...(procrastination?.byHour ?? []).map((h) => h.count));

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-canvas)' }}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Title + export ───────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-ink)' }}>Statistics</h1>
          <a href="/api/export" download
            className="text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--color-surface)', color: 'var(--color-muted)', border: '1px solid var(--color-line)' }}>
            ↓ Export CSV
          </a>
        </div>

        {/* ── Top cards ────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Current Streak"  value={`${userStats.currentStreak}d`} icon="🔥" accent="#f59e0b" />
          <StatCard label="Longest Streak"  value={`${userStats.longestStreak}d`} icon="🏆" accent="#a78bfa" />
          <StatCard label="Completion Rate" value={`${completionRate}%`}          icon="✅" accent="#10b981" />
          <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
               style={{ color: 'var(--color-muted)' }}>Honesty Score</p>
            <p className="text-3xl font-bold" style={{ color: honestyColor(honestyScore) }}>
              {honestyScore}
              <span className="text-base ml-1">
                {honestyTrend === 'up' ? '↑' : honestyTrend === 'down' ? '↓' : '→'}
              </span>
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
              vs last week: {stats.lastWeekHonesty}
            </p>
          </div>
        </div>

        {/* ── Weekly bar chart ─────────────────────────── */}
        <Card title="Last 8 Weeks — Completion Rate">
          {weeklyCompletion.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No data yet.</p>
          ) : (
            <div className="flex items-end gap-1.5 h-36 mt-2">
              {weeklyCompletion.map(({ week, rate, completed, created }) => {
                const barColor = rate >= 70 ? '#10b981' : rate >= 40 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={week} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[10px] font-mono" style={{ color: 'var(--color-muted)' }}>{rate}%</span>
                    <div className="w-full rounded-t-sm relative"
                         style={{ height: `${Math.max(4, Math.round((rate / maxBar) * 100))}px`, background: barColor }}>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10"
                           style={{ background: 'var(--color-raised)', color: 'var(--color-ink)', border: '1px solid var(--color-line)' }}>
                        {completed}/{created}
                      </div>
                    </div>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--color-muted)' }}>{week.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Productivity heatmap ──────────────────────── */}
        <Card title="Productivity by Hour">
          <div className="flex gap-0.5 items-end mt-2">
            {heatmap.map(({ hour, count }) => (
              <div key={hour} className="flex flex-col items-center gap-1 flex-1 group">
                <div className="w-full rounded-sm"
                     style={{
                       height: `${Math.max(3, Math.round((count / maxHeat) * 64))}px`,
                       background: count === 0
                         ? 'var(--color-raised)'
                         : `rgba(59,130,246,${0.25 + (count / maxHeat) * 0.75})`,
                     }}
                     title={`${hour}:00 — ${count} completions`} />
                {hour % 6 === 0 && (
                  <span className="text-[9px]" style={{ color: 'var(--color-muted)' }}>{hour}h</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* ── Procrastination patterns ──────────────────── */}
        {procrastination && (procrastination.worstDay || procrastination.worstHour) && (
          <Card title="😤 Procrastination Patterns">
            {/* Summary callout */}
            <div className="flex flex-wrap gap-3 mt-3 mb-4">
              {procrastination.worstDay && (
                <div className="flex-1 min-w-[140px] px-3 py-2 rounded-lg"
                     style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: '#f87171' }}>Worst day</p>
                  <p className="text-lg font-bold mt-0.5" style={{ color: '#f87171' }}>
                    {procrastination.worstDay.day}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {procrastination.worstDay.count} postponements
                  </p>
                </div>
              )}
              {procrastination.worstHour && (
                <div className="flex-1 min-w-[140px] px-3 py-2 rounded-lg"
                     style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: '#f87171' }}>Worst time</p>
                  <p className="text-lg font-bold mt-0.5" style={{ color: '#f87171' }}>
                    {fmtHour(procrastination.worstHour.hour)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {procrastination.worstHour.count} postponements
                  </p>
                </div>
              )}
            </div>

            {/* By day of week */}
            {procrastination.byDay.some((d) => d.count > 0) && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                   style={{ color: 'var(--color-muted)' }}>By day of week</p>
                <div className="flex items-end gap-1 h-16">
                  {procrastination.byDay.map(({ day, count }) => (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="w-full rounded-t-sm"
                           style={{
                             height: `${Math.max(3, Math.round((count / maxProcDay) * 48))}px`,
                             background: count === 0 ? 'var(--color-raised)' : `rgba(239,68,68,${0.3 + (count / maxProcDay) * 0.7})`,
                           }}
                           title={`${day}: ${count}`} />
                      <span className="text-[9px]" style={{ color: 'var(--color-muted)' }}>
                        {day.slice(0, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By hour */}
            {procrastination.byHour.some((h) => h.count > 0) && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                   style={{ color: 'var(--color-muted)' }}>By hour of day</p>
                <div className="flex items-end gap-0.5 h-12">
                  {procrastination.byHour.map(({ hour, count }) => (
                    <div key={hour} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="w-full rounded-t-sm"
                           style={{
                             height: `${Math.max(2, Math.round((count / maxProcHr) * 36))}px`,
                             background: count === 0 ? 'var(--color-raised)' : `rgba(239,68,68,${0.3 + (count / maxProcHr) * 0.7})`,
                           }}
                           title={`${fmtHour(hour)}: ${count}`} />
                      {hour % 6 === 0 && (
                        <span className="text-[8px]" style={{ color: 'var(--color-muted)' }}>{hour}h</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ── Postpone hall of shame ───────────────────── */}
        <Card title="😬 Postpone Hall of Shame">
          {topPostponed.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No postponed tasks. Impressive.</p>
          ) : (
            <div className="space-y-2 mt-1">
              {topPostponed.map((t, i) => (
                <div key={t._id} className="flex items-center gap-3">
                  <span className="text-xs w-5 text-right font-mono" style={{ color: 'var(--color-muted)' }}>{i + 1}.</span>
                  <p className="flex-1 text-sm truncate" style={{ color: 'var(--color-ink)' }}>{t.text}</p>
                  <span className="text-sm font-bold shrink-0" style={{ color: '#f59e0b' }}>{t.postponeCount}×</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Excuse ranker ────────────────────────────── */}
        {postponeReasons.length > 0 && (
          <Card title="Your Excuses — Ranked">
            <div className="space-y-3 mt-2">
              {postponeReasons.slice(0, 10).map(({ reason, count }, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm capitalize truncate" style={{ color: 'var(--color-ink)' }}>
                      &ldquo;{reason}&rdquo;
                    </p>
                    <span className="text-xs ml-2 shrink-0" style={{ color: 'var(--color-muted)' }}>{count}×</span>
                  </div>
                  <div className="h-1 rounded-full" style={{ background: 'var(--color-raised)' }}>
                    <div className="h-full rounded-full"
                         style={{ width: `${(count / postponeReasons[0].count) * 100}%`, background: '#f97316' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Tag breakdown ────────────────────────────── */}
        <Card title="Completion by Tag">
          <div className="space-y-3 mt-2">
            {tagBreakdown.map(({ tag, total, done, rate }) => (
              <div key={tag}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm capitalize font-medium" style={{ color: 'var(--color-ink)' }}>{tag}</span>
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{done}/{total} · {rate}%</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--color-raised)' }}>
                  <div className="h-full rounded-full"
                       style={{ width: `${rate}%`, background: TAG_BAR[tag] ?? '#6b7280' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Time estimation accuracy ─────────────────── */}
        {timeAccuracy && timeAccuracy.overall.ratio !== null && (
          <Card title="⏱ Estimation Accuracy">
            <div className="mt-3">
              {/* Overall verdict */}
              {timeAccuracy.overall.ratio > 1.1 ? (
                <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                  You underestimate by{' '}
                  <span className="font-bold" style={{ color: '#f59e0b' }}>
                    {timeAccuracy.overall.ratio.toFixed(1)}×
                  </span>{' '}
                  on average — measured across {timeAccuracy.overall.count} tasks.
                  {timeAccuracy.overall.ratio > 2
                    ? ' Your estimates are half of reality.'
                    : ' Add a buffer when planning.'}
                </p>
              ) : timeAccuracy.overall.ratio < 0.9 ? (
                <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                  You overestimate by{' '}
                  <span className="font-bold" style={{ color: '#10b981' }}>
                    {(1 / timeAccuracy.overall.ratio).toFixed(1)}×
                  </span>{' '}
                  — you finish faster than expected. Good.
                </p>
              ) : (
                <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                  Your estimates are remarkably accurate (
                  <span className="font-bold" style={{ color: '#10b981' }}>
                    {timeAccuracy.overall.ratio.toFixed(2)}×
                  </span>{' '}
                  ratio). Keep it up.
                </p>
              )}

              {/* Per-tag breakdown */}
              {Object.keys(timeAccuracy.byTag).length > 0 && (
                <div className="space-y-2">
                  {(['work', 'learning', 'personal', 'health'] as const)
                    .filter((tag) => timeAccuracy.byTag[tag])
                    .map((tag) => {
                      const { ratio, count } = timeAccuracy.byTag[tag];
                      const pct = Math.min(100, Math.round((ratio / 3) * 100)); // bar scale: 3× = full
                      const color = ratio > 2 ? '#ef4444' : ratio > 1.3 ? '#f59e0b' : ratio < 0.9 ? '#10b981' : '#3b82f6';
                      return (
                        <div key={tag}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm capitalize font-medium" style={{ color: 'var(--color-ink)' }}>
                              {tag}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                              {ratio.toFixed(1)}× · {count} tasks
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: 'var(--color-raised)' }}>
                            <div className="h-full rounded-full"
                                 style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  <p className="text-[10px] mt-1" style={{ color: 'var(--color-muted)' }}>
                    Bar shows actual÷estimated ratio (3× = full bar)
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── Recurring streaks ────────────────────────── */}
        {recurringTasks.length > 0 && (
          <Card title="Recurring Task Streaks">
            <div className="space-y-2 mt-1">
              {recurringTasks.map((rt) => (
                <div key={rt._id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate"
                       style={{ color: rt.isActive ? 'var(--color-ink)' : 'var(--color-muted)',
                                textDecoration: rt.isActive ? 'none' : 'line-through' }}>
                      {rt.text}
                    </p>
                    <p className="text-[11px] capitalize" style={{ color: 'var(--color-muted)' }}>{rt.frequency}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>🔥 {rt.streak}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>best: {rt.bestStreak}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Personal records ─────────────────────────── */}
        <Card title="Personal Records">
          <div className="grid grid-cols-3 gap-4 mt-2 text-center">
            {[
              { label: 'Longest streak',  value: `${personalRecords.longestStreak}d` },
              { label: 'Best single day', value: `${personalRecords.mostTasksInDay}` },
              { label: 'Best week',       value: `${personalRecords.bestWeekCompleted}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{value}</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>{label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Lifetime ─────────────────────────────────── */}
        <Card title="Lifetime">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mt-2">
            {[
              { label: 'Created',   value: userStats.totalTasksCreated,        color: 'var(--color-ink)' },
              { label: 'Completed', value: userStats.totalTasksCompleted,       color: '#10b981' },
              { label: 'Postponed', value: userStats.totalTasksPostponed,       color: '#f59e0b' },
              { label: 'Abandoned', value: userStats.totalTasksAbandoned ?? 0,  color: '#ef4444' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>{label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent }}>{icon} {value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>{title}</p>
      {children}
    </div>
  );
}
