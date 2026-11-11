// Core domain model for Ritsu. Mirrors docs/04-data-model.md.

export type Role = 'guardian' | 'coguardian' | 'child' | 'individual';
export type Mode = 'family' | 'individual';

export interface AllowanceRules {
  /** Fixed amount paid every month regardless of points (currency units). */
  base: number;
  /** Bonus percentage applied to the points value when the merit share meets bonusMeritShare. */
  bonusPct: number;
  /** Merit share (0..1) of all points movements required to earn the bonus. */
  bonusMeritShare: number;
  /** Lowest allowance paid (currency units). */
  floor: number;
  /** Highest allowance paid (currency units). */
  cap: number;
  /** Share (0..1) of the approved allowance moved into savings automatically. */
  savingsPct: number;
}

export interface Account {
  id: string;
  mode: Mode;
  name: string;
  currency: string;
  /** Currency value of one point. Default 1 point = RM1. */
  rate: number;
  allowance: AllowanceRules;
  /** Co-guardian deductions above this many points need guardian approval. */
  approvalThreshold: number;
  /** Days a child has to dispute a deduction. */
  disputeWindowDays: number;
}

export interface Member {
  id: string;
  accountId: string;
  name: string;
  role: Role;
  avatar: string;
  age?: number;
  /** Monthly spending budget for individuals (currency units). */
  monthlyBudget?: number;
}

export type RuleKind = 'merit' | 'demerit';

export interface Rule {
  id: string;
  accountId: string;
  /** For individual habits, the member that owns the habit. */
  memberId?: string;
  name: string;
  kind: RuleKind;
  points: number;
  category: string;
  icon: string;
  recurring?: 'daily' | 'weekly' | null;
  active: boolean;
}

export type TxType = 'merit' | 'demerit' | 'reversal';
export type TxStatus = 'posted' | 'pending' | 'rejected';

/**
 * Every points movement. Append-only: a mistake is corrected by a reversal
 * transaction that references the original, never by editing it.
 */
export interface Transaction {
  id: string;
  accountId: string;
  memberId: string;
  type: TxType;
  /** Signed points. Merits positive, demerits negative, reversals the negation of the original. */
  points: number;
  category: string;
  description: string;
  ruleId?: string;
  /** Who recorded the transaction. */
  actorId: string;
  /** Who approved it, when approval was needed. */
  approvedBy?: string;
  status: TxStatus;
  reversesId?: string;
  createdAt: string; // ISO timestamp
  /** Cycle key, YYYY-MM. */
  cycle: string;
}

export type DisputeStatus = 'open' | 'upheld' | 'reversed' | 'partial';

export interface Dispute {
  id: string;
  txId: string;
  memberId: string;
  reason: string;
  note: string;
  status: DisputeStatus;
  response?: string;
  resolvedBy?: string;
  createdAt: string;
  resolvedAt?: string;
}

export type CycleStatus = 'open' | 'approved' | 'closed';

export interface Cycle {
  id: string;
  memberId: string;
  month: string; // YYYY-MM
  status: CycleStatus;
  proposed?: number;
  approved?: number;
  savingsTransfer?: number;
  approvedBy?: string;
  approvedAt?: string;
  note?: string;
}

export interface SavingsGoal {
  id: string;
  memberId: string;
  name: string;
  icon: string;
  target: number;
  saved: number;
  targetDate?: string;
}

export type MoneyKind = 'income' | 'expense' | 'saving';

export interface MoneyEntry {
  id: string;
  memberId: string;
  kind: MoneyKind;
  amount: number;
  category: string;
  note: string;
  date: string; // ISO date
  /** Whether the spender judged it a need or a want (financial discipline indicator). */
  need?: boolean;
  goalId?: string;
}

export interface Assessment {
  id: string;
  memberId: string;
  month: string;
  rating: number; // 1..5
  wentWell: string;
  improve: string;
  focus: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  accountId: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  detail: string;
  at: string;
}

export interface Notification {
  id: string;
  memberId: string;
  text: string;
  at: string;
  read: boolean;
}

export interface State {
  version: 1;
  accounts: Account[];
  members: Member[];
  rules: Rule[];
  transactions: Transaction[];
  disputes: Dispute[];
  cycles: Cycle[];
  goals: SavingsGoal[];
  money: MoneyEntry[];
  assessments: Assessment[];
  audit: AuditEntry[];
  notifications: Notification[];
}
