// Builds the starting state for a newly registered account.
import { DEMO_RULES, FAMILY, SOLO } from './seed';
import type { Account, Member, Rule, State } from './types';

export interface NewChild { name: string; age: number; avatar: string; pinHash?: string; pinSalt?: string }

export interface FamilySetup {
  userId: string;
  familyName: string;
  parentName: string;
  parentAvatar: string;
  parentPinHash?: string;
  parentPinSalt?: string;
  currency: string;
  rate: number;
  children: NewChild[];
}

const id = (p: string) => `${p}_${crypto.randomUUID().slice(0, 8)}`;

function empty(accounts: Account[], members: Member[], rules: Rule[], ownerId: string): State {
  const at = new Date().toISOString();
  return {
    version: 1, accounts, members, rules, transactions: [], disputes: [], cycles: [], goals: [], money: [], assessments: [],
    audit: [{ id: id('au'), accountId: accounts[0].id, actorId: ownerId, action: 'account.created', entity: 'account', entityId: accounts[0].id, detail: accounts[0].name, at }],
    notifications: [],
  };
}

export function newFamilyState(s: FamilySetup): State {
  const accountId = id('acc');
  const account: Account = {
    id: accountId, mode: 'family', name: s.familyName.trim() || `${s.parentName}'s family`, currency: s.currency.trim() || 'RM', rate: s.rate > 0 ? s.rate : 1,
    allowance: { base: 0, bonusPct: 10, bonusMeritShare: 0.8, floor: 0, cap: 50, savingsPct: 0.2 },
    approvalThreshold: 3, disputeWindowDays: 7,
  };
  const parent: Member = { id: id('m'), accountId, name: s.parentName.trim(), role: 'guardian', avatar: s.parentAvatar, pinHash: s.parentPinHash, pinSalt: s.parentPinSalt };
  const kids: Member[] = s.children.filter((c) => c.name.trim()).map((c) => ({ id: id('m'), accountId, name: c.name.trim(), role: 'child', avatar: c.avatar, age: c.age, pinHash: c.pinHash, pinSalt: c.pinSalt }));
  const rules = DEMO_RULES.filter((r) => r.accountId === FAMILY).map((r) => ({ ...r, id: id('r'), accountId }));
  const st = empty([account], [parent, ...kids], rules, parent.id);
  st.notifications = kids.map((k) => ({ id: id('nt'), memberId: k.id, text: `Welcome to Ritsu, ${k.name}! Earn points by doing good things every day. ⭐`, at: new Date().toISOString(), read: false }));
  return st;
}

export function newIndividualState(userId: string, name: string, avatar: string, currency: string, rate: number, budget: number): State {
  const accountId = id('acc');
  const account: Account = {
    id: accountId, mode: 'individual', name: name.trim(), currency: currency.trim() || 'RM', rate: rate > 0 ? rate : 0.5,
    allowance: { base: 0, bonusPct: 10, bonusMeritShare: 0.75, floor: 0, cap: 150, savingsPct: 0.5 },
    approvalThreshold: 0, disputeWindowDays: 0,
  };
  const me: Member = { id: id('m'), accountId, name: name.trim(), role: 'individual', avatar, monthlyBudget: budget };
  const rules = DEMO_RULES.filter((r) => r.accountId === SOLO).map((r) => ({ ...r, id: id('r'), accountId, memberId: me.id }));
  void userId;
  return empty([account], [me], rules, me.id);
}
