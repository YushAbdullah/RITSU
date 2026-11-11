import { useState } from 'react';
import { hashSecret, newSalt, parseBackup } from '../lib/backend';
import type { Member } from '../lib/types';
import { isReversed } from '../lib/logic';
import type { Rule, RuleKind, Transaction } from '../lib/types';
import { ago, Empty, Seg, Sheet, signed, useApp } from '../components/ui';
import { ProofView } from '../components/evidence';
import { InfoLinks } from './Info';

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
        {tx.reason && <div className="reason"><b>Reason:</b> {tx.reason}</div>}
        {tx.proof && <div style={{ marginTop: 6 }}><ProofView proof={tx.proof} /></div>}
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

/** Signed-in account, where data is saved, backup/restore, sign out, delete, and the demo reset. */
export function AccountCard() {
  const { session, state, dispatch, toast } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restore, setRestore] = useState<import('../lib/types').State | null>(null);
  const where = session.storage === 'cloud' ? 'Saved to the cloud. Sign in on any device to see it.'
    : session.storage === 'device' ? 'Saved privately in this browser on this device. Nothing is sent to a server. Download a backup now and then so you never lose your family\'s history, or to move it to another device.'
    : 'Demo family. Changes stay in this browser and are not part of any account.';
  const download = async () => {
    const text = JSON.stringify({ ritsu: 1, exportedAt: new Date().toISOString(), state }, null, 2);
    const filename = `ritsu-backup-${new Date().toISOString().slice(0, 10)}.json`;
    // Inside a hosted viewer that blocks plain downloads, ask the host to save the file.
    const host = (window as unknown as { claude?: { use?: (n: string) => Promise<{ save: (f: { filename: string; data: string }) => Promise<unknown> } | null> } }).claude;
    const saver = host?.use ? await host.use('downloads').catch(() => null) : null;
    if (saver) {
      try { await saver.save({ filename, data: text }); toast('Backup saved'); }
      catch (e) { if ((e as { code?: string }).code !== 'declined') toast('Could not save the backup here.'); }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded');
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    try { setRestore(parseBackup(await f.text())); } catch (e) { toast((e as Error).message); }
  };
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3>{session.source === 'demo' ? 'Demo mode' : 'Your account'}</h3>
      {session.email && <p className="small" style={{ margin: '0 0 4px' }}>Signed in as <b>{session.email}</b></p>}
      <p className="small muted" style={{ marginTop: 0 }}>{where}</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={session.signOut}>{session.source === 'demo' ? 'Leave demo' : 'Sign out'}</button>
        {session.source === 'demo' && <ResetDemo />}
        {session.source === 'account' && <>
          <button className="btn btn-ghost btn-sm" onClick={() => void download()}>Download backup</button>
          <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
            Restore backup
            <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </>}
      </div>
      {restore && (
        <div className="banner" style={{ marginTop: 12 }}>
          <p className="small" style={{ marginTop: 0 }}>Replace everything in this account with the backup of <b>{restore.accounts[0].name}</b> ({restore.members.length} people, {restore.transactions.length} point entries)?</p>
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={() => { dispatch({ type: 'replace', state: restore }); setRestore(null); toast('Backup restored'); }}>Yes, restore</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRestore(null)}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}><InfoLinks /></div>
      {session.source === 'account' && session.deleteAccount && (
        <div style={{ marginTop: 12 }}>
          {!confirmDelete ? <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>Delete account</button> : (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="small">This permanently erases your account and all family data on this device. Continue?</span>
              <button className="btn btn-danger btn-sm" onClick={() => { void session.deleteAccount?.().catch((e: Error) => toast(e.message)); }}>Yes, delete</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Set or remove a 4-digit PIN that protects a profile on a shared device. */
export function PinEditor({ member, onClose }: { member: Member; onClose: () => void }) {
  const { me, dispatch, toast } = useApp();
  const [pin, setPin] = useState('');
  const save = async () => {
    if (!/^\d{4}$/.test(pin)) { toast('PIN must be exactly 4 digits'); return; }
    const salt = newSalt();
    if (dispatch({ type: 'updateMember', actorId: me.id, memberId: member.id, patch: { pinSalt: salt, pinHash: await hashSecret(pin, salt) } })) { toast(`PIN set for ${member.name}`); onClose(); }
  };
  return (
    <Sheet title={`PIN for ${member.name}`} onClose={onClose}>
      <p className="small muted">Asked when someone opens this profile from the "Who is using Ritsu?" screen.</p>
      <div className="field"><label htmlFor="pin-new">New 4-digit PIN</label><input id="pin-new" className="input" inputMode="numeric" maxLength={4} style={{ width: 140 }} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>
      <div className="row">
        <button className="btn btn-primary" onClick={save}>Save PIN</button>
        {member.pinHash && <button className="btn btn-ghost" onClick={() => { if (dispatch({ type: 'updateMember', actorId: me.id, memberId: member.id, patch: { pinHash: undefined, pinSalt: undefined } })) { toast('PIN removed'); onClose(); } }}>Remove PIN</button>}
      </div>
    </Sheet>
  );
}
