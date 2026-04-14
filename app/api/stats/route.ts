import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Task from '@/models/Task';
import UserStats from '@/models/UserStats';
import RecurringTask from '@/models/RecurringTask';

// Revalidate every 60 s — stats are expensive; serve cached version between updates
export const revalidate = 60;

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

const DOW_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export async function GET() {
  try {
    await connectDB();

    const now             = new Date();
    const weekStartStr    = toDateStr(getWeekStart(now));
    const lastWeekD       = new Date(getWeekStart(now));
    lastWeekD.setDate(lastWeekD.getDate() - 7);
    const lastWeekStartStr  = toDateStr(lastWeekD);
    const eightWeeksAgoStr  = toDateStr(new Date(now.getTime() - 56 * 86400000));

    // ── All queries in parallel ────────────────────────────────
    const [
      userStats,
      recurringTasks,
      recentTasks,
      topPostponed,
      postponeReasonsAgg,
      heatmapAgg,
      tagAgg,
      bestDayAgg,
      procrastinationAgg,
      timeAccuracyAgg,
    ] = await Promise.all([
      UserStats.findOne({}).lean(),
      RecurringTask.find().sort({ streak: -1 }).lean(),

      Task.find({ date: { $gte: eightWeeksAgoStr } })
          .select('date status postponeCount')
          .lean(),

      Task.find({ postponeCount: { $gt: 0 } })
          .sort({ postponeCount: -1 })
          .limit(10)
          .select('text postponeCount tag size')
          .lean(),

      Task.aggregate([
        { $match: { 'postponeReasons.0': { $exists: true } } },
        { $unwind: '$postponeReasons' },
        { $group: { _id: { $toLower: { $trim: { input: '$postponeReasons' } } }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),

      Task.aggregate([
        { $match: { status: 'done', completedAt: { $exists: true, $ne: null } } },
        { $group: { _id: { $hour: '$completedAt' }, count: { $sum: 1 } } },
      ]),

      Task.aggregate([
        { $group: {
          _id: '$tag',
          total: { $sum: 1 },
          done:  { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        }},
      ]),

      Task.aggregate([
        { $match: { status: 'done' } },
        { $group: { _id: '$date', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),

      // Procrastination patterns — when postponements happen
      Task.aggregate([
        { $match: { 'postponedAt.0': { $exists: true } } },
        { $unwind: '$postponedAt' },
        { $facet: {
          byDay: [
            { $group: { _id: { $dayOfWeek: '$postponedAt' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byHour: [
            { $group: { _id: { $hour: '$postponedAt' }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
        }},
      ]),

      // Time estimation accuracy — actual vs estimated per tag
      Task.aggregate([
        { $match: {
          status: 'done',
          estimatedMinutes: { $exists: true, $gt: 0 },
          actualMinutes:    { $exists: true, $gt: 0 },
        }},
        { $group: {
          _id: '$tag',
          totalActual:    { $sum: '$actualMinutes' },
          totalEstimated: { $sum: '$estimatedMinutes' },
          count:          { $sum: 1 },
        }},
      ]),
    ]);

    // ── Weekly completion ──────────────────────────────────────
    const weekMap: Record<string, { created: number; completed: number }> = {};
    for (const t of recentTasks as { date: string; status: string; postponeCount: number }[]) {
      const ws = toDateStr(getWeekStart(new Date(t.date)));
      if (!weekMap[ws]) weekMap[ws] = { created: 0, completed: 0 };
      weekMap[ws].created++;
      if (t.status === 'done') weekMap[ws].completed++;
    }
    const weeklyCompletion = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([week, { created, completed }]) => ({
        week, completed, created,
        rate: created > 0 ? Math.round((completed / created) * 100) : 0,
      }));

    // ── Postpone reasons ───────────────────────────────────────
    const postponeReasons = (postponeReasonsAgg as { _id: string; count: number }[])
      .map(({ _id, count }) => ({ reason: _id, count }));

    // ── Heatmap ────────────────────────────────────────────────
    const hourBuckets = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    for (const { _id, count } of heatmapAgg as { _id: number; count: number }[]) {
      if (_id >= 0 && _id < 24) hourBuckets[_id].count = count;
    }

    // ── Tag breakdown ──────────────────────────────────────────
    const tagMap: Record<string, { total: number; done: number }> = {};
    for (const { _id, total, done } of tagAgg as { _id: string; total: number; done: number }[]) {
      tagMap[_id] = { total, done };
    }
    const tagBreakdown = ['work','learning','personal','health'].map((tag) => {
      const { total = 0, done = 0 } = tagMap[tag] ?? {};
      return { tag, total, done, rate: total > 0 ? Math.round((done / total) * 100) : 0 };
    });

    // ── Honesty score (reuse recentTasks) ─────────────────────
    type LeanTask = { date: string; status: string; postponeCount: number };
    const thisWeekTasks = (recentTasks as LeanTask[]).filter((t) => t.date >= weekStartStr);
    const lastWeekTasks = (recentTasks as LeanTask[]).filter(
      (t) => t.date >= lastWeekStartStr && t.date < weekStartStr
    );

    const twCreated = thisWeekTasks.length;
    const twDone    = thisWeekTasks.filter((t) => t.status === 'done').length;
    const twZombies = thisWeekTasks.filter((t) => t.postponeCount >= 3).length;
    const streak    = (userStats as { currentStreak?: number } | null)?.currentStreak ?? 0;

    const honestyScore = Math.min(100, Math.max(0, Math.round(
      (twCreated > 0 ? (twDone / twCreated) * 100 : 0) - twZombies * 5 + (streak > 7 ? 10 : 0)
    )));

    const lwCreated = lastWeekTasks.length;
    const lwDone    = lastWeekTasks.filter((t) => t.status === 'done').length;
    const lwZombies = lastWeekTasks.filter((t) => t.postponeCount >= 3).length;
    const lastWeekHonesty = Math.min(100, Math.max(0, Math.round(
      (lwCreated > 0 ? (lwDone / lwCreated) * 100 : 0) - lwZombies * 5
    )));
    const honestyTrend = honestyScore > lastWeekHonesty ? 'up'
                       : honestyScore < lastWeekHonesty ? 'down' : 'flat';

    // ── Procrastination patterns ───────────────────────────────
    const procData = (procrastinationAgg as {
      byDay: { _id: number; count: number }[];
      byHour: { _id: number; count: number }[];
    }[])[0] ?? { byDay: [], byHour: [] };

    const procByDay = DOW_NAMES.map((name, i) => {
      const found = procData.byDay.find((d) => d._id === i + 1); // MongoDB: 1=Sun
      return { day: name, count: found?.count ?? 0 };
    });

    const procByHour = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: procData.byHour.find((h) => h._id === i)?.count ?? 0,
    }));

    const worstDay  = procByDay.reduce((a, b) => (b.count > a.count ? b : a), procByDay[0]);
    const worstHour = procByHour.reduce((a, b) => (b.count > a.count ? b : a), procByHour[0]);

    // ── Time estimation accuracy ───────────────────────────────
    type TimeAccRow = { _id: string; totalActual: number; totalEstimated: number; count: number };
    const timeAccRows = timeAccuracyAgg as TimeAccRow[];
    const timeAccByTag: Record<string, { ratio: number; count: number }> = {};
    let accTotalActual = 0, accTotalEstimated = 0, accTotalCount = 0;
    for (const row of timeAccRows) {
      const ratio = row.totalEstimated > 0 ? row.totalActual / row.totalEstimated : null;
      if (ratio !== null) {
        timeAccByTag[row._id] = { ratio: Math.round(ratio * 100) / 100, count: row.count };
        accTotalActual    += row.totalActual;
        accTotalEstimated += row.totalEstimated;
        accTotalCount     += row.count;
      }
    }
    const overallRatio = accTotalEstimated > 0 ? Math.round((accTotalActual / accTotalEstimated) * 100) / 100 : null;
    const timeAccuracy = accTotalCount >= 3
      ? { overall: { ratio: overallRatio, count: accTotalCount }, byTag: timeAccByTag }
      : null;

    // ── Last week summary (for Monday banner on board) ─────────
    const lastWeekEntry = weeklyCompletion[weeklyCompletion.length - 2];
    const thisWeekEntry = weeklyCompletion[weeklyCompletion.length - 1];

    // ── Personal records ───────────────────────────────────────
    const mostInDay        = (bestDayAgg as { count: number }[])[0]?.count ?? 0;
    const bestWeekCompleted = Math.max(0, ...weeklyCompletion.map((w) => w.completed));
    const us = userStats as Record<string, number> | null;

    return NextResponse.json({
      userStats: us ?? {
        currentStreak: 0, longestStreak: 0,
        totalTasksCreated: 0, totalTasksCompleted: 0,
        totalTasksPostponed: 0, totalTasksAbandoned: 0,
      },
      weeklyCompletion,
      topPostponed,
      postponeReasons,
      heatmap: hourBuckets,
      tagBreakdown,
      recurringTasks,
      honestyScore,
      honestyTrend,
      lastWeekHonesty,
      procrastination: {
        byDay:     procByDay,
        byHour:    procByHour,
        worstDay:  worstDay.count > 0 ? worstDay : null,
        worstHour: worstHour.count > 0 ? worstHour : null,
      },
      timeAccuracy,
      lastWeekSummary:  lastWeekEntry  ?? null,
      thisWeekSummary:  thisWeekEntry  ?? null,
      personalRecords: {
        longestStreak:    us?.longestStreak ?? 0,
        mostTasksInDay:   mostInDay,
        bestWeekCompleted,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
