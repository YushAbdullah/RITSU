// Demo data: one family (two guardians, two children) and one individual adult,
// with about six weeks of history so every dashboard has something to show.
import { DAY, cycleKey, prevCycle, proposeAllowance } from './logic';
import type { Account, Member, MoneyEntry, MoodKind, Rule, State, Transaction } from './types';

function rng(seedNum: number) {
  let a = seedNum;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FAMILY = 'acc_family';
export const SOLO = 'acc_solo';

const accounts: Account[] = [
  {
    id: FAMILY, mode: 'family', name: 'Rahman Family', currency: 'RM', rate: 1,
    allowance: { base: 10, bonusPct: 10, bonusMeritShare: 0.8, floor: 5, cap: 80, savingsPct: 0.2 },
    approvalThreshold: 3, disputeWindowDays: 7,
  },
  {
    id: SOLO, mode: 'individual', name: 'Hafiz', currency: 'RM', rate: 0.5,
    allowance: { base: 0, bonusPct: 10, bonusMeritShare: 0.75, floor: 0, cap: 150, savingsPct: 0.5 },
    approvalThreshold: 0, disputeWindowDays: 0,
  },
];

const members: Member[] = [
  { id: 'm_aisyah', accountId: FAMILY, name: 'Aisyah', role: 'guardian', avatar: '👩🏻' },
  { id: 'm_faiz', accountId: FAMILY, name: 'Faiz', role: 'coguardian', avatar: '👨🏻' },
  { id: 'm_danish', accountId: FAMILY, name: 'Danish', role: 'child', avatar: '🦖', age: 9 },
  { id: 'm_sara', accountId: FAMILY, name: 'Sara', role: 'child', avatar: '🦊', age: 15 },
  { id: 'm_hafiz', accountId: SOLO, name: 'Hafiz', role: 'individual', avatar: '🧑🏻‍💻', monthlyBudget: 2500 },
];

const r = (id: string, accountId: string, name: string, kind: Rule['kind'], points: number, category: string, icon: string, memberId?: string, recurring: Rule['recurring'] = null): Rule =>
  ({ id, accountId, name, kind, points, category, icon, memberId, recurring, active: true });

export const DEMO_RULES: Rule[] = [
  r('r_bed', FAMILY, 'Made the bed', 'merit', 1, 'Chores', '🛏️', undefined, 'daily'),
  r('r_dishes', FAMILY, 'Helped with the dishes', 'merit', 2, 'Chores', '🍽️'),
  r('r_tidy', FAMILY, 'Tidied own room', 'merit', 2, 'Chores', '🧹', undefined, 'weekly'),
  r('r_homework', FAMILY, 'Homework done on time', 'merit', 3, 'Study', '📝', undefined, 'daily'),
  r('r_read', FAMILY, 'Read for 20 minutes', 'merit', 2, 'Reading', '📚', undefined, 'daily'),
  r('r_help', FAMILY, 'Helped a sibling or friend', 'merit', 3, 'Kindness', '🤝'),
  r('r_exercise', FAMILY, 'Exercised for 30 minutes', 'merit', 2, 'Health', '⚽'),
  r('r_report', FAMILY, 'Great school result', 'merit', 10, 'Study', '🏅'),
  r('r_screen', FAMILY, 'Went over screen time', 'demerit', 2, 'Screen time', '📱'),
  r('r_late', FAMILY, 'Late getting ready for school', 'demerit', 2, 'Routine', '⏰'),
  r('r_rude', FAMILY, 'Rude words', 'demerit', 3, 'Respect', '🗯️'),
  r('r_fight', FAMILY, 'Fighting with sibling', 'demerit', 3, 'Respect', '🥊'),
  r('r_nohw', FAMILY, 'Homework not done', 'demerit', 3, 'Study', '📕'),
  r('r_messy', FAMILY, 'Left room messy', 'demerit', 1, 'Chores', '🧦'),
  r('r_curfew', FAMILY, 'Came home after curfew', 'demerit', 5, 'Routine', '🌙'),
  // Individual habits
  r('h_gym', SOLO, 'Gym session', 'merit', 3, 'Health', '🏋️', 'm_hafiz'),
  r('h_read', SOLO, 'Read 20 minutes', 'merit', 2, 'Growth', '📖', 'm_hafiz'),
  r('h_cook', SOLO, 'Cooked at home', 'merit', 2, 'Money', '🍳', 'm_hafiz'),
  r('h_nospend', SOLO, 'No-spend day', 'merit', 3, 'Money', '💰', 'm_hafiz'),
  r('h_sleep', SOLO, 'In bed before midnight', 'merit', 2, 'Health', '😴', 'm_hafiz'),
  r('h_impulse', SOLO, 'Impulse purchase', 'demerit', 4, 'Money', '🛍️', 'm_hafiz'),
  r('h_delivery', SOLO, 'Ordered food delivery', 'demerit', 2, 'Money', '🛵', 'm_hafiz'),
  r('h_skip', SOLO, 'Skipped planned workout', 'demerit', 1, 'Health', '🛋️', 'm_hafiz'),
  r('h_scroll', SOLO, 'Doomscrolled over 1 hour', 'demerit', 2, 'Focus', '📱', 'm_hafiz'),
];

export function seed(now = new Date()): State {
  const rand = rng(20261111);
  const txs: Transaction[] = [];
  let n = 0;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const add = (memberId: string, accountId: string, ruleId: string, actorId: string, day: Date, hour: number, note?: string) => {
    const rule = DEMO_RULES.find((x) => x.id === ruleId)!;
    const at = new Date(day.getTime() + hour * 3_600_000 + Math.floor(rand() * 50) * 60_000);
    if (at > now) return null;
    const tx: Transaction = {
      id: `tx_seed_${n++}`, accountId, memberId, type: rule.kind,
      points: rule.kind === 'merit' ? rule.points : -rule.points, category: rule.category,
      description: note ?? rule.name, ruleId, actorId, status: 'posted', createdAt: at.toISOString(), cycle: cycleKey(at),
    };
    txs.push(tx);
    return tx;
  };

  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const kidMerits = ['r_bed', 'r_dishes', 'r_homework', 'r_read', 'r_help', 'r_exercise', 'r_tidy'];
  const kidDemerits = ['r_screen', 'r_late', 'r_rude', 'r_fight', 'r_nohw', 'r_messy'];

  for (let i = 45; i >= 0; i--) {
    const day = new Date(today.getTime() - i * DAY);
    const guardian = () => (rand() < 0.65 ? 'm_aisyah' : 'm_faiz');
    // Danish, 9: lots of small merits, a few slips; improving over time.
    if (rand() < 0.92) add('m_danish', FAMILY, 'r_bed', guardian(), day, 7);
    const dCount = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < dCount; k++) add('m_danish', FAMILY, pick(kidMerits), guardian(), day, 15 + k);
    if (rand() < (i > 20 ? 0.38 : 0.22)) add('m_danish', FAMILY, pick(kidDemerits), guardian(), day, 20);
    // Sara, 15: steady, more study merits, occasional screen-time slips.
    if (rand() < 0.85) add('m_sara', FAMILY, 'r_homework', guardian(), day, 18);
    if (rand() < 0.6) add('m_sara', FAMILY, pick(['r_read', 'r_dishes', 'r_exercise', 'r_help', 'r_tidy']), guardian(), day, 19);
    if (rand() < 0.2) add('m_sara', FAMILY, pick(['r_screen', 'r_screen', 'r_late', 'r_rude']), guardian(), day, 22);
    // Hafiz: self-logged habits.
    if (rand() < 0.55) add('m_hafiz', SOLO, 'h_gym', 'm_hafiz', day, 7); else if (rand() < 0.4) add('m_hafiz', SOLO, 'h_skip', 'm_hafiz', day, 21);
    if (rand() < 0.6) add('m_hafiz', SOLO, 'h_read', 'm_hafiz', day, 22);
    if (rand() < 0.5) add('m_hafiz', SOLO, 'h_cook', 'm_hafiz', day, 19);
    if (rand() < 0.3) add('m_hafiz', SOLO, 'h_nospend', 'm_hafiz', day, 23);
    if (rand() < 0.5) add('m_hafiz', SOLO, 'h_sleep', 'm_hafiz', day, 23);
    if (rand() < 0.15) add('m_hafiz', SOLO, 'h_impulse', 'm_hafiz', day, 13);
    if (rand() < 0.25) add('m_hafiz', SOLO, 'h_delivery', 'm_hafiz', day, 20);
    if (rand() < 0.25) add('m_hafiz', SOLO, 'h_scroll', 'm_hafiz', day, 23);
  }
  add('m_sara', FAMILY, 'r_report', 'm_aisyah', new Date(today.getTime() - 12 * DAY), 16, 'Great school result: A in Maths test');

  // A recent deduction Danish has questioned, still open.
  const disputed = add('m_danish', FAMILY, 'r_fight', 'm_faiz', new Date(today.getTime() - 1 * DAY), 18, 'Fighting with sibling over the TV remote')!;
  // A co-guardian deduction above the threshold waiting for Aisyah.
  const pendingAt = new Date(now.getTime() - 3 * 3_600_000);
  txs.push({
    id: `tx_seed_${n++}`, accountId: FAMILY, memberId: 'm_sara', type: 'demerit', points: -5, category: 'Routine',
    description: 'Came home after curfew (9:45 pm)', ruleId: 'r_curfew', actorId: 'm_faiz', status: 'pending',
    createdAt: pendingAt.toISOString(), cycle: cycleKey(pendingAt),
  });
  // One earlier correction to show reversals in the ledger.
  const wrong = txs.find((t) => t.memberId === 'm_sara' && t.type === 'demerit' && new Date(t.createdAt) < new Date(today.getTime() - 5 * DAY));
  if (wrong) {
    const at = new Date(new Date(wrong.createdAt).getTime() + 2 * 3_600_000);
    txs.push({
      id: `tx_seed_${n++}`, accountId: FAMILY, memberId: 'm_sara', type: 'reversal', points: -wrong.points, category: wrong.category,
      description: `Correction: ${wrong.description} (recorded for the wrong child)`, actorId: 'm_aisyah', status: 'posted',
      reversesId: wrong.id, createdAt: at.toISOString(), cycle: cycleKey(at),
    });
  }

  txs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const cur = cycleKey(now);
  const prev = prevCycle(cur);
  const iso = (daysAgo: number) => new Date(today.getTime() - daysAgo * DAY).toISOString().slice(0, 10);
  const prevStart = (d: number) => { const [y, m] = prev.split('-').map(Number); return new Date(y, m - 1, d).toISOString().slice(0, 10); };

  const money: MoneyEntry[] = [];
  /** A tiny drawn receipt so demo purchases show what proof looks like. */
  const receipt = (item: string, amount: number) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320" viewBox="0 0 240 320"><rect width="240" height="320" fill="#fff"/><rect x="20" y="20" width="200" height="280" rx="8" fill="#F6FEF6" stroke="#DDEBDF"/><text x="120" y="60" font-family="sans-serif" font-size="16" text-anchor="middle" fill="#0F1A12">RECEIPT</text><line x1="40" y1="80" x2="200" y2="80" stroke="#DDEBDF"/><text x="40" y="120" font-family="sans-serif" font-size="14" fill="#4E544F">${item.replace(/[<&>]/g, '')}</text><text x="200" y="150" font-family="sans-serif" font-size="18" text-anchor="end" fill="#0F1A12">RM ${amount.toFixed(2)}</text><line x1="40" y1="250" x2="200" y2="250" stroke="#DDEBDF" stroke-dasharray="4 4"/><text x="120" y="280" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#5F655F">Thank you!</text></svg>`);
  let mi = 0;
  const m = (memberId: string, kind: MoneyEntry['kind'], amount: number, category: string, note: string, date: string, need?: boolean, goalId?: string) =>
    money.push({ id: `mn_seed_${mi++}`, memberId, kind, amount, category, note, date, need, goalId });

  // Hafiz's finances, previous and current month.
  for (const [cyc, day] of [[prev, prevStart], [cur, (d: number) => iso(Math.max(0, now.getDate() - d))]] as const) {
    const limit = cyc === cur ? now.getDate() : 31;
    m('m_hafiz', 'income', 4200, 'Salary', 'Monthly salary', day(1));
    if (limit >= 5) m('m_hafiz', 'expense', 1100, 'Rent', 'Room rent', day(1), true);
    if (limit >= 3) m('m_hafiz', 'expense', 180, 'Transport', 'Fuel and tolls', day(3), true);
    if (limit >= 4) m('m_hafiz', 'saving', 500, 'Savings', 'Emergency fund', day(2), undefined, 'g_emergency');
    if (limit >= 6) m('m_hafiz', 'expense', 320, 'Groceries', 'Weekly groceries', day(6), true);
    if (limit >= 9) m('m_hafiz', 'expense', 145, 'Food delivery', 'Delivery orders', day(9), false);
    if (limit >= 11) m('m_hafiz', 'expense', 89, 'Shopping', 'Sneakers on sale', day(11), false);
    if (limit >= 10) m('m_hafiz', 'expense', 120, 'Bills', 'Phone and internet', day(10), true);
    if (limit >= 15) m('m_hafiz', 'expense', 210, 'Entertainment', 'Concert ticket', day(15), false);
    if (limit >= 18) m('m_hafiz', 'saving', 250, 'Savings', 'Japan trip', day(18), undefined, 'g_japan');
    if (limit >= 20) m('m_hafiz', 'expense', 260, 'Groceries', 'Groceries', day(20), true);
    if (limit >= 24) m('m_hafiz', 'expense', 430, 'Shopping', 'Gadget', day(24), false);
  }
  // Children's pocket money, each with a receipt and how they felt.
  const kid = (memberId: string, amount: number, category: string, note: string, date: string, need: boolean, mood: MoodKind, reaction?: MoneyEntry['reaction']) =>
    money.push({ id: `mn_seed_${mi++}`, memberId, kind: 'expense', amount, category, note, date, need, mood, proof: { kind: 'photo', url: receipt(note, amount), name: 'receipt.svg' }, ...(reaction ? { reaction } : {}) });
  const ago = (d: number) => new Date(today.getTime() - d * DAY - 2 * 3_600_000).toISOString();
  kid('m_danish', 6, 'Snacks', 'Ice cream', iso(4), false, 'happy', { kind: 'great', by: 'm_aisyah', at: ago(4) });
  kid('m_danish', 12, 'Toys', 'Trading cards', iso(9), false, 'excited', { kind: 'why', note: 'That is a lot of cards. What about your Lego jar?', by: 'm_aisyah', at: ago(9), reply: 'I traded the doubles, Mama', replyAt: ago(8) });
  kid('m_sara', 25, 'Books', 'Novel', iso(6), true, 'happy');
  kid('m_sara', 18, 'Food', 'Bubble tea with friends', iso(3), false, 'ok');

  const state: State = {
    version: 1, accounts, members, rules: DEMO_RULES, transactions: txs,
    disputes: [{
      id: 'dp_seed_1', txId: disputed.id, memberId: 'm_danish', reason: 'It was not only me',
      note: 'Adik took the remote first and I asked nicely two times.', status: 'open',
      createdAt: new Date(new Date(disputed.createdAt).getTime() + 3_600_000).toISOString(),
    }],
    cycles: [],
    goals: [
      { id: 'g_lego', memberId: 'm_danish', name: 'Dinosaur Lego set', icon: '🦕', target: 120, saved: 38 },
      { id: 'g_phone', memberId: 'm_sara', name: 'New phone', icon: '📱', target: 800, saved: 260 },
      { id: 'g_emergency', memberId: 'm_hafiz', name: 'Emergency fund', icon: '🛟', target: 10000, saved: 3400 },
      { id: 'g_japan', memberId: 'm_hafiz', name: 'Japan trip', icon: '🗾', target: 6000, saved: 1250, targetDate: `${now.getFullYear() + 1}-04-01` },
    ],
    money,
    moods: [
      { id: 'md_seed_1', memberId: 'm_danish', mood: 'happy', note: 'Football at recess', at: ago(0) },
      { id: 'md_seed_2', memberId: 'm_sara', mood: 'meh', note: 'Lots of homework', at: ago(1) },
      { id: 'md_seed_3', memberId: 'm_danish', mood: 'ok', at: ago(1) },
    ],
    assessments: [{
      id: 'as_seed_1', memberId: 'm_hafiz', month: prev, rating: 3,
      wentWell: 'Gym three times most weeks, cooked more.', improve: 'Too many delivery orders on late nights.',
      focus: 'No delivery on weekdays', createdAt: new Date(today.getTime() - (now.getDate() - 1) * DAY).toISOString(),
    }],
    audit: [],
    notifications: [
      { id: 'nt_seed_1', memberId: 'm_aisyah', text: 'Danish questioned “Fighting with sibling over the TV remote”.', at: new Date(now.getTime() - 20 * 3_600_000).toISOString(), read: false },
      { id: 'nt_seed_2', memberId: 'm_aisyah', text: 'Faiz asked to deduct 5 from Sara. Needs your approval.', at: pendingAt.toISOString(), read: false },
      { id: 'nt_seed_3', memberId: 'm_danish', text: 'You earned the Week Warrior badge! 🔥', at: new Date(now.getTime() - 30 * 3_600_000).toISOString(), read: false },
    ],
  };

  // Last month's allowance was approved and the cycle closed.
  for (const id of ['m_danish', 'm_sara']) {
    const p = proposeAllowance(state, accounts[0], id, prev);
    state.cycles.push({
      id: `cy_seed_${id}`, memberId: id, month: prev, status: 'closed', proposed: p.total, approved: p.total,
      savingsTransfer: p.savings, approvedBy: 'm_aisyah', approvedAt: new Date(today.getTime() - (now.getDate() - 1) * DAY).toISOString(),
    });
    m(id, 'income', p.total, 'Allowance', `Allowance for ${prev}`, iso(now.getDate() - 1));
  }

  state.audit = txs.slice(0, 40).map((t, i) => ({
    id: `au_seed_${i}`, accountId: t.accountId, actorId: t.actorId,
    action: t.type === 'reversal' ? 'transaction.reversed' : t.status === 'pending' ? 'demerit.requested' : `${t.type}.added`,
    entity: 'transaction', entityId: t.id, detail: `${t.points > 0 ? '+' : ''}${t.points}: ${t.description}`, at: t.createdAt,
  }));
  return state;
}
