// Points, allowance, gamification and analytics engine. Pure functions only,
// so every number on screen can be recomputed from the ledger and tested.
import type { Account, MoneyEntry, State, Transaction } from './types';

export const DAY = 86_400_000;

export const cycleKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
};

export const dayKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const prevCycle = (cycle: string) => {
  const [y, m] = cycle.split('-').map(Number);
  return cycleKey(new Date(y, m - 2, 1));
};

export const cycleLabel = (cycle: string) => {
  const [y, m] = cycle.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
};

/** Posted transactions only: pending deductions and rejected ones never count. */
export const posted = (txs: Transaction[], memberId: string, cycle?: string) =>
  txs.filter((t) => t.memberId === memberId && t.status === 'posted' && (!cycle || t.cycle === cycle));

export const isReversed = (txs: Transaction[], txId: string) =>
  txs.some((t) => t.reversesId === txId && t.status === 'posted');

export interface PointsSummary {
  merit: number; // sum of positive movements (after reversals)
  demerit: number; // sum of negative movements, as a positive number
  net: number;
  meritCount: number;
  demeritCount: number;
}

/**
 * Merit and demerit totals. A reversal is netted against the type of the
 * transaction it reverses, so reversing a demerit lowers the demerit total
 * instead of inflating merits.
 */
export function summarise(txs: Transaction[], memberId: string, cycle?: string): PointsSummary {
  const list = posted(txs, memberId, cycle);
  const byId = new Map(txs.map((t) => [t.id, t]));
  let merit = 0, demerit = 0, meritCount = 0, demeritCount = 0;
  for (const t of list) {
    const kind = t.type === 'reversal' ? byId.get(t.reversesId ?? '')?.type : t.type;
    if (kind === 'merit') {
      merit += t.points;
      meritCount += t.type === 'reversal' ? -1 : 1;
    } else if (kind === 'demerit') {
      demerit -= t.points;
      demeritCount += t.type === 'reversal' ? -1 : 1;
    }
  }
  return { merit, demerit, net: merit - demerit, meritCount, demeritCount };
}

export const balance = (txs: Transaction[], memberId: string) => summarise(txs, memberId).net;

export interface AllowanceBreakdown {
  netPoints: number;
  rate: number;
  pointsValue: number;
  base: number;
  meritShare: number;
  bonusEarned: boolean;
  bonus: number;
  subtotal: number;
  floor: number;
  cap: number;
  clampedBy: 'floor' | 'cap' | null;
  total: number;
  savings: number;
  spendable: number;
  pendingCount: number;
  openDisputes: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Monthly allowance:
 *   pointsValue = max(0, net points) x rate
 *   bonus       = pointsValue x bonusPct  when merit share >= bonusMeritShare
 *   subtotal    = base + pointsValue + bonus
 *   total       = clamp(subtotal, floor, cap)
 *   savings     = total x savingsPct, spendable = total - savings
 */
export function proposeAllowance(state: State, account: Account, memberId: string, cycle: string): AllowanceBreakdown {
  const s = summarise(state.transactions, memberId, cycle);
  const r = account.allowance;
  const pointsValue = round2(Math.max(0, s.net) * account.rate);
  const moved = s.merit + s.demerit;
  const meritShare = moved === 0 ? 0 : s.merit / moved;
  const bonusEarned = moved > 0 && meritShare >= r.bonusMeritShare;
  const bonus = bonusEarned ? round2(pointsValue * (r.bonusPct / 100)) : 0;
  const subtotal = round2(r.base + pointsValue + bonus);
  let total = subtotal;
  let clampedBy: AllowanceBreakdown['clampedBy'] = null;
  if (total < r.floor) { total = r.floor; clampedBy = 'floor'; }
  if (total > r.cap) { total = r.cap; clampedBy = 'cap'; }
  const savings = round2(total * r.savingsPct);
  const pendingCount = state.transactions.filter((t) => t.memberId === memberId && t.cycle === cycle && t.status === 'pending').length;
  const cycleTx = new Set(state.transactions.filter((t) => t.memberId === memberId && t.cycle === cycle).map((t) => t.id));
  const openDisputes = state.disputes.filter((d) => d.status === 'open' && cycleTx.has(d.txId)).length;
  return {
    netPoints: s.net, rate: account.rate, pointsValue, base: r.base, meritShare, bonusEarned, bonus,
    subtotal, floor: r.floor, cap: r.cap, clampedBy, total, savings, spendable: round2(total - savings),
    pendingCount, openDisputes,
  };
}

/** Consecutive days, ending today (or yesterday if nothing logged yet today), with at least one merit. */
export function streak(txs: Transaction[], memberId: string, now = new Date()): number {
  const days = new Set(posted(txs, memberId).filter((t) => t.type === 'merit').map((t) => dayKey(t.createdAt)));
  let d = new Date(now);
  if (!days.has(dayKey(d))) d = new Date(d.getTime() - DAY);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d = new Date(d.getTime() - DAY); }
  return n;
}

/** Whole days since the last posted, unreversed demerit. */
export function cleanDays(txs: Transaction[], memberId: string, now = new Date()): number {
  const last = posted(txs, memberId)
    .filter((t) => t.type === 'demerit' && !isReversed(txs, t.id))
    .map((t) => new Date(t.createdAt).getTime())
    .sort((a, b) => b - a)[0];
  if (!last) return 30;
  return Math.floor((now.getTime() - last) / DAY);
}

const LEVELS = ['Starter', 'Explorer', 'Builder', 'Achiever', 'Champion', 'Legend'];
const LEVEL_STEP = 60;

/** Levels grow from lifetime merit only, so a bad week never drops a level. */
export function level(txs: Transaction[], memberId: string) {
  const lifetime = summarise(txs, memberId).merit;
  const idx = Math.floor(lifetime / LEVEL_STEP);
  const name = LEVELS[Math.min(idx, LEVELS.length - 1)];
  const into = lifetime - idx * LEVEL_STEP;
  return { number: idx + 1, name, progress: into / LEVEL_STEP, toNext: LEVEL_STEP - into, lifetime };
}

export interface Badge { id: string; name: string; icon: string; description: string; earned: boolean; progress: number }

export function badges(state: State, memberId: string, now = new Date()): Badge[] {
  const txs = state.transactions;
  const s = summarise(txs, memberId);
  const st = streak(txs, memberId, now);
  const clean = cleanDays(txs, memberId, now);
  const goals = state.goals.filter((g) => g.memberId === memberId);
  const bestGoal = goals.reduce((m, g) => Math.max(m, g.target ? g.saved / g.target : 0), 0);
  const cat = (c: string) => posted(txs, memberId).filter((t) => t.type === 'merit' && t.category === c).length;
  const b = (id: string, name: string, icon: string, description: string, progress: number): Badge => ({
    id, name, icon, description, progress: Math.max(0, Math.min(1, progress)), earned: progress >= 1,
  });
  return [
    b('first', 'First Star', '⭐', 'Earn your first merit', s.meritCount),
    b('streak7', 'Week Warrior', '🔥', '7-day merit streak', st / 7),
    b('clean7', 'Clean Week', '🛡️', '7 days with no deductions', clean / 7),
    b('century', 'Century', '💯', '100 lifetime merit points', s.merit / 100),
    b('helper', 'Home Hero', '🏠', '10 chores merits', cat('Chores') / 10),
    b('scholar', 'Bookworm', '📚', '10 study or reading merits', (cat('Study') + cat('Reading')) / 10),
    b('saver', 'Smart Saver', '🏦', 'Reach 50% of a savings goal', bestGoal / 0.5),
    b('streak30', 'Unstoppable', '🚀', '30-day merit streak', st / 30),
  ];
}

export interface Challenge { id: string; name: string; icon: string; target: number; done: number; reward: number }

/** Weekly challenges reset every Monday. */
export function weeklyChallenges(txs: Transaction[], memberId: string, now = new Date()): Challenge[] {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const week = posted(txs, memberId).filter((t) => new Date(t.createdAt) >= monday);
  const merits = week.filter((t) => t.type === 'merit');
  const days = new Set(merits.map((t) => dayKey(t.createdAt))).size;
  const demerits = week.filter((t) => t.type === 'demerit').length;
  const cats = new Set(merits.map((t) => t.category)).size;
  return [
    { id: 'w-days', name: 'Earn a merit on 5 different days', icon: '📅', target: 5, done: Math.min(5, days), reward: 5 },
    { id: 'w-cats', name: 'Earn merits in 3 categories', icon: '🎯', target: 3, done: Math.min(3, cats), reward: 3 },
    { id: 'w-clean', name: 'No more than 1 deduction', icon: '🛡️', target: 1, done: demerits <= 1 ? 1 : 0, reward: 3 },
  ];
}

export type Granularity = 'day' | 'week' | 'month';

export interface SeriesPoint { key: string; label: string; merit: number; demerit: number; net: number }

/** Merit and demerit per bucket, oldest first. */
export function series(txs: Transaction[], memberIds: string[], g: Granularity, count: number, now = new Date()): SeriesPoint[] {
  const buckets: { key: string; label: string; start: number; end: number }[] = [];
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i--) {
    let start: Date, end: Date, label: string;
    if (g === 'day') {
      start = new Date(base.getTime() - i * DAY);
      end = new Date(start.getTime() + DAY);
      label = start.toLocaleDateString('en-MY', { weekday: 'narrow' });
    } else if (g === 'week') {
      const mon = new Date(base);
      mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) - i * 7);
      start = mon;
      end = new Date(mon.getTime() + 7 * DAY);
      label = mon.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
    } else {
      start = new Date(base.getFullYear(), base.getMonth() - i, 1);
      end = new Date(base.getFullYear(), base.getMonth() - i + 1, 1);
      label = start.toLocaleDateString('en-MY', { month: 'short' });
    }
    buckets.push({ key: dayKey(start), label, start: start.getTime(), end: end.getTime() });
  }
  const byId = new Map(txs.map((t) => [t.id, t]));
  return buckets.map((b) => {
    let merit = 0, demerit = 0;
    for (const t of txs) {
      if (!memberIds.includes(t.memberId) || t.status !== 'posted') continue;
      const at = new Date(t.createdAt).getTime();
      if (at < b.start || at >= b.end) continue;
      const kind = t.type === 'reversal' ? byId.get(t.reversesId ?? '')?.type : t.type;
      if (kind === 'merit') merit += t.points; else if (kind === 'demerit') demerit -= t.points;
    }
    return { key: b.key, label: b.label, merit, demerit, net: merit - demerit };
  });
}

export function categoryBreakdown(txs: Transaction[], memberIds: string[], cycle?: string) {
  const map = new Map<string, { merit: number; demerit: number }>();
  for (const t of txs) {
    if (!memberIds.includes(t.memberId) || t.status !== 'posted' || t.type === 'reversal') continue;
    if (cycle && t.cycle !== cycle) continue;
    if (isReversed(txs, t.id)) continue;
    const e = map.get(t.category) ?? { merit: 0, demerit: 0 };
    if (t.type === 'merit') e.merit += t.points; else e.demerit -= t.points;
    map.set(t.category, e);
  }
  return [...map.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.merit + b.demerit - (a.merit + a.demerit));
}

export interface FinanceSummary {
  income: number;
  expense: number;
  saved: number;
  net: number;
  needs: number;
  wants: number;
  savingsRate: number;
  byCategory: { category: string; amount: number }[];
}

export function finance(money: MoneyEntry[], memberId: string, cycle: string): FinanceSummary {
  const list = money.filter((m) => m.memberId === memberId && cycleKey(m.date) === cycle);
  const sum = (k: MoneyEntry['kind']) => round2(list.filter((m) => m.kind === k).reduce((a, m) => a + m.amount, 0));
  const income = sum('income'), expense = sum('expense'), saved = sum('saving');
  const exp = list.filter((m) => m.kind === 'expense');
  const needs = round2(exp.filter((m) => m.need).reduce((a, m) => a + m.amount, 0));
  const cat = new Map<string, number>();
  exp.forEach((m) => cat.set(m.category, (cat.get(m.category) ?? 0) + m.amount));
  return {
    income, expense, saved, net: round2(income - expense - saved), needs, wants: round2(expense - needs),
    savingsRate: income ? saved / income : 0,
    byCategory: [...cat.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
  };
}

/**
 * Financial discipline score (0-100) for individuals:
 * 40% staying within budget, 30% savings rate vs 20% target, 30% needs share of spending.
 */
export function disciplineScore(f: FinanceSummary, budget: number) {
  const budgetPart = budget > 0 ? Math.max(0, 1 - Math.max(0, f.expense - budget) / budget) : 1;
  const savePart = Math.min(1, f.savingsRate / 0.2);
  const needsPart = f.expense ? f.needs / f.expense : 1;
  return Math.round(budgetPart * 40 + savePart * 30 + needsPart * 30);
}

/** Habit score for a cycle: share of merit within all movements, 0-100. */
export function habitScore(txs: Transaction[], memberId: string, cycle: string) {
  const s = summarise(txs, memberId, cycle);
  const moved = s.merit + s.demerit;
  return moved ? Math.round((s.merit / moved) * 100) : 0;
}
