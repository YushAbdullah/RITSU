// State transitions. Every action is pure (state in, state out) and writes an
// audit entry, so behaviour is testable and every change is traceable.
import { useCallback, useEffect, useRef, useState } from 'react';
import { cycleKey } from './logic';
import { seed } from './seed';
import type {
  Account, Assessment, DisputeStatus, Member, MoneyEntry, MoodKind, Proof, ReactionKind, Rule, RuleKind, SavingsGoal, State, Transaction,
} from './types';

let counter = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export type Action =
  | { type: 'award'; memberId: string; actorId: string; kind: RuleKind; points: number; category: string; description: string; ruleId?: string; at?: string; reason?: string; proof?: Proof }
  | { type: 'approveTx'; txId: string; actorId: string }
  | { type: 'rejectTx'; txId: string; actorId: string }
  | { type: 'reverse'; txId: string; actorId: string; reason: string; points?: number }
  | { type: 'raiseDispute'; txId: string; memberId: string; reason: string; note: string }
  | { type: 'resolveDispute'; disputeId: string; actorId: string; outcome: Exclude<DisputeStatus, 'open'>; response: string; refundPoints?: number }
  | { type: 'approveAllowance'; memberId: string; cycle: string; proposed: number; amount: number; savings: number; actorId: string; note?: string }
  | { type: 'closeCycle'; memberId: string; cycle: string; actorId: string }
  | { type: 'updateAccount'; accountId: string; actorId: string; patch: Partial<Account> }
  | { type: 'saveRule'; actorId: string; rule: Rule }
  | { type: 'addMember'; actorId: string; member: Member }
  | { type: 'updateMember'; actorId: string; memberId: string; patch: Partial<Pick<Member, 'name' | 'avatar' | 'age' | 'monthlyBudget' | 'pinHash' | 'pinSalt'>> }
  | { type: 'saveGoal'; actorId: string; goal: SavingsGoal }
  | { type: 'contribute'; actorId: string; goalId: string; amount: number }
  | { type: 'addMoney'; actorId: string; entry: MoneyEntry }
  | { type: 'addAssessment'; actorId: string; assessment: Assessment }
  | { type: 'reactMoney'; entryId: string; actorId: string; kind: ReactionKind; note?: string }
  | { type: 'replyMoney'; entryId: string; memberId: string; text: string }
  | { type: 'checkIn'; memberId: string; mood: MoodKind; note?: string; at?: string }
  | { type: 'readAll'; memberId: string }
  | { type: 'reset' }
  | { type: 'replace'; state: State };

export class ActionError extends Error {}

const nowIso = () => new Date().toISOString();

function audit(s: State, accountId: string, actorId: string, action: string, entity: string, entityId: string, detail: string): State {
  return { ...s, audit: [{ id: uid('au'), accountId, actorId, action, entity, entityId, detail, at: nowIso() }, ...s.audit] };
}

function notify(s: State, memberId: string, text: string): State {
  return { ...s, notifications: [{ id: uid('nt'), memberId, text, at: nowIso(), read: false }, ...s.notifications] };
}

const memberOf = (s: State, id: string) => {
  const m = s.members.find((x) => x.id === id);
  if (!m) throw new ActionError(`Unknown member ${id}`);
  return m;
};
const accountOf = (s: State, id: string) => {
  const a = s.accounts.find((x) => x.id === id);
  if (!a) throw new ActionError(`Unknown account ${id}`);
  return a;
};

/** Whether merit awards in this account must carry proof. */
export const activityProofRequired = (acct: Account) => acct.requireActivityProof ?? acct.mode === 'family';

export function checkProof(p: Proof | undefined): p is Proof {
  if (!p) return false;
  if (p.kind === 'link') return /^https?:\/\/\S+\.\S+/i.test(p.url.trim());
  return p.kind === 'photo' && p.url.startsWith('data:image/');
}

export const REACTION_TEXT: Record<ReactionKind, string> = {
  great: '👍 Good choice', ok: '🙂 Okay', why: '🤔 Why so much?', talk: '💬 Let\'s talk about it',
};

const canManage = (actor: Member, target: Member) =>
  actor.accountId === target.accountId &&
  (actor.role === 'guardian' || actor.role === 'coguardian' || (actor.role === 'individual' && actor.id === target.id));

export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case 'award': {
      const target = memberOf(s, a.memberId);
      const actor = memberOf(s, a.actorId);
      if (!canManage(actor, target)) throw new ActionError('You are not allowed to change these points.');
      if (!Number.isFinite(a.points) || a.points <= 0 || a.points > 100) throw new ActionError('Points must be between 1 and 100.');
      if (a.kind === 'demerit' && target.role === 'child' && !a.description.trim()) throw new ActionError('A deduction needs a reason the child can read.');
      const acct = accountOf(s, target.accountId);
      const byOther = actor.id !== target.id;
      if (a.kind === 'demerit' && byOther && (a.reason ?? '').trim().length < 5) throw new ActionError('Give a reason or justification for this deduction.');
      if (a.proof && !checkProof(a.proof)) throw new ActionError('That proof link or photo is not valid.');
      if (a.kind === 'merit' && byOther && activityProofRequired(acct) && !a.proof) throw new ActionError('Add a photo, receipt or link as proof.');
      const needsApproval = a.kind === 'demerit' && actor.role === 'coguardian' && a.points > acct.approvalThreshold;
      const at = a.at ?? nowIso();
      const tx: Transaction = {
        id: uid('tx'), accountId: acct.id, memberId: target.id, type: a.kind,
        points: a.kind === 'merit' ? a.points : -a.points, category: a.category, description: a.description.trim(),
        ruleId: a.ruleId, actorId: actor.id, status: needsApproval ? 'pending' : 'posted', createdAt: at, cycle: cycleKey(at),
        ...(a.reason?.trim() ? { reason: a.reason.trim() } : {}), ...(a.proof ? { proof: a.proof } : {}),
      };
      let n: State = { ...s, transactions: [tx, ...s.transactions] };
      n = audit(n, acct.id, actor.id, needsApproval ? 'demerit.requested' : `${a.kind}.added`, 'transaction', tx.id, `${tx.points > 0 ? '+' : ''}${tx.points} ${target.name}: ${tx.description}`);
      if (target.id !== actor.id && !needsApproval) {
        n = notify(n, target.id, a.kind === 'merit' ? `+${a.points} points: ${tx.description}` : `−${a.points} points: ${tx.description}. You can ask about it if it seems unfair.`);
      }
      if (needsApproval) {
        s.members.filter((m) => m.accountId === acct.id && m.role === 'guardian').forEach((g) => {
          n = notify(n, g.id, `${actor.name} asked to deduct ${a.points} from ${target.name}. Needs your approval.`);
        });
      }
      return n;
    }
    case 'approveTx':
    case 'rejectTx': {
      const tx = s.transactions.find((t) => t.id === a.txId);
      if (!tx || tx.status !== 'pending') throw new ActionError('That request is no longer pending.');
      const actor = memberOf(s, a.actorId);
      if (actor.role !== 'guardian') throw new ActionError('Only a guardian can approve deductions.');
      const status = a.type === 'approveTx' ? 'posted' : 'rejected';
      let n: State = { ...s, transactions: s.transactions.map((t) => (t.id === tx.id ? { ...t, status, approvedBy: actor.id } : t)) };
      n = audit(n, tx.accountId, actor.id, `demerit.${status === 'posted' ? 'approved' : 'rejected'}`, 'transaction', tx.id, tx.description);
      if (status === 'posted') n = notify(n, tx.memberId, `${tx.points} points: ${tx.description}`);
      return n;
    }
    case 'reverse': {
      const tx = s.transactions.find((t) => t.id === a.txId);
      if (!tx || tx.status !== 'posted' || tx.type === 'reversal') throw new ActionError('Only a posted merit or demerit can be reversed.');
      if (s.transactions.some((t) => t.reversesId === tx.id && t.status === 'posted')) throw new ActionError('This transaction was already reversed.');
      const actor = memberOf(s, a.actorId);
      if (!canManage(actor, memberOf(s, tx.memberId))) throw new ActionError('You are not allowed to reverse this.');
      const pts = a.points ?? Math.abs(tx.points);
      if (pts <= 0 || pts > Math.abs(tx.points)) throw new ActionError('Reversal cannot exceed the original amount.');
      const at = nowIso();
      const rev: Transaction = {
        id: uid('tx'), accountId: tx.accountId, memberId: tx.memberId, type: 'reversal',
        points: tx.points > 0 ? -pts : pts, category: tx.category,
        description: `Correction: ${tx.description}${a.reason ? ` (${a.reason})` : ''}`,
        actorId: actor.id, status: 'posted', reversesId: tx.id, createdAt: at, cycle: cycleKey(at),
      };
      let n: State = { ...s, transactions: [rev, ...s.transactions] };
      n = audit(n, tx.accountId, actor.id, 'transaction.reversed', 'transaction', tx.id, `${rev.points > 0 ? '+' : ''}${rev.points}: ${a.reason}`);
      return n;
    }
    case 'raiseDispute': {
      const tx = s.transactions.find((t) => t.id === a.txId);
      if (!tx || tx.memberId !== a.memberId || tx.type !== 'demerit') throw new ActionError('You can only question your own deductions.');
      if (s.disputes.some((d) => d.txId === tx.id)) throw new ActionError('You already asked about this one.');
      const acct = accountOf(s, tx.accountId);
      if (Date.now() - new Date(tx.createdAt).getTime() > acct.disputeWindowDays * 86_400_000) throw new ActionError(`Questions must be raised within ${acct.disputeWindowDays} days.`);
      const d = { id: uid('dp'), txId: tx.id, memberId: a.memberId, reason: a.reason, note: a.note.trim(), status: 'open' as const, createdAt: nowIso() };
      let n: State = { ...s, disputes: [d, ...s.disputes] };
      n = audit(n, tx.accountId, a.memberId, 'dispute.raised', 'dispute', d.id, `${a.reason}: ${tx.description}`);
      const who = memberOf(s, a.memberId).name;
      s.members.filter((m) => m.accountId === tx.accountId && (m.role === 'guardian' || m.role === 'coguardian')).forEach((g) => {
        n = notify(n, g.id, `${who} questioned “${tx.description}”.`);
      });
      return n;
    }
    case 'resolveDispute': {
      const d = s.disputes.find((x) => x.id === a.disputeId);
      if (!d || d.status !== 'open') throw new ActionError('This dispute is already closed.');
      const actor = memberOf(s, a.actorId);
      if (actor.role !== 'guardian' && actor.role !== 'coguardian') throw new ActionError('Only guardians can resolve disputes.');
      if (!a.response.trim()) throw new ActionError('Please write a short reply for your child.');
      let n = s;
      const tx = s.transactions.find((t) => t.id === d.txId)!;
      if (a.outcome === 'reversed') n = reduce(n, { type: 'reverse', txId: d.txId, actorId: a.actorId, reason: 'dispute accepted' });
      if (a.outcome === 'partial') n = reduce(n, { type: 'reverse', txId: d.txId, actorId: a.actorId, reason: 'dispute partly accepted', points: a.refundPoints ?? Math.ceil(Math.abs(tx.points) / 2) });
      n = { ...n, disputes: n.disputes.map((x) => (x.id === d.id ? { ...x, status: a.outcome, response: a.response.trim(), resolvedBy: actor.id, resolvedAt: nowIso() } : x)) };
      n = audit(n, tx.accountId, actor.id, `dispute.${a.outcome}`, 'dispute', d.id, a.response);
      const words = { upheld: 'stays as it is', reversed: 'was given back', partial: 'was partly given back' }[a.outcome];
      return notify(n, d.memberId, `Your question about “${tx.description}”: the deduction ${words}. ${a.response}`);
    }
    case 'approveAllowance': {
      const actor = memberOf(s, a.actorId);
      const target = memberOf(s, a.memberId);
      if (actor.role !== 'guardian' || actor.accountId !== target.accountId) throw new ActionError('Only a guardian can approve allowance.');
      if (a.amount < 0) throw new ActionError('Allowance cannot be negative.');
      const cycleTx = new Set(s.transactions.filter((t) => t.memberId === a.memberId && t.cycle === a.cycle).map((t) => t.id));
      if (s.disputes.some((d) => d.status === 'open' && cycleTx.has(d.txId))) throw new ActionError('Resolve open disputes for this month first.');
      const existing = s.cycles.find((c) => c.memberId === a.memberId && c.month === a.cycle);
      if (existing && existing.status !== 'open') throw new ActionError('This month is already approved.');
      const cycle = {
        id: existing?.id ?? uid('cy'), memberId: a.memberId, month: a.cycle, status: 'approved' as const,
        proposed: a.proposed, approved: a.amount, savingsTransfer: a.savings, approvedBy: actor.id, approvedAt: nowIso(), note: a.note,
      };
      let n: State = { ...s, cycles: existing ? s.cycles.map((c) => (c.id === existing.id ? cycle : c)) : [cycle, ...s.cycles] };
      const today = new Date().toISOString().slice(0, 10);
      n = { ...n, money: [{ id: uid('mn'), memberId: a.memberId, kind: 'income', amount: a.amount, category: 'Allowance', note: `Allowance for ${a.cycle}`, date: today }, ...n.money] };
      const goal = n.goals.find((g) => g.memberId === a.memberId);
      if (goal && a.savings > 0) {
        n = { ...n, goals: n.goals.map((g) => (g.id === goal.id ? { ...g, saved: Math.round((g.saved + a.savings) * 100) / 100 } : g)) };
        n = { ...n, money: [{ id: uid('mn'), memberId: a.memberId, kind: 'saving', amount: a.savings, category: 'Savings', note: `Auto-save to ${goal.name}`, date: today, goalId: goal.id }, ...n.money] };
      }
      n = audit(n, target.accountId, actor.id, 'allowance.approved', 'cycle', cycle.id, `${target.name} ${a.cycle}: proposed ${a.proposed}, approved ${a.amount}`);
      return notify(n, target.id, `Your allowance for ${a.cycle} is approved: ${a.amount.toFixed(2)}.`);
    }
    case 'closeCycle': {
      const c = s.cycles.find((x) => x.memberId === a.memberId && x.month === a.cycle);
      if (!c || c.status !== 'approved') throw new ActionError('Approve the allowance before closing the month.');
      let n: State = { ...s, cycles: s.cycles.map((x) => (x.id === c.id ? { ...x, status: 'closed' } : x)) };
      return audit(n, memberOf(s, a.memberId).accountId, a.actorId, 'cycle.closed', 'cycle', c.id, a.cycle);
    }
    case 'updateAccount': {
      const actor = memberOf(s, a.actorId);
      if (actor.accountId !== a.accountId || !(actor.role === 'guardian' || actor.role === 'individual')) throw new ActionError('Only the account owner can change settings.');
      if (a.patch.rate !== undefined && !(a.patch.rate > 0)) throw new ActionError('Conversion rate must be above zero.');
      const n: State = { ...s, accounts: s.accounts.map((x) => (x.id === a.accountId ? { ...x, ...a.patch, allowance: { ...x.allowance, ...(a.patch.allowance ?? {}) } } : x)) };
      return audit(n, a.accountId, actor.id, 'settings.updated', 'account', a.accountId, Object.keys(a.patch).join(', '));
    }
    case 'saveRule': {
      if (!a.rule.name.trim()) throw new ActionError('Give the rule a name.');
      if (!(a.rule.points >= 1 && a.rule.points <= 50)) throw new ActionError('Rule points must be between 1 and 50.');
      const exists = s.rules.some((r) => r.id === a.rule.id);
      const n: State = { ...s, rules: exists ? s.rules.map((r) => (r.id === a.rule.id ? a.rule : r)) : [...s.rules, a.rule] };
      return audit(n, a.rule.accountId, a.actorId, exists ? 'rule.updated' : 'rule.created', 'rule', a.rule.id, `${a.rule.kind} ${a.rule.points}: ${a.rule.name}`);
    }
    case 'addMember': {
      if (!a.member.name.trim()) throw new ActionError('Name is required.');
      if (s.members.some((m) => m.accountId === a.member.accountId && m.name.toLowerCase() === a.member.name.trim().toLowerCase())) throw new ActionError('Someone with that name is already in the family.');
      const n: State = { ...s, members: [...s.members, { ...a.member, name: a.member.name.trim() }] };
      return audit(n, a.member.accountId, a.actorId, 'member.added', 'member', a.member.id, `${a.member.role}: ${a.member.name}`);
    }
    case 'updateMember': {
      const actor = memberOf(s, a.actorId);
      const target = memberOf(s, a.memberId);
      if (!(actor.id === target.id || (actor.role === 'guardian' && actor.accountId === target.accountId))) throw new ActionError('You cannot edit this profile.');
      const n: State = { ...s, members: s.members.map((m) => (m.id === target.id ? { ...m, ...a.patch } : m)) };
      return audit(n, target.accountId, actor.id, 'member.updated', 'member', target.id, Object.keys(a.patch).join(', '));
    }
    case 'saveGoal': {
      if (!a.goal.name.trim() || !(a.goal.target > 0)) throw new ActionError('A goal needs a name and an amount above zero.');
      const exists = s.goals.some((g) => g.id === a.goal.id);
      const n: State = { ...s, goals: exists ? s.goals.map((g) => (g.id === a.goal.id ? a.goal : g)) : [...s.goals, a.goal] };
      return audit(n, memberOf(s, a.goal.memberId).accountId, a.actorId, exists ? 'goal.updated' : 'goal.created', 'goal', a.goal.id, a.goal.name);
    }
    case 'contribute': {
      const g = s.goals.find((x) => x.id === a.goalId);
      if (!g) throw new ActionError('Goal not found.');
      if (!(a.amount > 0)) throw new ActionError('Enter an amount above zero.');
      let n: State = { ...s, goals: s.goals.map((x) => (x.id === g.id ? { ...x, saved: Math.round((x.saved + a.amount) * 100) / 100 } : x)) };
      n = { ...n, money: [{ id: uid('mn'), memberId: g.memberId, kind: 'saving', amount: a.amount, category: 'Savings', note: `Saved to ${g.name}`, date: new Date().toISOString().slice(0, 10), goalId: g.id }, ...n.money] };
      return audit(n, memberOf(s, g.memberId).accountId, a.actorId, 'goal.contribution', 'goal', g.id, `${a.amount}`);
    }
    case 'addMoney': {
      if (!(a.entry.amount > 0)) throw new ActionError('Enter an amount above zero.');
      if (a.entry.kind === 'expense') {
        if (!checkProof(a.entry.proof)) throw new ActionError('Add a photo of the receipt or item, or a link, for every purchase.');
        if (memberOf(s, a.entry.memberId).role === 'child' && !a.entry.mood) throw new ActionError('Pick how you feel about this purchase.');
      }
      const n: State = { ...s, money: [a.entry, ...s.money] };
      return audit(n, memberOf(s, a.entry.memberId).accountId, a.actorId, `money.${a.entry.kind}`, 'money', a.entry.id, `${a.entry.amount} ${a.entry.category}`);
    }
    case 'addAssessment': {
      const n: State = { ...s, assessments: [a.assessment, ...s.assessments.filter((x) => !(x.memberId === a.assessment.memberId && x.month === a.assessment.month))] };
      return audit(n, memberOf(s, a.assessment.memberId).accountId, a.actorId, 'assessment.saved', 'assessment', a.assessment.id, a.assessment.month);
    }
    case 'reactMoney': {
      const entry = s.money.find((m) => m.id === a.entryId);
      if (!entry) throw new ActionError('Unknown purchase.');
      const child = memberOf(s, entry.memberId);
      const actor = memberOf(s, a.actorId);
      if (!(actor.role === 'guardian' || actor.role === 'coguardian') || actor.accountId !== child.accountId) throw new ActionError('Only a guardian can react to purchases.');
      if ((a.kind === 'why' || a.kind === 'talk') && a.note !== undefined && a.note.length > 300) throw new ActionError('Keep the note under 300 characters.');
      const reaction = { kind: a.kind, note: a.note?.trim() || undefined, by: actor.id, at: nowIso() };
      let n: State = { ...s, money: s.money.map((m) => (m.id === entry.id ? { ...m, reaction } : m)) };
      n = audit(n, child.accountId, actor.id, 'money.reaction', 'money', entry.id, `${REACTION_TEXT[a.kind]} on ${entry.note || entry.category}`);
      return notify(n, child.id, `${actor.name} on “${entry.note || entry.category}”: ${REACTION_TEXT[a.kind]}${reaction.note ? ` “${reaction.note}”` : ''}`);
    }
    case 'replyMoney': {
      const entry = s.money.find((m) => m.id === a.entryId);
      if (!entry || entry.memberId !== a.memberId || !entry.reaction) throw new ActionError('Nothing to answer here.');
      if (!a.text.trim()) throw new ActionError('Write a short answer.');
      const child = memberOf(s, a.memberId);
      let n: State = { ...s, money: s.money.map((m) => (m.id === entry.id ? { ...m, reaction: { ...entry.reaction!, reply: a.text.trim(), replyAt: nowIso() } } : m)) };
      n = audit(n, child.accountId, child.id, 'money.reply', 'money', entry.id, a.text.trim());
      return notify(n, entry.reaction.by, `${child.name} answered about “${entry.note || entry.category}”: “${a.text.trim()}”`);
    }
    case 'checkIn': {
      const m = memberOf(s, a.memberId);
      const at = a.at ?? nowIso();
      const day = at.slice(0, 10);
      const rest = (s.moods ?? []).filter((x) => !(x.memberId === m.id && x.at.slice(0, 10) === day));
      const n: State = { ...s, moods: [{ id: uid('md'), memberId: m.id, mood: a.mood, note: a.note?.trim() || undefined, at }, ...rest] };
      return audit(n, m.accountId, m.id, 'mood.checkin', 'member', m.id, a.mood);
    }
    case 'readAll':
      return { ...s, notifications: s.notifications.map((x) => (x.memberId === a.memberId ? { ...x, read: true } : x)) };
    case 'reset':
      return seed();
    case 'replace':
      return a.state;
  }
}

/**
 * Holds the state for one signed-in account (or the demo). Every successful
 * action calls onChange, which the app uses to save.
 */
export function useStore(initial: State, onChange: (s: State) => void) {
  const [state, setState] = useState<State>(initial);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(state);
  ref.current = state;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  useEffect(() => { ref.current = initial; setState(initial); }, [initial]);
  const dispatch = useCallback((a: Action): boolean => {
    try {
      const next = reduce(ref.current, a);
      ref.current = next;
      setState(next);
      setError(null);
      changeRef.current(next);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, []);
  return { state, dispatch, error, setError };
}
