import { useState } from 'react';
import { isReversed } from '../lib/logic';
import type { Rule, RuleKind, Transaction } from '../lib/types';
import { ago, Empty, Seg, Sheet, signed, useApp } from '../components/ui';

export function TxItem({ tx, showWho, actions }: { tx: Transaction; showWho?: boolean; actions?: React.ReactNode }) {
  const { state } = useApp();
  const rule = state.rules.find((r) => r.id === tx.ruleId);
  const actor = state.members.find((m) => m.id === tx.actorId);
  const who = state.members.find((m) => m.id === tx.memberId);
  const reversed = isReversed(state.transactions, tx.id);
  const dispute = state.disputes.find((d) => d.txId === tx.id);
  const icon = tx.type === 'reversal' ? '↩️' : rule?.icon ?? (tx.type === 'merit' ? '⭐' : '⚠️');
  return (
    <li className={`item ${reversed ? 'reversed' : ''}`}>
      <div className="ic" aria-hidden="true">{icon}</div>
      <div className="body">
        <div className="t">{showWho && who ? `${who.name} · ` : ''}{tx.description}</div>
        <div className="s">
          {tx.category} · {ago(tx.createdAt)}{actor && actor.id !== tx.memberId ? ` · by ${actor.name}` : ''}
          {tx.status === 'pending' && <> · <span className="chip warn">Waiting for approval</span></>}
          {tx.status === 'rejected' && <> · <span className="chip">Not approved</span></>}
          {reversed && <> · <span className="chip">Corrected</span></>}
          {dispute && <> · <span className={`chip ${dispute.status === 'open' ? 'warn' : dispute.status === 'upheld' ? '' : 'ok'}`}>{dispute.status === 'open' ? 'Question open' : `Question ${dispute.status}`}</span></>}
        </div>
        {actions}
      </div>
      <div className={`pts ${tx.points > 0 ? 'pos' : 'neg'}`} style={{ opacity: tx.status === 'posted' ? 1 : 0.5 }}>{signed(tx.points)}</div>
    </li>
  );
}

export function TxList({ txs, showWho, empty = 'Nothing yet', renderActions }: { txs: Transaction[]; showWho?: boolean; empty?: string; renderActions?: (t: Transaction) => React.ReactNode }) {
  if (!txs.length) return <Empty icon="🗒️" text={empty} />;
  return <ul className="list">{txs.map((t) => <TxItem key={t.id} tx={t} showWho={showWho} actions={renderActions?.(t)} />)}</ul>;
}

export function NotificationsSheet({ onClose }: { onClose: () => void }) {
  const { state, me, dispatch } = useApp();
  const list = state.notifications.filter((n) => n.memberId === me.id).slice(0, 30);
  return (
    <Sheet title="Notifications" onClose={() => { dispatch({ type: 'readAll', memberId: me.id }); onClose(); }}>
      {list.length ? (
        <ul className="list">
          {list.map((n) => (
            <li key={n.id} className="item">
              <div className="ic">{n.read ? '🔔' : '🔴'}</div>
              <div className="body"><div className="t" style={{ fontWeight: n.read ? 500 : 700 }}>{n.text}</div><div className="s">{ago(n.at)}</div></div>
            </li>
          ))}
        </ul>
      ) : <Empty icon="🔕" text="You're all caught up." />}
    </Sheet>
  );
}

const CATEGORIES = ['Chores', 'Study', 'Reading', 'Kindness', 'Health', 'Routine', 'Respect', 'Screen time', 'Money', 'Growth', 'Focus', 'Other'];
const ICONS = ['⭐', '🧹', '📚', '📝', '🤝', '⚽', '🍽️', '⏰', '📱', '💰', '🏋️', '😴', '🛍️', '🗯️', '🎯', '🌱'];

export function RuleEditor({ initial, accountId, memberId, onDone }: { initial?: Rule; accountId: string; memberId?: string; onDone: () => void }) {
  const { me, dispatch, toast } = useApp();
  const [r, setR] = useState<Rule>(initial ?? { id: `r_${Date.now().toString(36)}`, accountId, memberId, name: '', kind: 'merit', points: 2, category: 'Chores', icon: '⭐', recurring: null, active: true });
  return (
    <Sheet title={initial ? 'Edit rule' : 'New rule'} onClose={onDone}>
      <div className="field"><label>Type</label>
        <Seg<RuleKind> label="Rule type" value={r.kind} onChange={(kind) => setR({ ...r, kind })} options={[{ value: 'merit', label: memberId ? 'Good habit' : 'Merit' }, { value: 'demerit', label: memberId ? 'Habit to break' : 'Demerit' }]} />
      </div>
      <div className="field"><label htmlFor="rn">Name</label><input id="rn" className="input" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder={r.kind === 'merit' ? 'e.g. Fed the cat' : 'e.g. Left lights on'} /></div>
      <div className="grid g2">
        <div className="field"><label htmlFor="rp">Points (1 to 50)</label><input id="rp" className="input" type="number" min={1} max={50} value={r.points} onChange={(e) => setR({ ...r, points: Number(e.target.value) })} /></div>
        <div className="field"><label htmlFor="rc">Category</label><select id="rc" className="input" value={r.category} onChange={(e) => setR({ ...r, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="field"><label>Icon</label>
        <div className="row">{ICONS.map((i) => <button key={i} type="button" className="icon-btn" aria-pressed={r.icon === i} style={{ borderColor: r.icon === i ? 'var(--primary)' : undefined, borderWidth: r.icon === i ? 2 : 1 }} onClick={() => setR({ ...r, icon: i })}>{i}</button>)}</div>
      </div>
      <div className="field"><label htmlFor="rr">Repeats</label>
        <select id="rr" className="input" value={r.recurring ?? ''} onChange={(e) => setR({ ...r, recurring: (e.target.value || null) as Rule['recurring'] })}>
          <option value="">One-off</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
        </select>
      </div>
      <label className="row small" style={{ marginBottom: 16 }}><input type="checkbox" checked={r.active} onChange={(e) => setR({ ...r, active: e.target.checked })} /> Active</label>
      <button className="btn btn-primary btn-block" onClick={() => { if (dispatch({ type: 'saveRule', actorId: me.id, rule: r })) { toast('Rule saved'); onDone(); } }}>Save rule</button>
    </Sheet>
  );
}

/** Two-step reset (in-page confirmation; browser confirm dialogs are not available everywhere). */
export function ResetDemo() {
  const { dispatch, toast } = useApp();
  const [armed, setArmed] = useState(false);
  if (!armed) return <button className="btn btn-ghost btn-sm" onClick={() => setArmed(true)}>Reset demo data</button>;
  return (
    <div className="row">
      <span className="small">This erases every change you made. Continue?</span>
      <button className="btn btn-danger btn-sm" onClick={() => { dispatch({ type: 'reset' }); toast('Demo data reset'); setArmed(false); }}>Yes, reset</button>
      <button className="btn btn-ghost btn-sm" onClick={() => setArmed(false)}>Cancel</button>
    </div>
  );
}
