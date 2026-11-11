import { useMemo, useState } from 'react';
import {
  balance, categoryBreakdown, cycleKey, cycleLabel, isReversed, prevCycle, proposeAllowance, series, streak, summarise,
  type Granularity,
} from '../lib/logic';
import { activityProofRequired, uid } from '../lib/store';
import type { DisputeStatus, Member, MoneyEntry, Proof, ReactionKind, Role, RuleKind, Transaction } from '../lib/types';
import { moodOf, ProofInput, ProofView, REACTIONS } from '../components/evidence';
import { CategoryBars, DivergingBars, LineChart, Sparkline } from '../components/charts';
import { ago, Empty, money, PageHead, Seg, Sheet, signed, Stat, useApp } from '../components/ui';
import { AccountCard, PinEditor, RuleEditor, TxList } from './shared';
import { PlayMoneyNote } from './Auth';

const useFamily = () => {
  const { state, account } = useApp();
  const children = state.members.filter((m) => m.accountId === account.id && m.role === 'child');
  return { children, ids: children.map((c) => c.id) };
};

export function GuardianHome() {
  const { state, account, me, go, dispatch, toast } = useApp();
  const { children, ids } = useFamily();
  const cycle = cycleKey(new Date());
  const pending = state.transactions.filter((t) => t.accountId === account.id && t.status === 'pending');
  const disputes = state.disputes.filter((d) => d.status === 'open' && ids.includes(d.memberId));
  const fam = ids.map((id) => summarise(state.transactions, id, cycle));
  const merit = fam.reduce((a, s) => a + s.merit, 0);
  const demerit = fam.reduce((a, s) => a + s.demerit, 0);
  const payout = ids.reduce((a, id) => a + proposeAllowance(state, account, id, cycle).total, 0);
  const [resolving, setResolving] = useState<string | null>(null);
  const recent = state.transactions.filter((t) => ids.includes(t.memberId)).slice(0, 6);

  return (
    <>
      <PageHead kicker={account.name} title={`Hi ${me.name}`} lead={`${cycleLabel(cycle)} so far`}
        right={<button className="btn btn-primary" onClick={() => go('award')}>＋ Award or deduct</button>} />

      {(pending.length > 0 || disputes.length > 0) && (
        <div className="card" style={{ boxShadow: 'inset 4px 0 0 var(--primary), var(--e2)', marginBottom: 12 }}>
          <div className="card-head"><h3>Needs you</h3><span className="chip warn">{pending.length + disputes.length} waiting</span></div>
          <ul className="list">
            {pending.map((t) => {
              const who = state.members.find((m) => m.id === t.memberId);
              const by = state.members.find((m) => m.id === t.actorId);
              return (
                <li className="item" key={t.id}>
                  <div className="ic">⏳</div>
                  <div className="body">
                    <div className="t">{by?.name} wants to deduct {Math.abs(t.points)} from {who?.name}</div>
                    <div className="s">“{t.description}” · {ago(t.createdAt)}</div>
                    {me.role === 'guardian' ? (
                      <div className="row" style={{ marginTop: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'approveTx', txId: t.id, actorId: me.id }) && toast('Deduction approved')}>Approve</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'rejectTx', txId: t.id, actorId: me.id }) && toast('Deduction declined')}>Decline</button>
                      </div>
                    ) : <div className="s">Waiting for the main guardian.</div>}
                  </div>
                </li>
              );
            })}
            {disputes.map((d) => {
              const tx = state.transactions.find((t) => t.id === d.txId);
              const who = state.members.find((m) => m.id === d.memberId);
              return (
                <li className="item" key={d.id}>
                  <div className="ic">🙋</div>
                  <div className="body">
                    <div className="t">{who?.name} questioned “{tx?.description}”</div>
                    <div className="s">{d.reason}{d.note ? `: “${d.note}”` : ''} · {ago(d.createdAt)}</div>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => setResolving(d.id)}>Review</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid g4">
        <Stat label="Merit this month" value={<span className="pos">+{merit}</span>} sub={`${fam.reduce((a, s) => a + s.meritCount, 0)} good deeds logged`} />
        <Stat label="Demerit this month" value={<span className="neg">−{demerit}</span>} sub={`${fam.reduce((a, s) => a + s.demeritCount, 0)} deductions`} />
        <Stat label="Merit share" value={`${merit + demerit ? Math.round((merit / (merit + demerit)) * 100) : 0}%`} sub={`Bonus at ${Math.round(account.allowance.bonusMeritShare * 100)}%`} />
        <Stat label="Est. allowance" value={money(payout, account.currency)} sub="All children, this month" />
      </div>

      <h2 className="sec">Children</h2>
      <div className="grid md2">
        {children.map((c) => <ChildCard key={c.id} child={c} />)}
      </div>

      <SpendingReview ids={ids} />

      <h2 className="sec">Recent activity</h2>
      <div className="card"><TxList txs={recent} showWho /></div>
      {resolving && <ResolveSheet disputeId={resolving} onClose={() => setResolving(null)} />}
    </>
  );
}

function MoodLine({ memberId }: { memberId: string }) {
  const { state } = useApp();
  const last = (state.moods ?? []).find((m) => m.memberId === memberId);
  const mood = moodOf(last?.mood);
  const today = last && last.at.slice(0, 10) === new Date().toISOString().slice(0, 10);
  return (
    <div className="mood-line">
      {mood && last ? <><span aria-hidden="true">{mood.emoji}</span> <span>{mood.label}</span><span className="muted"> · {today ? 'today' : ago(last.at)}</span>{last.note && <span className="muted"> · “{last.note}”</span>}</>
        : <span className="muted">No mood check-in yet</span>}
    </div>
  );
}

/** Children's recent purchases with receipt, mood and the guardian's reaction. */
function SpendingReview({ ids }: { ids: string[] }) {
  const { state, account, me, dispatch, toast } = useApp();
  const [reacting, setReacting] = useState<{ entry: MoneyEntry; kind: ReactionKind } | null>(null);
  const [note, setNote] = useState('');
  const since = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
  const list = state.money.filter((m) => ids.includes(m.memberId) && m.kind === 'expense' && m.date >= since).slice(0, 8);
  const big = Math.max(5, account.allowance.cap * 0.25);
  const send = (entry: MoneyEntry, kind: ReactionKind, text?: string) => {
    if (dispatch({ type: 'reactMoney', entryId: entry.id, actorId: me.id, kind, note: text })) { toast('Sent to ' + (state.members.find((m) => m.id === entry.memberId)?.name ?? 'your child')); setReacting(null); setNote(''); }
  };
  return (
    <>
      <h2 className="sec">Spending</h2>
      <div className="card">
        <p className="small muted" style={{ marginTop: 0 }}>Every purchase comes with a receipt, photo or link and how your child felt. React so they learn what a good choice looks like.</p>
        {list.length ? <ul className="list">{list.map((m) => {
          const kid = state.members.find((x) => x.id === m.memberId);
          const mood = moodOf(m.mood);
          return (
            <li className="item" key={m.id} style={{ alignItems: 'flex-start' }}>
              <div className="ic">{kid?.avatar ?? '🛍️'}</div>
              <div className="body">
                <div className="t">{kid?.name} · {m.note || m.category}</div>
                <div className="s">{m.category} · {m.date} · {m.need ? 'needed it' : 'wanted it'}{mood ? ` · ${mood.emoji} ${mood.label}` : ''}{m.amount >= big && <> · <span className="chip warn">Big spend</span></>}</div>
                <div className="row" style={{ marginTop: 6 }}>{m.proof ? <ProofView proof={m.proof} /> : <span className="chip">No receipt (older entry)</span>}</div>
                {m.reaction ? (
                  <div className="bubble">
                    <b>{REACTIONS.find((r) => r.value === m.reaction!.kind)?.label}</b>{m.reaction.note && <> “{m.reaction.note}”</>}
                    {m.reaction.reply && <div className="reply">{kid?.name}: “{m.reaction.reply}”</div>}
                  </div>
                ) : (me.role === 'guardian' || me.role === 'coguardian') && (
                  <div className="react-row">
                    {REACTIONS.map((r) => <button key={r.value} className="btn btn-ghost btn-sm" onClick={() => (r.value === 'why' || r.value === 'talk' ? setReacting({ entry: m, kind: r.value }) : send(m, r.value))}>{r.label}</button>)}
                  </div>
                )}
              </div>
              <div className="pts" style={{ fontSize: 18 }}>−{money(m.amount, account.currency)}</div>
            </li>
          );
        })}</ul> : <Empty icon="🛍️" text="No purchases in the last three weeks." />}
      </div>
      {reacting && (
        <Sheet title={REACTIONS.find((r) => r.value === reacting.kind)!.label} onClose={() => setReacting(null)}>
          <p className="small muted" style={{ marginTop: 0 }}>{reacting.entry.note || reacting.entry.category}: {money(reacting.entry.amount, account.currency)}. Add a few words so your child knows what you mean.</p>
          <div className="field"><label htmlFor="rx">Message (optional)</label><textarea id="rx" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={reacting.kind === 'why' ? 'e.g. That is most of your week. What made it worth it?' : 'e.g. Let us look at your savings jar together tonight.'} /></div>
          <button className="btn btn-primary btn-block" onClick={() => send(reacting.entry, reacting.kind, note)}>Send</button>
        </Sheet>
      )}
    </>
  );
}

function ChildCard({ child }: { child: Member }) {
  const { state, account, go } = useApp();
  const cycle = cycleKey(new Date());
  const s = summarise(state.transactions, child.id, cycle);
  const p = proposeAllowance(state, account, child.id, cycle);
  const st = streak(state.transactions, child.id);
  const daily = series(state.transactions, [child.id], 'day', 14).map((d) => d.net);
  const goal = state.goals.find((g) => g.memberId === child.id);
  return (
    <div className="card">
      <div className="row-between">
        <div className="row"><span style={{ fontSize: 34 }}>{child.avatar}</span><div><b style={{ fontSize: 17 }}>{child.name}</b><div className="small muted">Age {child.age} · 🔥 {st}-day streak</div></div></div>
        <Sparkline values={daily} />
      </div>
      <MoodLine memberId={child.id} />
      <div className="grid g3" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginTop: 12 }}>
        <div><div className="kicker">Balance</div><div className="num" style={{ fontSize: 28 }}>{balance(state.transactions, child.id)}</div></div>
        <div><div className="kicker">Month</div><div className={`num ${s.net >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 28 }}>{signed(s.net)}</div></div>
        <div><div className="kicker">Allowance</div><div className="num" style={{ fontSize: 'clamp(20px, 5.5vw, 28px)', whiteSpace: 'nowrap' }}>{money(p.total, account.currency)}</div></div>
      </div>
      {goal && <div className="small muted" style={{ marginTop: 8 }}>{goal.icon} {goal.name}: {money(goal.saved, account.currency)} of {money(goal.target, account.currency)}</div>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => go('award', child.id)}>Award</button>
        <button className="btn btn-ghost btn-sm" onClick={() => go('reports', child.id)}>Report</button>
        <button className="btn btn-ghost btn-sm" onClick={() => go('activity', child.id)}>History</button>
      </div>
    </div>
  );
}

export function AwardView() {
  const { state, account, me, dispatch, toast, param } = useApp();
  const { children } = useFamily();
  const [memberId, setMemberId] = useState(param && children.some((c) => c.id === param) ? param : children[0]?.id);
  const [kind, setKind] = useState<RuleKind>('merit');
  const [ruleId, setRuleId] = useState<string | 'custom' | null>(null);
  const [customName, setCustomName] = useState('');
  const [customPts, setCustomPts] = useState(2);
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<Proof | undefined>();
  const [proofKey, setProofKey] = useState(0);
  const proofNeeded = kind === 'merit' && activityProofRequired(account);
  const rules = state.rules.filter((r) => r.accountId === account.id && r.active && r.kind === kind);
  const rule = rules.find((r) => r.id === ruleId);
  const pts = rule ? rule.points : customPts;
  const needsApproval = kind === 'demerit' && me.role === 'coguardian' && pts > account.approvalThreshold;
  const child = children.find((c) => c.id === memberId);
  const description = rule ? (note.trim() ? `${rule.name}: ${note.trim()}` : rule.name) : customName.trim();
  const canSubmit = !!memberId && (rule || (ruleId === 'custom' && customName.trim())) && (kind === 'merit' || note.trim().length >= 5) && (!proofNeeded || !!proof);

  const submit = () => {
    if (!memberId) return;
    if (kind === 'demerit' && note.trim().length < 5) { toast('Write a reason or justification your child will see'); return; }
    if (proofNeeded && !proof) { toast('Add a photo, receipt or link as proof'); return; }
    const title = rule ? rule.name : customName.trim();
    const ok = dispatch({ type: 'award', memberId, actorId: me.id, kind, points: pts, category: rule?.category ?? 'Other', description: kind === 'merit' ? (ruleId === 'custom' && note.trim() ? `${customName.trim()}: ${note.trim()}` : description) : title, ruleId: rule?.id, reason: kind === 'demerit' ? note.trim() : undefined, proof });
    if (ok) {
      toast(needsApproval ? 'Sent for approval' : kind === 'merit' ? `+${pts} for ${child?.name} 🎉` : `−${pts} recorded for ${child?.name}`);
      setRuleId(null); setNote(''); setCustomName(''); setProof(undefined); setProofKey((k) => k + 1);
    }
  };

  return (
    <>
      <PageHead kicker="Points" title="Award or deduct" lead="Pick a child, pick what happened, done." />
      <div className="card">
        <div className="field"><label>1. Who</label>
          <div className="member-pick">
            {children.map((c) => (
              <button key={c.id} className="pick" aria-pressed={c.id === memberId} onClick={() => setMemberId(c.id)}>
                <span className="e">{c.avatar}</span><span><span className="n">{c.name}</span><br /><span className="small muted">{balance(state.transactions, c.id)} pts</span></span>
              </button>
            ))}
          </div>
        </div>
        <div className="field"><label>2. Merit or demerit</label>
          <Seg<RuleKind> label="Merit or demerit" value={kind} onChange={(k) => { setKind(k); setRuleId(null); }} options={[{ value: 'merit', label: '＋ Merit' }, { value: 'demerit', label: '− Demerit' }]} />
        </div>
        <div className="field"><label>3. What happened</label>
          <div className="picker">
            {rules.map((r) => (
              <button key={r.id} className="pick" aria-pressed={r.id === ruleId} onClick={() => setRuleId(r.id)}>
                <span className="e">{r.icon}</span><span style={{ flex: 1 }}><span className="n">{r.name}</span><br /><span className="small muted">{r.category}</span></span>
                <span className={`p ${kind === 'merit' ? 'pos' : 'neg'}`}>{kind === 'merit' ? '+' : '−'}{r.points}</span>
              </button>
            ))}
            <button className="pick" aria-pressed={ruleId === 'custom'} onClick={() => setRuleId('custom')}><span className="e">✏️</span><span className="n">Something else</span></button>
          </div>
        </div>
        {ruleId === 'custom' && (
          <div className="grid g2">
            <div className="field"><label htmlFor="cn">Description</label><input id="cn" className="input" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="What happened?" /></div>
            <div className="field"><label htmlFor="cp">Points</label><input id="cp" className="input" type="number" min={1} max={100} value={customPts} onChange={(e) => setCustomPts(Number(e.target.value))} /></div>
          </div>
        )}
        <div className="field">
          <label htmlFor="note">{kind === 'demerit' ? '4. Reason or justification (required, your child will see it)' : '4. Note (optional)'}</label>
          <textarea id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'demerit' ? 'e.g. Played games past 9 pm after two reminders' : 'e.g. Without being asked!'} />
          {kind === 'demerit' && note.trim().length > 0 && note.trim().length < 5 && <span className="small" style={{ color: 'var(--danger)' }}>Please explain a little more.</span>}
        </div>
        <ProofInput key={`${kind}-${proofKey}`} id="aw-proof" value={proof} onChange={setProof} required={proofNeeded}
          label={kind === 'merit' ? '5. Proof: photo, receipt or link' : '5. Evidence: photo or link'} />
        {needsApproval && <div className="banner info">Deductions over {account.approvalThreshold} points from a co-guardian need the main guardian's approval. This will wait as a request.</div>}
        <button className="btn btn-primary btn-block" disabled={!canSubmit} onClick={submit}>
          {kind === 'merit' ? `Award +${pts || 0} to ${child?.name ?? '…'}` : `Deduct −${pts || 0} from ${child?.name ?? '…'}`}
        </button>
        <p className="small muted" style={{ marginBottom: 0 }}>Every entry is saved with the time, the category and your name. Mistakes are fixed with a correction, never deleted.</p>
      </div>
    </>
  );
}

export function ActivityView() {
  const { state, me, param, account } = useApp();
  const { children, ids } = useFamily();
  const [who, setWho] = useState<string>(param && ids.includes(param) ? param : 'all');
  const [filter, setFilter] = useState<'all' | 'merit' | 'demerit' | 'disputes' | 'pending'>('all');
  const [reversing, setReversing] = useState<Transaction | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const disputed = new Set(state.disputes.map((d) => d.txId));
  const list = state.transactions.filter((t) => (who === 'all' ? ids.includes(t.memberId) : t.memberId === who))
    .filter((t) => filter === 'all' || (filter === 'disputes' ? disputed.has(t.id) : filter === 'pending' ? t.status === 'pending' : t.type === filter))
    .slice(0, 80);
  const canEdit = me.role === 'guardian' || me.role === 'coguardian';
  return (
    <>
      <PageHead kicker={account.name} title="Points history" lead="The full ledger. Corrections appear as new entries so nothing is hidden." />
      <div className="row" style={{ marginBottom: 12 }}>
        <select className="input" style={{ width: 'auto' }} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter by child">
          <option value="all">All children</option>
          {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter by type">
          <option value="all">Everything</option><option value="merit">Merits</option><option value="demerit">Demerits</option><option value="disputes">Questioned</option><option value="pending">Waiting approval</option>
        </select>
      </div>
      <div className="card">
        <TxList txs={list} showWho={who === 'all'} empty="No entries match." renderActions={(t) => {
          const d = state.disputes.find((x) => x.txId === t.id);
          return (
            <>
              {d && <div className="small" style={{ marginTop: 6, padding: 8, background: 'var(--card-2)', borderRadius: 6 }}>🙋 “{d.note || d.reason}”{d.response && <><br />↳ {d.response}</>}</div>}
              {canEdit && (
                <div className="row" style={{ marginTop: 6 }}>
                  {d?.status === 'open' && <button className="btn btn-primary btn-sm" onClick={() => setResolving(d.id)}>Review question</button>}
                  {t.status === 'posted' && t.type !== 'reversal' && !isReversed(state.transactions, t.id) && <button className="btn btn-ghost btn-sm" onClick={() => setReversing(t)}>Correct</button>}
                </div>
              )}
            </>
          );
        }} />
      </div>
      {reversing && <ReverseSheet tx={reversing} onClose={() => setReversing(null)} />}
      {resolving && <ResolveSheet disputeId={resolving} onClose={() => setResolving(null)} />}
    </>
  );
}

function ReverseSheet({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { me, dispatch, toast } = useApp();
  const [reason, setReason] = useState('');
  return (
    <Sheet title="Correct this entry" onClose={onClose}>
      <p className="small muted">This adds a correction of {signed(-tx.points)} points. The original stays in the history, marked as corrected.</p>
      <p><b>{tx.description}</b> ({signed(tx.points)})</p>
      <div className="field"><label htmlFor="rs">Why are you correcting it?</label><input id="rs" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Logged for the wrong child" /></div>
      <button className="btn btn-primary btn-block" disabled={!reason.trim()} onClick={() => { if (dispatch({ type: 'reverse', txId: tx.id, actorId: me.id, reason })) { toast('Correction added'); onClose(); } }}>Add correction</button>
    </Sheet>
  );
}

function ResolveSheet({ disputeId, onClose }: { disputeId: string; onClose: () => void }) {
  const { state, me, dispatch, toast } = useApp();
  const d = state.disputes.find((x) => x.id === disputeId)!;
  const tx = state.transactions.find((t) => t.id === d.txId)!;
  const who = state.members.find((m) => m.id === d.memberId);
  const [outcome, setOutcome] = useState<Exclude<DisputeStatus, 'open'>>('reversed');
  const [response, setResponse] = useState('');
  const [refund, setRefund] = useState(Math.ceil(Math.abs(tx.points) / 2));
  return (
    <Sheet title={`${who?.name}'s question`} onClose={onClose}>
      <div className="banner"><div><b>{tx.description}</b> ({signed(tx.points)}) · {ago(tx.createdAt)}<br /><span className="muted small">{d.reason}{d.note && `: “${d.note}”`}</span></div></div>
      <div className="field"><label>Decision</label>
        <Seg label="Decision" value={outcome} onChange={setOutcome} options={[{ value: 'reversed', label: 'Give back' }, { value: 'partial', label: 'Partly' }, { value: 'upheld', label: 'Keep it' }]} />
      </div>
      {outcome === 'partial' && <div className="field"><label htmlFor="rf">Points to give back</label><input id="rf" className="input" type="number" min={1} max={Math.abs(tx.points)} value={refund} onChange={(e) => setRefund(Number(e.target.value))} /></div>}
      <div className="field"><label htmlFor="resp">Reply to {who?.name} (required)</label><textarea id="resp" className="input" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Explain your decision kindly" /></div>
      <button className="btn btn-primary btn-block" disabled={!response.trim()} onClick={() => { if (dispatch({ type: 'resolveDispute', disputeId, actorId: me.id, outcome, response, refundPoints: refund })) { toast('Reply sent'); onClose(); } }}>Send decision</button>
    </Sheet>
  );
}

export function AllowanceView() {
  const { account, me } = useApp();
  const { children } = useFamily();
  const cur = cycleKey(new Date());
  const [cycle, setCycle] = useState(cur);
  const months = [cur, prevCycle(cur), prevCycle(prevCycle(cur))];
  return (
    <>
      <PageHead kicker="Monthly cycle" title="Allowance" lead={`1 point = ${money(account.rate, account.currency)} in play money. Review the proposal, adjust if needed, approve.`}
        right={<select className="input" style={{ width: 'auto' }} value={cycle} onChange={(e) => setCycle(e.target.value)} aria-label="Month">{months.map((m) => <option key={m} value={m}>{cycleLabel(m)}</option>)}</select>} />
      <PlayMoneyNote />
      <div className="grid md2">
        {children.map((c) => <AllowanceCard key={`${c.id}-${cycle}`} child={c} cycle={cycle} />)}
      </div>
      <p className="small muted">Rules: base {money(account.allowance.base, account.currency)} + points value + {account.allowance.bonusPct}% bonus when merits are at least {Math.round(account.allowance.bonusMeritShare * 100)}% of all points, kept between {money(account.allowance.floor, account.currency)} and {money(account.allowance.cap, account.currency)}; {Math.round(account.allowance.savingsPct * 100)}% goes to savings. Change these in Settings.</p>
      {me.role !== 'guardian' && <div className="banner">Only the main guardian can approve allowances.</div>}
    </>
  );
}

function AllowanceCard({ child, cycle }: { child: Member; cycle: string }) {
  const { state, account, me, dispatch, toast } = useApp();
  const p = proposeAllowance(state, account, child.id, cycle);
  const c = state.cycles.find((x) => x.memberId === child.id && x.month === cycle);
  const [amount, setAmount] = useState(p.total);
  const [note, setNote] = useState('');
  const cur = account.currency;
  const isCurrent = cycle === cycleKey(new Date());
  const status = c?.status ?? 'open';
  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 8 }}>
        <div className="row"><span style={{ fontSize: 30 }}>{child.avatar}</span><b style={{ fontSize: 17 }}>{child.name}</b></div>
        <span className={`chip ${status === 'open' ? 'warn' : 'ok'}`}>{status === 'open' ? (isCurrent ? 'In progress' : 'Ready to approve') : status === 'approved' ? 'Approved' : 'Closed'}</span>
      </div>
      <div className="formula">
        <div className="ln"><span>Base allowance</span><span className="num">{money(p.base, cur)}</span></div>
        <div className="ln"><span>Net points {p.netPoints} × {money(p.rate, cur)}</span><span className="num">{money(p.pointsValue, cur)}</span></div>
        <div className="ln"><span>Good-month bonus {p.bonusEarned ? `(${Math.round(p.meritShare * 100)}% merits)` : `(needs ${Math.round(account.allowance.bonusMeritShare * 100)}%, has ${Math.round(p.meritShare * 100)}%)`}</span><span className="num">{money(p.bonus, cur)}</span></div>
        {p.clampedBy && <div className="ln"><span>Limited by {p.clampedBy === 'cap' ? 'monthly cap' : 'minimum'}</span><span className="num">{p.clampedBy === 'cap' ? `max ${money(p.cap, cur)}` : `min ${money(p.floor, cur)}`}</span></div>}
        <div className="ln total"><span>Proposed</span><span className="num" style={{ fontSize: 24 }}>{money(p.total, cur)}</span></div>
        <div className="small muted">{money(p.savings, cur)} to savings · {money(p.spendable, cur)} to spend</div>
      </div>
      {p.pendingCount > 0 && <div className="banner" style={{ marginTop: 12 }}>⏳ {p.pendingCount} deduction waiting for approval is not counted yet.</div>}
      {p.openDisputes > 0 && <div className="banner err" style={{ marginTop: 12 }}>🙋 {p.openDisputes} open question must be answered before approving.</div>}
      {status === 'open' && me.role === 'guardian' && (
        <div style={{ marginTop: 12 }}>
          <div className="grid g2">
            <div className="field"><label htmlFor={`a-${child.id}`}>Final amount ({cur})</label><input id={`a-${child.id}`} className="input" type="number" min={0} step="0.5" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
            <div className="field"><label htmlFor={`n-${child.id}`}>Note (if adjusted)</label><input id={`n-${child.id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></div>
          </div>
          <button className="btn btn-primary btn-block" disabled={p.openDisputes > 0 || (amount !== p.total && !note.trim())}
            onClick={() => { const savings = Math.round(amount * account.allowance.savingsPct * 100) / 100; if (dispatch({ type: 'approveAllowance', memberId: child.id, cycle, proposed: p.total, amount, savings, actorId: me.id, note })) toast(`Approved ${money(amount, cur)} for ${child.name}`); }}>
            Approve {money(amount || 0, cur)}
          </button>
          {amount !== p.total && !note.trim() && <p className="small muted">Add a note when you change the proposed amount, so the decision is transparent.</p>}
          {isCurrent && <p className="small muted">The month is still running; approving now locks this amount.</p>}
        </div>
      )}
      {c && c.status !== 'open' && (
        <div style={{ marginTop: 12 }}>
          <div className="small">Approved <b>{money(c.approved ?? 0, cur)}</b>{c.approved !== c.proposed ? ` (proposed ${money(c.proposed ?? 0, cur)})` : ''} by {state.members.find((m) => m.id === c.approvedBy)?.name} · {c.approvedAt && ago(c.approvedAt)}{c.note ? ` · “${c.note}”` : ''}</div>
          {c.status === 'approved' && me.role === 'guardian' && <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => dispatch({ type: 'closeCycle', memberId: child.id, cycle, actorId: me.id }) && toast('Month closed and archived')}>Close month</button>}
        </div>
      )}
    </div>
  );
}

const GRAN: Record<Granularity, number> = { day: 14, week: 8, month: 6 };

export function ReportsView() {
  const { state, account, param } = useApp();
  const { children, ids } = useFamily();
  const [who, setWho] = useState(param && ids.includes(param) ? param : 'all');
  const [g, setG] = useState<Granularity>('day');
  const sel = who === 'all' ? ids : [who];
  const data = useMemo(() => series(state.transactions, sel, g, GRAN[g]), [state.transactions, sel.join(), g]);
  const cur = cycleKey(new Date());
  const prev = prevCycle(cur);
  const sum = (c: string) => sel.map((id) => summarise(state.transactions, id, c)).reduce((a, s) => ({ merit: a.merit + s.merit, demerit: a.demerit + s.demerit }), { merit: 0, demerit: 0 });
  const now = sum(cur), before = sum(prev);
  const share = (x: { merit: number; demerit: number }) => (x.merit + x.demerit ? Math.round((x.merit / (x.merit + x.demerit)) * 100) : 0);
  const cats = categoryBreakdown(state.transactions, sel, cur);
  const daily30 = series(state.transactions, sel, 'day', 30);
  let run = 0;
  const cumulative = daily30.map((d) => ({ label: d.key.slice(5).replace('-', '/'), value: (run += d.net) }));
  const topMerit = [...cats].sort((a, b) => b.merit - a.merit)[0];
  const topDemerit = [...cats].sort((a, b) => b.demerit - a.demerit)[0];
  const delta = share(now) - share(before);
  return (
    <>
      <PageHead kicker="Analytics" title="Reports" lead={`${cycleLabel(cur)} compared with ${cycleLabel(prev)}`} />
      <div className="row" style={{ marginBottom: 12 }}>
        <select className="input" style={{ width: 'auto' }} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Child"><option value="all">All children</option>{children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <Seg label="Period" value={g} onChange={setG} options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />
      </div>
      <div className="grid g4">
        <Stat label="Merit" value={<span className="pos">+{now.merit}</span>} sub={`Last month +${before.merit}`} />
        <Stat label="Demerit" value={<span className="neg">−{now.demerit}</span>} sub={`Last month −${before.demerit}`} />
        <Stat label="Merit share" value={`${share(now)}%`} sub={`${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} pts vs last month`} />
        <Stat label="Net points" value={signed(now.merit - now.demerit)} sub={`Last month ${signed(before.merit - before.demerit)}`} />
      </div>
      <div className="grid lg3" style={{ marginTop: 12 }}>
        <div className="card"><div className="card-head"><h3>Merit vs demerit, {g === 'day' ? 'last 14 days' : g === 'week' ? 'last 8 weeks' : 'last 6 months'}</h3></div><DivergingBars data={data} /></div>
        <div className="card">
          <h3>Insights</h3>
          <ul className="list small">
            {topMerit && <li className="item"><div className="ic">🌟</div><div className="body"><div className="t">Strongest area: {topMerit.category}</div><div className="s">+{topMerit.merit} points this month</div></div></li>}
            {topDemerit && topDemerit.demerit > 0 && <li className="item"><div className="ic">🎯</div><div className="body"><div className="t">Work on: {topDemerit.category}</div><div className="s">−{topDemerit.demerit} points this month</div></div></li>}
            <li className="item"><div className="ic">{delta >= 0 ? '📈' : '📉'}</div><div className="body"><div className="t">{delta >= 0 ? 'Improving' : 'Slipping'} vs last month</div><div className="s">Merit share {share(before)}% → {share(now)}%</div></div></li>
          </ul>
        </div>
      </div>
      <div className="grid md2" style={{ marginTop: 12 }}>
        <div className="card"><h3>Running net points, last 30 days</h3><LineChart points={cumulative} label="Cumulative net points over 30 days" /></div>
        <div className="card"><h3>By category, this month</h3>{cats.length ? <CategoryBars rows={cats} /> : <Empty icon="📊" text="No points yet this month." />}</div>
      </div>
      <h2 className="sec">Monthly comparison</h2>
      <div className="card scroll-x">
        <table className="tbl">
          <thead><tr><th>Child</th><th>Month</th><th className="r">Merit</th><th className="r">Demerit</th><th className="r">Net</th><th className="r">Allowance</th></tr></thead>
          <tbody>
            {children.flatMap((c) => [cur, prev].map((m) => {
              const s = summarise(state.transactions, c.id, m);
              const cyc = state.cycles.find((x) => x.memberId === c.id && x.month === m);
              const val = cyc?.approved ?? proposeAllowance(state, account, c.id, m).total;
              return <tr key={c.id + m}><td>{c.avatar} {c.name}</td><td>{cycleLabel(m)}</td><td className="r pos">+{s.merit}</td><td className="r neg">−{s.demerit}</td><td className="r">{signed(s.net)}</td><td className="r">{money(val, account.currency)}{cyc ? '' : ' (est.)'}</td></tr>;
            }))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function SettingsView() {
  const { state, account, me, dispatch, toast } = useApp();
  const [a, setA] = useState(account);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [adding, setAdding] = useState(false);
  const [pinFor, setPinFor] = useState<Member | null>(null);
  const rules = state.rules.filter((r) => r.accountId === account.id);
  const members = state.members.filter((m) => m.accountId === account.id);
  const isOwner = me.role === 'guardian';
  const num = (v: string) => (v === '' ? 0 : Number(v));
  return (
    <>
      <PageHead kicker={account.name} title="Settings" lead="Conversion, allowance rules, household rules and members." />
      {!isOwner && <div className="banner">Only the main guardian can change settings. You can view them.</div>}
      <div className="grid md2">
        <div className="card">
          <h3>Points and money</h3>
          <div className="grid g2">
            <div className="field"><label htmlFor="cur">Currency</label><input id="cur" className="input" value={a.currency} disabled={!isOwner} onChange={(e) => setA({ ...a, currency: e.target.value })} /></div>
            <div className="field"><label htmlFor="rate">Value of 1 point (play money)</label><input id="rate" className="input" type="number" step="0.05" min={0.05} value={a.rate} disabled={!isOwner} onChange={(e) => setA({ ...a, rate: num(e.target.value) })} /></div>
            <div className="field"><label htmlFor="base">Base allowance</label><input id="base" className="input" type="number" min={0} value={a.allowance.base} disabled={!isOwner} onChange={(e) => setA({ ...a, allowance: { ...a.allowance, base: num(e.target.value) } })} /></div>
            <div className="field"><label htmlFor="bonus">Bonus %</label><input id="bonus" className="input" type="number" min={0} max={100} value={a.allowance.bonusPct} disabled={!isOwner} onChange={(e) => setA({ ...a, allowance: { ...a.allowance, bonusPct: num(e.target.value) } })} /></div>
            <div className="field"><label htmlFor="share">Bonus needs merit share %</label><input id="share" className="input" type="number" min={0} max={100} value={Math.round(a.allowance.bonusMeritShare * 100)} disabled={!isOwner} onChange={(e) => setA({ ...a, allowance: { ...a.allowance, bonusMeritShare: num(e.target.value) / 100 } })} /></div>
            <div className="field"><label htmlFor="save">Auto-save %</label><input id="save" className="input" type="number" min={0} max={100} value={Math.round(a.allowance.savingsPct * 100)} disabled={!isOwner} onChange={(e) => setA({ ...a, allowance: { ...a.allowance, savingsPct: num(e.target.value) / 100 } })} /></div>
            <div className="field"><label htmlFor="floor">Minimum</label><input id="floor" className="input" type="number" min={0} value={a.allowance.floor} disabled={!isOwner} onChange={(e) => setA({ ...a, allowance: { ...a.allowance, floor: num(e.target.value) } })} /></div>
            <div className="field"><label htmlFor="cap">Maximum</label><input id="cap" className="input" type="number" min={0} value={a.allowance.cap} disabled={!isOwner} onChange={(e) => setA({ ...a, allowance: { ...a.allowance, cap: num(e.target.value) } })} /></div>
            <div className="field"><label htmlFor="thr">Co-guardian approval above (pts)</label><input id="thr" className="input" type="number" min={0} value={a.approvalThreshold} disabled={!isOwner} onChange={(e) => setA({ ...a, approvalThreshold: num(e.target.value) })} /></div>
            <div className="field"><label htmlFor="win">Dispute window (days)</label><input id="win" className="input" type="number" min={1} value={a.disputeWindowDays} disabled={!isOwner} onChange={(e) => setA({ ...a, disputeWindowDays: num(e.target.value) })} /></div>
          </div>
          <label className="check"><input type="checkbox" checked={a.requireActivityProof ?? true} disabled={!isOwner} onChange={(e) => setA({ ...a, requireActivityProof: e.target.checked })} /> Every merit award needs a photo, receipt or link as proof</label>
          <p className="small muted" style={{ marginTop: 4 }}>Purchases always need a receipt, and deductions always need a written reason.</p>
          {isOwner && <button className="btn btn-primary" onClick={() => dispatch({ type: 'updateAccount', accountId: account.id, actorId: me.id, patch: a }) && toast('Settings saved')}>Save settings</button>}
        </div>
        <div className="card">
          <div className="card-head"><h3>Family members</h3>{isOwner && <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>＋ Add</button>}</div>
          <ul className="list">
            {members.map((m) => <li className="item" key={m.id}><div className="ic">{m.avatar}</div><div className="body"><div className="t">{m.name}</div><div className="s">{roleName(m.role)}{m.age ? ` · age ${m.age}` : ''}{m.pinHash ? ' · 🔒 PIN set' : ''}</div></div>{isOwner && <button className="btn btn-ghost btn-sm" onClick={() => setPinFor(m)}>{m.pinHash ? 'Change PIN' : 'Set PIN'}</button>}</li>)}
          </ul>
        </div>
      </div>
      <h2 className="sec">Household rules</h2>
      <div className="card">
        <div className="card-head"><span className="small muted">Children can see these rules before they apply.</span>{isOwner && <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>＋ New rule</button>}</div>
        <ul className="list">
          {rules.map((r) => (
            <li className="item" key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
              <div className="ic">{r.icon}</div>
              <div className="body"><div className="t">{r.name}</div><div className="s">{r.category}{r.recurring ? ` · ${r.recurring}` : ''}{r.active ? '' : ' · inactive'}</div></div>
              <div className={`pts ${r.kind === 'merit' ? 'pos' : 'neg'}`}>{r.kind === 'merit' ? '+' : '−'}{r.points}</div>
              {isOwner && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(r.id)}>Edit</button>}
            </li>
          ))}
        </ul>
      </div>
      <AuditCard />
      <AccountCard />
      {editing && <RuleEditor accountId={account.id} initial={editing === 'new' ? undefined : rules.find((r) => r.id === editing)} onDone={() => setEditing(null)} />}
      {adding && <AddMemberSheet onClose={() => setAdding(false)} />}
      {pinFor && <PinEditor member={pinFor} onClose={() => setPinFor(null)} />}
    </>
  );
}

export const roleName = (r: Role) => ({ guardian: 'Main guardian', coguardian: 'Co-guardian', child: 'Child', individual: 'Individual' })[r];

function AddMemberSheet({ onClose }: { onClose: () => void }) {
  const { account, me, dispatch, toast } = useApp();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('child');
  const [age, setAge] = useState(8);
  const [avatar, setAvatar] = useState('🐼');
  return (
    <Sheet title="Add a family member" onClose={onClose}>
      <div className="field"><label>Role</label><Seg<Role> label="Role" value={role} onChange={setRole} options={[{ value: 'child', label: 'Child' }, { value: 'coguardian', label: 'Co-guardian' }]} /></div>
      <div className="field"><label htmlFor="mn">Name</label><input id="mn" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      {role === 'child' && <div className="field"><label htmlFor="ma">Age</label><input id="ma" className="input" type="number" min={3} max={21} value={age} onChange={(e) => setAge(Number(e.target.value))} /></div>}
      <div className="field"><label>Avatar</label><div className="row">{['🐼', '🦁', '🐯', '🐸', '🐙', '🦄', '🐧', '👩🏽', '👨🏽'].map((x) => <button key={x} className="icon-btn" style={{ borderColor: avatar === x ? 'var(--primary)' : undefined, borderWidth: avatar === x ? 2 : 1 }} onClick={() => setAvatar(x)}>{x}</button>)}</div></div>
      <p className="small muted">In the full product they receive a 6-digit family code (valid 48 hours) to sign in on their own device.</p>
      <button className="btn btn-primary btn-block" onClick={() => { if (dispatch({ type: 'addMember', actorId: me.id, member: { id: uid('m'), accountId: account.id, name, role, avatar, age: role === 'child' ? age : undefined } })) { toast(`${name} added`); onClose(); } }}>Add member</button>
    </Sheet>
  );
}

export function AuditCard() {
  const { state, account } = useApp();
  const [open, setOpen] = useState(false);
  const list = state.audit.filter((a) => a.accountId === account.id).slice(0, open ? 60 : 8);
  return (
    <>
      <h2 className="sec">Audit log</h2>
      <div className="card scroll-x">
        <table className="tbl">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>{list.map((x) => <tr key={x.id}><td style={{ whiteSpace: 'nowrap' }}>{ago(x.at)}</td><td>{state.members.find((m) => m.id === x.actorId)?.name}</td><td><code>{x.action}</code></td><td>{x.detail}</td></tr>)}</tbody>
        </table>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Show more'}</button>
      </div>
    </>
  );
}
