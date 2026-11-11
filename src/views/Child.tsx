import { useState } from 'react';
import { badges, cycleKey, cycleLabel, level, proposeAllowance, streak, summarise, weeklyChallenges } from '../lib/logic';
import { uid } from '../lib/store';
import type { Transaction } from '../lib/types';
import { ago, Empty, money, Progress, Seg, Sheet, signed, useApp } from '../components/ui';
import { TxList } from './shared';

export function ChildHome() {
  const { state, me, account, go } = useApp();
  const cycle = cycleKey(new Date());
  const s = summarise(state.transactions, me.id, cycle);
  const p = proposeAllowance(state, account, me.id, cycle);
  const st = streak(state.transactions, me.id);
  const lv = level(state.transactions, me.id);
  const earned = badges(state, me.id).filter((b) => b.earned).length;
  const goal = state.goals.find((g) => g.memberId === me.id);
  const ch = weeklyChallenges(state.transactions, me.id);
  const recent = state.transactions.filter((t) => t.memberId === me.id && t.status === 'posted').slice(0, 5);
  return (
    <>
      <p className="kicker" style={{ letterSpacing: 0, textTransform: 'none', fontSize: 16, fontWeight: 800 }}>Hi {me.name}! {me.avatar}</p>
      <div className="kid-hero" aria-label={`You have ${s.net} points this month`}>
        <div className="lbl">My points this month</div>
        <div className="big">{s.net}</div>
        <div className="money">💰 Worth about {money(p.total, account.currency)}</div>
      </div>
      <div className="grid g3 kid-tiles" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', marginTop: 12 }}>
        <div className="card"><div className="em">🔥</div><div className="v">{st}</div><div className="small muted">day streak</div></div>
        <div className="card"><div className="em">🏆</div><div className="v">{lv.number}</div><div className="small muted">{lv.name}</div></div>
        <button className="card" style={{ cursor: 'pointer' }} onClick={() => go('badges')}><div className="em">🎖️</div><div className="v">{earned}</div><div className="small muted">badges</div></button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row-between"><b>Level {lv.number}: {lv.name}</b><span className="small muted">{lv.toNext} more to level {lv.number + 1}</span></div>
        <div style={{ marginTop: 8 }}><Progress value={lv.progress} label="Level progress" /></div>
      </div>

      {goal && (
        <div className="card" style={{ marginTop: 12, background: 'var(--mint)', borderColor: 'transparent' }}>
          <div className="row-between"><b style={{ fontSize: 17 }}>{goal.icon} Saving for: {goal.name}</b><span className="num" style={{ fontSize: 20 }}>{Math.round((goal.saved / goal.target) * 100)}%</span></div>
          <div style={{ margin: '10px 0 6px' }}><Progress value={goal.saved / goal.target} label="Savings progress" /></div>
          <div className="small">{money(goal.saved, account.currency)} saved of {money(goal.target, account.currency)}</div>
        </div>
      )}

      <h2 className="sec">This week's challenges</h2>
      <div className="grid" style={{ gap: 8 }}>
        {ch.map((c) => (
          <div className="card" key={c.id} style={{ padding: 14 }}>
            <div className="row-between"><span><span style={{ fontSize: 22 }}>{c.icon}</span> <b>{c.name}</b></span><span className="chip ok">+{c.reward} ⭐</span></div>
            <div className="row" style={{ marginTop: 8 }}><div style={{ flex: 1 }}><Progress value={c.done / c.target} label={c.name} /></div><span className="num" style={{ fontSize: 18 }}>{c.done}/{c.target}</span></div>
          </div>
        ))}
      </div>

      <h2 className="sec">What happened lately</h2>
      <div className="card"><TxList txs={recent} empty="No points yet. You can do it!" /></div>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={() => go('points')}>See all my points</button>
    </>
  );
}

const REASONS = ['It was not only me', 'I already did it', "I didn't know the rule", 'Something else'];

export function ChildPoints() {
  const { state, me, account } = useApp();
  const [view, setView] = useState<'history' | 'rules'>('history');
  const [asking, setAsking] = useState<Transaction | null>(null);
  const mine = state.transactions.filter((t) => t.memberId === me.id && t.status !== 'rejected').slice(0, 60);
  const rules = state.rules.filter((r) => r.accountId === account.id && r.active && !r.memberId);
  const windowMs = account.disputeWindowDays * 86_400_000;
  return (
    <>
      <h1 className="title">My points</h1>
      <p className="lead">See why your points went up or down. If something seems unfair, tell us.</p>
      <div style={{ marginBottom: 12 }}><Seg label="View" value={view} onChange={setView} options={[{ value: 'history', label: 'History' }, { value: 'rules', label: 'How to earn' }]} /></div>
      {view === 'history' ? (
        <div className="card">
          <TxList txs={mine} empty="No points yet." renderActions={(t) => {
            const d = state.disputes.find((x) => x.txId === t.id);
            if (d) return <div className="small" style={{ marginTop: 6, padding: 10, background: 'var(--card-2)', borderRadius: 12 }}>You asked: “{d.note || d.reason}”{d.response ? <><br /><b>Reply:</b> {d.response}</> : <><br /><span className="muted">Waiting for a reply…</span></>}</div>;
            if (t.type === 'demerit' && t.status === 'posted' && Date.now() - new Date(t.createdAt).getTime() < windowMs) {
              return <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setAsking(t)}>🙋 Not fair?</button>;
            }
            return null;
          }} />
        </div>
      ) : (
        <div className="grid md2">
          <div className="card"><h3>⭐ Ways to earn points</h3><ul className="list">{rules.filter((r) => r.kind === 'merit').map((r) => <li className="item" key={r.id}><div className="ic">{r.icon}</div><div className="body"><div className="t">{r.name}</div></div><div className="pts pos">+{r.points}</div></li>)}</ul></div>
          <div className="card"><h3>⚠️ Things that cost points</h3><ul className="list">{rules.filter((r) => r.kind === 'demerit').map((r) => <li className="item" key={r.id}><div className="ic">{r.icon}</div><div className="body"><div className="t">{r.name}</div></div><div className="pts neg">−{r.points}</div></li>)}</ul></div>
          <div className="card" style={{ background: 'var(--sky)', borderColor: 'transparent' }}><b>How points become money</b><p style={{ margin: '6px 0 0' }}>Each point is worth {money(account.rate, account.currency)}. At the end of the month your grown-up checks your points and approves your allowance. {Math.round(account.allowance.savingsPct * 100)}% goes into your savings jar.</p></div>
        </div>
      )}
      {asking && <DisputeSheet tx={asking} onClose={() => setAsking(null)} />}
    </>
  );
}

function DisputeSheet({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { me, dispatch, toast } = useApp();
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  return (
    <Sheet title="Tell us what happened" onClose={onClose}>
      <div className="banner"><div><b>{tx.description}</b> ({signed(tx.points)})<br /><span className="small muted">{ago(tx.createdAt)}</span></div></div>
      <div className="field"><label>Why does it seem unfair?</label>
        <div className="grid" style={{ gap: 8 }}>
          {REASONS.map((r) => <button key={r} className="pick" aria-pressed={reason === r} onClick={() => setReason(r)}><span className="n" style={{ fontSize: 15 }}>{r}</span></button>)}
        </div>
      </div>
      <div className="field"><label htmlFor="dn">Anything else? (optional)</label><textarea id="dn" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Say it in your own words" /></div>
      <button className="btn btn-primary btn-block" onClick={() => { if (dispatch({ type: 'raiseDispute', txId: tx.id, memberId: me.id, reason, note })) { toast('Sent! Your grown-up will reply.'); onClose(); } }}>Send</button>
    </Sheet>
  );
}

export function ChildBadges() {
  const { state, me } = useApp();
  const lv = level(state.transactions, me.id);
  const list = badges(state, me.id);
  return (
    <>
      <h1 className="title">My badges</h1>
      <p className="lead">{list.filter((b) => b.earned).length} of {list.length} collected. Keep going!</p>
      <div className="kid-hero" style={{ background: 'var(--text)' }}>
        <div className="lbl">Level {lv.number}</div>
        <div className="big" style={{ fontSize: 56 }}>{lv.name}</div>
        <div style={{ marginTop: 12, position: 'relative' }}><Progress value={lv.progress} label="Level progress" /></div>
        <div className="small" style={{ marginTop: 6, position: 'relative' }}>{lv.lifetime} lifetime merit points · {lv.toNext} to next level</div>
      </div>
      <div className="badge-grid" style={{ marginTop: 12 }}>
        {list.map((b) => (
          <div key={b.id} className={`card badge ${b.earned ? 'earned' : ''}`}>
            <div className="em" aria-hidden="true">{b.icon}</div>
            <div className="n">{b.name}</div>
            <div className="small muted">{b.description}</div>
            {!b.earned && <div style={{ marginTop: 8 }}><Progress value={b.progress} label={`${b.name} progress`} /></div>}
            {b.earned && <div className="chip ok" style={{ marginTop: 8 }}>Earned</div>}
          </div>
        ))}
      </div>
    </>
  );
}

export function ChildMoney() {
  const { state, me, account, dispatch, toast } = useApp();
  const cycle = cycleKey(new Date());
  const p = proposeAllowance(state, account, me.id, cycle);
  const goals = state.goals.filter((g) => g.memberId === me.id);
  const entries = state.money.filter((m) => m.memberId === me.id).slice(0, 12);
  const [sheet, setSheet] = useState<'spend' | 'save' | 'goal' | null>(null);
  const [amount, setAmount] = useState(5);
  const [cat, setCat] = useState('Snacks');
  const [need, setNeed] = useState(false);
  const [note, setNote] = useState('');
  const [goalName, setGoalName] = useState('');
  const cur = account.currency;
  return (
    <>
      <h1 className="title">My money</h1>
      <p className="lead">{cycleLabel(cycle)}</p>
      <div className="card" style={{ background: 'var(--sky)', borderColor: 'transparent' }}>
        <div className="small" style={{ fontWeight: 800 }}>My allowance so far</div>
        <div className="num" style={{ fontSize: 48, fontWeight: 700 }}>{money(p.total, cur)}</div>
        <div className="small">{p.netPoints} points × {money(p.rate, cur)} + {money(p.base, cur)} base{p.bonus ? ` + ${money(p.bonus, cur)} bonus 🎉` : ''}{p.clampedBy === 'cap' ? ` (max ${money(p.cap, cur)})` : ''}</div>
        <div className="small" style={{ marginTop: 6 }}>🐷 {money(p.savings, cur)} will go to savings · 🛍️ {money(p.spendable, cur)} to spend</div>
      </div>
      <h2 className="sec">Savings jars</h2>
      <div className="grid md2">
        {goals.map((g) => (
          <div className="card" key={g.id}>
            <div className="row-between"><b style={{ fontSize: 17 }}>{g.icon} {g.name}</b><span className="num" style={{ fontSize: 20 }}>{Math.round((g.saved / g.target) * 100)}%</span></div>
            <div style={{ margin: '10px 0 6px' }}><Progress value={g.saved / g.target} label={`${g.name} progress`} /></div>
            <div className="small">{money(g.saved, cur)} of {money(g.target, cur)} · {money(Math.max(0, g.target - g.saved), cur)} to go</div>
          </div>
        ))}
        {!goals.length && <div className="card"><Empty icon="🐷" text="No savings jar yet." /></div>}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => setSheet('spend')}>🛍️ I spent money</button>
        {goals.length > 0 && <button className="btn btn-ghost" onClick={() => setSheet('save')}>🐷 Add to savings</button>}
        <button className="btn btn-ghost" onClick={() => setSheet('goal')}>＋ New jar</button>
      </div>
      <h2 className="sec">Money history</h2>
      <div className="card">
        {entries.length ? <ul className="list">{entries.map((m) => (
          <li className="item" key={m.id}><div className="ic">{m.kind === 'income' ? '💵' : m.kind === 'saving' ? '🐷' : '🛍️'}</div>
            <div className="body"><div className="t">{m.note || m.category}</div><div className="s">{m.category} · {m.date}{m.kind === 'expense' ? (m.need ? ' · needed it' : ' · wanted it') : ''}</div></div>
            <div className={`pts ${m.kind === 'income' ? 'pos' : ''}`} style={{ fontSize: 20 }}>{m.kind === 'income' ? '+' : '−'}{money(m.amount, cur)}</div></li>
        ))}</ul> : <Empty icon="💵" text="Nothing yet." />}
      </div>
      {sheet === 'spend' && (
        <Sheet title="What did you buy?" onClose={() => setSheet(null)}>
          <div className="field"><label htmlFor="sa">How much ({cur})</label><input id="sa" className="input" type="number" min={0.5} step="0.5" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          <div className="field"><label htmlFor="sc">Type</label><select id="sc" className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{['Snacks', 'Toys', 'Books', 'Games', 'Stationery', 'Gifts', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label>Did you need it or want it?</label><Seg label="Need or want" value={need ? 'need' : 'want'} onChange={(v) => setNeed(v === 'need')} options={[{ value: 'need', label: 'Needed it' }, { value: 'want', label: 'Wanted it' }]} /></div>
          <div className="field"><label htmlFor="sn">What was it?</label><input id="sn" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <button className="btn btn-primary btn-block" onClick={() => { if (dispatch({ type: 'addMoney', actorId: me.id, entry: { id: uid('mn'), memberId: me.id, kind: 'expense', amount, category: cat, note, need, date: new Date().toISOString().slice(0, 10) } })) { toast('Saved'); setSheet(null); setNote(''); } }}>Save</button>
        </Sheet>
      )}
      {sheet === 'save' && goals[0] && (
        <Sheet title={`Add to ${goals[0].name}`} onClose={() => setSheet(null)}>
          <div className="field"><label htmlFor="ga">How much ({cur})</label><input id="ga" className="input" type="number" min={0.5} step="0.5" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          <button className="btn btn-primary btn-block" onClick={() => { if (dispatch({ type: 'contribute', actorId: me.id, goalId: goals[0].id, amount })) { toast('Into the jar! 🐷'); setSheet(null); } }}>Add {money(amount || 0, cur)}</button>
        </Sheet>
      )}
      {sheet === 'goal' && (
        <Sheet title="New savings jar" onClose={() => setSheet(null)}>
          <div className="field"><label htmlFor="gn">What are you saving for?</label><input id="gn" className="input" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="e.g. Bicycle" /></div>
          <div className="field"><label htmlFor="gt">How much does it cost ({cur})</label><input id="gt" className="input" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          <button className="btn btn-primary btn-block" onClick={() => { if (dispatch({ type: 'saveGoal', actorId: me.id, goal: { id: uid('g'), memberId: me.id, name: goalName, icon: '🎯', target: amount, saved: 0 } })) { toast('New jar created'); setSheet(null); setGoalName(''); } }}>Create jar</button>
        </Sheet>
      )}
    </>
  );
}
