import { describe, expect, it } from 'vitest';
import { balance, cycleKey, proposeAllowance, summarise } from '../logic';
import { reduce } from '../store';
import { seed, FAMILY } from '../seed';
import type { State } from '../types';

const fresh = (): State => {
  const s = seed();
  // Empty ledger so tests control every number.
  return { ...s, transactions: [], disputes: [], cycles: [], moods: [] };
};
const acct = (s: State) => s.accounts.find((a) => a.id === FAMILY)!;
const award = (s: State, memberId: string, kind: 'merit' | 'demerit', points: number, actorId = 'm_aisyah') =>
  reduce(s, { type: 'award', memberId, actorId, kind, points, category: 'Chores', description: `${kind} ${points}`, ...EVIDENCE });
const EVIDENCE = { reason: 'Left toys on the stairs again', proof: { kind: 'link' as const, url: 'https://example.com/photo.jpg' } };

describe('points ledger', () => {
  it('records actor, category, timestamp and cycle on every transaction', () => {
    const s = award(fresh(), 'm_danish', 'merit', 3);
    const t = s.transactions[0];
    expect(t).toMatchObject({ memberId: 'm_danish', actorId: 'm_aisyah', category: 'Chores', points: 3, status: 'posted' });
    expect(t.cycle).toBe(cycleKey(new Date()));
    expect(new Date(t.createdAt).toString()).not.toBe('Invalid Date');
    expect(s.audit[0].action).toBe('merit.added');
  });

  it('requires a reason for a child deduction', () => {
    expect(() => reduce(fresh(), { type: 'award', memberId: 'm_danish', actorId: 'm_aisyah', kind: 'demerit', points: 2, category: 'Respect', description: ' ' })).toThrow(/reason/);
  });

  it('children cannot award themselves points', () => {
    expect(() => award(fresh(), 'm_danish', 'merit', 5, 'm_danish')).toThrow();
  });

  it('corrects mistakes with a reversal instead of editing', () => {
    let s = award(fresh(), 'm_danish', 'demerit', 3);
    const original = s.transactions[0];
    s = reduce(s, { type: 'reverse', txId: original.id, actorId: 'm_aisyah', reason: 'wrong child' });
    expect(s.transactions).toHaveLength(2);
    expect(s.transactions.find((t) => t.id === original.id)).toEqual(original);
    expect(balance(s.transactions, 'm_danish')).toBe(0);
    const sum = summarise(s.transactions, 'm_danish');
    expect(sum.demerit).toBe(0);
    expect(sum.merit).toBe(0);
    expect(() => reduce(s, { type: 'reverse', txId: original.id, actorId: 'm_aisyah', reason: 'again' })).toThrow(/already/);
  });

  it('holds large co-guardian deductions for approval and excludes them until approved', () => {
    let s = award(fresh(), 'm_sara', 'demerit', 5, 'm_faiz');
    expect(s.transactions[0].status).toBe('pending');
    expect(balance(s.transactions, 'm_sara')).toBe(0);
    expect(() => reduce(s, { type: 'approveTx', txId: s.transactions[0].id, actorId: 'm_faiz' })).toThrow();
    s = reduce(s, { type: 'approveTx', txId: s.transactions[0].id, actorId: 'm_aisyah' });
    expect(balance(s.transactions, 'm_sara')).toBe(-5);
  });
});

describe('disputes', () => {
  it('reverses the deduction when a guardian accepts the dispute', () => {
    let s = award(fresh(), 'm_danish', 'demerit', 4);
    const tx = s.transactions[0];
    s = reduce(s, { type: 'raiseDispute', txId: tx.id, memberId: 'm_danish', reason: 'It was not only me', note: '' });
    expect(() => reduce(s, { type: 'raiseDispute', txId: tx.id, memberId: 'm_danish', reason: 'again', note: '' })).toThrow();
    s = reduce(s, { type: 'resolveDispute', disputeId: s.disputes[0].id, actorId: 'm_aisyah', outcome: 'partial', response: 'Half each', refundPoints: 2 });
    expect(balance(s.transactions, 'm_danish')).toBe(-2);
    expect(s.disputes[0].status).toBe('partial');
  });
});

describe('monthly allowance', () => {
  it('applies base + points x rate + bonus, then the cap, then the savings split', () => {
    let s = fresh();
    s = award(s, 'm_danish', 'merit', 40);
    s = award(s, 'm_danish', 'demerit', 5);
    const p = proposeAllowance(s, acct(s), 'm_danish', cycleKey(new Date()));
    // net 35 x RM1 = 35; merit share 40/45 = 0.89 >= 0.8 so 10% bonus = 3.5; base 10 -> 48.5
    expect(p.pointsValue).toBe(35);
    expect(p.bonusEarned).toBe(true);
    expect(p.bonus).toBe(3.5);
    expect(p.total).toBe(48.5);
    expect(p.savings).toBe(9.7);
    expect(p.spendable).toBe(38.8);
  });

  it('never pays less than the floor or more than the cap, and ignores negative net points', () => {
    let s = award(fresh(), 'm_danish', 'demerit', 30);
    const low = proposeAllowance(s, acct(s), 'm_danish', cycleKey(new Date()));
    expect(low.pointsValue).toBe(0);
    expect(low.total).toBe(10); // base 10 is above floor 5
    s = award(fresh(), 'm_danish', 'merit', 100);
    const high = proposeAllowance(s, acct(s), 'm_danish', cycleKey(new Date()));
    expect(high.total).toBe(80);
    expect(high.clampedBy).toBe('cap');
  });

  it('uses the configured conversion rate', () => {
    let s = fresh();
    s = reduce(s, { type: 'updateAccount', accountId: FAMILY, actorId: 'm_aisyah', patch: { rate: 0.5 } });
    s = award(s, 'm_danish', 'merit', 20);
    expect(proposeAllowance(s, acct(s), 'm_danish', cycleKey(new Date())).pointsValue).toBe(10);
  });

  it('blocks approval while a dispute is open, then records and closes the cycle', () => {
    let s = award(fresh(), 'm_danish', 'demerit', 2);
    s = reduce(s, { type: 'raiseDispute', txId: s.transactions[0].id, memberId: 'm_danish', reason: 'x', note: '' });
    const cycle = cycleKey(new Date());
    const approve = (st: State) => reduce(st, { type: 'approveAllowance', memberId: 'm_danish', cycle, proposed: 10, amount: 12, savings: 2.4, actorId: 'm_aisyah', note: 'extra effort' });
    expect(() => approve(s)).toThrow(/dispute/);
    s = reduce(s, { type: 'resolveDispute', disputeId: s.disputes[0].id, actorId: 'm_aisyah', outcome: 'upheld', response: 'Rule was clear' });
    s = approve(s);
    expect(s.cycles.find((c) => c.month === cycle)).toMatchObject({ status: 'approved', approved: 12, proposed: 10 });
    expect(() => approve(s)).toThrow(/already/);
    s = reduce(s, { type: 'closeCycle', memberId: 'm_danish', cycle, actorId: 'm_aisyah' });
    expect(s.cycles.find((c) => c.month === cycle)?.status).toBe('closed');
  });
});

describe('seed data', () => {
  it('builds a consistent demo state', () => {
    const s = seed();
    expect(s.members).toHaveLength(5);
    expect(s.transactions.length).toBeGreaterThan(100);
    expect(s.disputes.filter((d) => d.status === 'open')).toHaveLength(1);
    expect(s.transactions.filter((t) => t.status === 'pending')).toHaveLength(1);
  });
});

describe('proof, reasons, moods and reactions', () => {
  const link = { kind: 'link' as const, url: 'https://example.com/receipt.jpg' };
  it('needs a written justification for every deduction by a parent', () => {
    expect(() => reduce(fresh(), { type: 'award', memberId: 'm_danish', actorId: 'm_aisyah', kind: 'demerit', points: 2, category: 'Respect', description: 'Rude words' })).toThrow(/justification/);
    const s = reduce(fresh(), { type: 'award', memberId: 'm_danish', actorId: 'm_aisyah', kind: 'demerit', points: 2, category: 'Respect', description: 'Rude words', reason: 'Shouted at his sister at dinner' });
    expect(s.transactions[0].reason).toBe('Shouted at his sister at dinner');
  });
  it('needs proof for merit awards in a family unless switched off', () => {
    const base = { type: 'award' as const, memberId: 'm_danish', actorId: 'm_aisyah', kind: 'merit' as const, points: 2, category: 'Chores', description: 'Made the bed' };
    expect(() => reduce(fresh(), base)).toThrow(/proof/);
    expect(() => reduce(fresh(), { ...base, proof: { kind: 'link', url: 'not a link' } })).toThrow(/not valid/);
    expect(reduce(fresh(), { ...base, proof: link }).transactions[0].proof).toEqual(link);
    const off = fresh(); off.accounts = off.accounts.map((a) => (a.id === FAMILY ? { ...a, requireActivityProof: false } : a));
    expect(reduce(off, base).transactions).toHaveLength(1);
  });
  it('needs a receipt for every purchase and a mood from children', () => {
    const entry = { id: 'mn_t', memberId: 'm_danish', kind: 'expense' as const, amount: 5, category: 'Snacks', note: 'Chips', date: '2026-11-11' };
    expect(() => reduce(fresh(), { type: 'addMoney', actorId: 'm_danish', entry })).toThrow(/receipt/);
    expect(() => reduce(fresh(), { type: 'addMoney', actorId: 'm_danish', entry: { ...entry, proof: link } })).toThrow(/feel/);
    const s = reduce(fresh(), { type: 'addMoney', actorId: 'm_danish', entry: { ...entry, proof: link, mood: 'happy' } });
    const r = reduce(s, { type: 'reactMoney', entryId: 'mn_t', actorId: 'm_aisyah', kind: 'why', note: 'That is half your week' });
    expect(r.money[0].reaction).toMatchObject({ kind: 'why', by: 'm_aisyah' });
    expect(r.notifications[0]).toMatchObject({ memberId: 'm_danish' });
    expect(() => reduce(r, { type: 'reactMoney', entryId: 'mn_t', actorId: 'm_danish', kind: 'great' })).toThrow(/guardian/);
    const replied = reduce(r, { type: 'replyMoney', entryId: 'mn_t', memberId: 'm_danish', text: 'It was for the whole class' });
    expect(replied.money[0].reaction?.reply).toBe('It was for the whole class');
    expect(replied.notifications[0].memberId).toBe('m_aisyah');
  });
  it('keeps one mood check-in per person per day', () => {
    let s = reduce(fresh(), { type: 'checkIn', memberId: 'm_danish', mood: 'ok', at: '2026-11-11T08:00:00Z' });
    s = reduce(s, { type: 'checkIn', memberId: 'm_danish', mood: 'happy', at: '2026-11-11T18:00:00Z' });
    s = reduce(s, { type: 'checkIn', memberId: 'm_danish', mood: 'sad', at: '2026-11-12T08:00:00Z' });
    expect(s.moods!.filter((m) => m.memberId === 'm_danish').map((m) => m.mood)).toEqual(['sad', 'happy']);
  });
});
