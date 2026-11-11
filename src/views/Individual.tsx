import { useMemo, useState } from 'react';
import {
  categoryBreakdown, cycleKey, cycleLabel, dayKey, disciplineScore, finance, habitScore, level, posted, prevCycle,
  proposeAllowance, series, streak, summarise, type Granularity,
} from '../lib/logic';
import { uid } from '../lib/store';
import type { MoneyKind } from '../lib/types';
import { AmountBars, CategoryBars, DivergingBars, LineChart } from '../components/charts';
import { ago, Empty, money, PageHead, Progress, Ring, Seg, Sheet, signed, Stat, useApp } from '../components/ui';
import { ResetDemo, RuleEditor, TxList } from './shared';
import { AuditCard } from './Guardian';

const useHabits = () => {
  const { state, me } = useApp();
  return state.rules.filter((r) => r.memberId === me.id);
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function IndToday() {
  const { state, me, account, dispatch, toast, go } = useApp();
  const habits = useHabits().filter((h) => h.active);
  const cycle = cycleKey(new Date());
  const today = dayKey(new Date());
  const loggedToday = new Set(posted(state.transactions, me.id).filter((t) => dayKey(t.createdAt) === today).map((t) => t.ruleId));
  const score = habitScore(state.transactions, me.id, cycle);
  const reward = proposeAllowance(state, account, me.id, cycle);
  const f = finance(state.money, me.id, cycle);
  const budget = me.monthlyBudget ?? 0;
  const disc = disciplineScore(f, budget);
  const st = streak(state.transactions, me.id);
  const lv = level(state.transactions, me.id);
  const goals = state.goals.filter((g) => g.memberId === me.id);
  const log = (ruleId: string) => {
    const r = habits.find((h) => h.id === ruleId)!;
    if (dispatch({ type: 'award', memberId: me.id, actorId: me.id, kind: r.kind, points: r.points, category: r.category, description: r.name, ruleId })) {
      toast(r.kind === 'merit' ? `+${r.points} · ${r.name}` : `Logged honestly. −${r.points}`);
    }
  };
  return (
    <>
      <PageHead kicker={new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' })} title={`${greeting()}, ${me.name}`} lead={`Level ${lv.number} ${lv.name} · 🔥 ${st}-day streak`} />
      <div className="grid g4">
        <Stat label="Habit score" value={`${score}`} sub="Share of good habits this month" />
        <Stat label="Reward fund" value={money(reward.total, account.currency)} sub={`Earned guilt-free spending, cap ${money(account.allowance.cap, account.currency)}`} />
        <Stat label="Spent" value={money(f.expense, account.currency)} sub={budget ? `${Math.round((f.expense / budget) * 100)}% of ${money(budget, account.currency)} budget` : 'No budget set'} />
        <Stat label="Discipline" value={`${disc}/100`} sub="Budget, savings and needs mix" />
      </div>

      <div className="grid lg3" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="card-head"><h3>Today's check-in</h3><button className="btn btn-ghost btn-sm" onClick={() => go('habits')}>Manage</button></div>
          <ul className="list">
            {habits.filter((h) => h.kind === 'merit').map((h) => {
              const done = loggedToday.has(h.id);
              return (
                <li className="item" key={h.id}>
                  <div className="ic">{h.icon}</div>
                  <div className="body"><div className="t">{h.name}</div><div className="s">{h.category} · +{h.points}</div></div>
                  <button className={`btn btn-sm ${done ? 'btn-ghost' : 'btn-primary'}`} disabled={done} onClick={() => log(h.id)} aria-label={`Log ${h.name}`}>{done ? '✓ Done' : 'Done'}</button>
                </li>
              );
            })}
          </ul>
          <h2 className="sec" style={{ marginTop: 12 }}>Slipped today?</h2>
          <div className="row">
            {habits.filter((h) => h.kind === 'demerit').map((h) => (
              <button key={h.id} className="btn btn-ghost btn-sm" onClick={() => log(h.id)}>{h.icon} {h.name} −{h.points}</button>
            ))}
          </div>
          <p className="small muted">Honest logging beats a perfect score. Slips feed your monthly review.</p>
        </div>
        <div className="card">
          <h3>Monthly budget</h3>
          <div style={{ display: 'grid', placeItems: 'center', margin: '8px 0' }}>
            <Ring value={budget ? f.expense / budget : 0} size={140} color={budget && f.expense > budget ? 'var(--demerit)' : 'var(--merit)'}>
              <div className="num" style={{ fontSize: 30 }}>{budget ? Math.round((f.expense / budget) * 100) : 0}%</div>
              <div className="small muted">used</div>
            </Ring>
          </div>
          <div className="small" style={{ textAlign: 'center' }}>{money(Math.max(0, budget - f.expense), account.currency)} left for {cycleLabel(cycle)}</div>
          <h2 className="sec">Savings goals</h2>
          {goals.map((g) => (
            <div key={g.id} style={{ marginBottom: 12 }}>
              <div className="row-between small"><b>{g.icon} {g.name}</b><span>{Math.round((g.saved / g.target) * 100)}%</span></div>
              <div style={{ marginTop: 6 }}><Progress value={g.saved / g.target} label={g.name} /></div>
              <div className="small muted" style={{ marginTop: 4 }}>{money(g.saved, account.currency)} of {money(g.target, account.currency)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function IndHabits() {
  const { state, me, account } = useApp();
  const habits = useHabits();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const txs = state.transactions.filter((t) => t.memberId === me.id).slice(0, 40);
  const cycle = cycleKey(new Date());
  const countOf = (id: string) => posted(state.transactions, me.id, cycle).filter((t) => t.ruleId === id).length;
  return (
    <>
      <PageHead kicker="Self-accountability" title="Habits" lead="Good habits earn points; habits to break cost points. Points fund your reward budget." right={<button className="btn btn-primary" onClick={() => setEditing('new')}>＋ New habit</button>} />
      <div className="grid md2">
        {(['merit', 'demerit'] as const).map((k) => (
          <div className="card" key={k}>
            <h3>{k === 'merit' ? 'Good habits' : 'Habits to break'}</h3>
            <ul className="list">
              {habits.filter((h) => h.kind === k).map((h) => (
                <li className="item" key={h.id} style={{ opacity: h.active ? 1 : 0.5 }}>
                  <div className="ic">{h.icon}</div>
                  <div className="body"><div className="t">{h.name}</div><div className="s">{h.category} · {countOf(h.id)}× this month</div></div>
                  <div className={`pts ${k === 'merit' ? 'pos' : 'neg'}`}>{k === 'merit' ? '+' : '−'}{h.points}</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(h.id)}>Edit</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <h2 className="sec">Log</h2>
      <div className="card"><TxList txs={txs} /></div>
      {editing && <RuleEditor accountId={account.id} memberId={me.id} initial={editing === 'new' ? undefined : habits.find((h) => h.id === editing)} onDone={() => setEditing(null)} />}
    </>
  );
}

export function IndMoney() {
  const { state, me, account, dispatch, toast } = useApp();
  const cycle = cycleKey(new Date());
  const f = finance(state.money, me.id, cycle);
  const fp = finance(state.money, me.id, prevCycle(cycle));
  const goals = state.goals.filter((g) => g.memberId === me.id);
  const entries = state.money.filter((m) => m.memberId === me.id).slice(0, 25);
  const budget = me.monthlyBudget ?? 0;
  const cur = account.currency;
  const [sheet, setSheet] = useState<'entry' | 'goal' | string | null>(null);
  const [kind, setKind] = useState<MoneyKind>('expense');
  const [amount, setAmount] = useState(20);
  const [cat, setCat] = useState('Food');
  const [need, setNeed] = useState(true);
  const [note, setNote] = useState('');
  const [goalName, setGoalName] = useState('');
  const [goalId, setGoalId] = useState(goals[0]?.id ?? '');
  const cats: Record<MoneyKind, string[]> = {
    expense: ['Food', 'Groceries', 'Food delivery', 'Transport', 'Rent', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Other'],
    income: ['Salary', 'Side income', 'Gift', 'Other'],
    saving: ['Savings'],
  };
  return (
    <>
      <PageHead kicker={cycleLabel(cycle)} title="Money" lead="Income, spending and savings in one place." right={<button className="btn btn-primary" onClick={() => setSheet('entry')}>＋ Add entry</button>} />
      <div className="grid g4">
        <Stat label="Income" value={money(f.income, cur)} sub={`Last month ${money(fp.income, cur)}`} />
        <Stat label="Spending" value={money(f.expense, cur)} sub={`Last month ${money(fp.expense, cur)}`} />
        <Stat label="Saved" value={money(f.saved, cur)} sub={`${Math.round(f.savingsRate * 100)}% of income (target 20%)`} />
        <Stat label="Wants" value={money(f.wants, cur)} sub={`${f.expense ? Math.round((f.wants / f.expense) * 100) : 0}% of spending`} />
      </div>
      <div className="grid md2" style={{ marginTop: 12 }}>
        <div className="card">
          <h3>Budget</h3>
          <div className="row-between small"><span>{money(f.expense, cur)} spent</span><span>{money(budget, cur)} budget</span></div>
          <div style={{ margin: '8px 0 16px' }}><Progress value={budget ? f.expense / budget : 0} label="Budget used" /></div>
          <h3>Spending by category</h3>
          {f.byCategory.length ? <AmountBars rows={f.byCategory} currency={cur} /> : <Empty icon="🧾" text="No spending yet." />}
        </div>
        <div className="card">
          <div className="card-head"><h3>Savings goals</h3><button className="btn btn-ghost btn-sm" onClick={() => setSheet('goal')}>＋ Goal</button></div>
          {goals.map((g) => (
            <div key={g.id} style={{ marginBottom: 16 }}>
              <div className="row-between"><b>{g.icon} {g.name}</b><button className="btn btn-ghost btn-sm" onClick={() => { setGoalId(g.id); setKind('saving'); setSheet('entry'); }}>Add</button></div>
              <div style={{ margin: '6px 0' }}><Progress value={g.saved / g.target} label={g.name} /></div>
              <div className="small muted">{money(g.saved, cur)} of {money(g.target, cur)}{g.targetDate ? ` · by ${g.targetDate}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
      <h2 className="sec">Recent entries</h2>
      <div className="card">
        {entries.length ? <ul className="list">{entries.map((m) => (
          <li className="item" key={m.id}><div className="ic">{m.kind === 'income' ? '💵' : m.kind === 'saving' ? '🏦' : '🧾'}</div>
            <div className="body"><div className="t">{m.note || m.category}</div><div className="s">{m.category} · {m.date}{m.kind === 'expense' ? (m.need ? ' · need' : ' · want') : ''}</div></div>
            <div className={`pts ${m.kind === 'income' ? 'pos' : ''}`} style={{ fontSize: 20 }}>{m.kind === 'income' ? '+' : '−'}{money(m.amount, cur)}</div></li>
        ))}</ul> : <Empty icon="🧾" text="No entries yet." />}
      </div>
      {sheet === 'entry' && (
        <Sheet title="Add entry" onClose={() => setSheet(null)}>
          <div className="field"><label>Type</label><Seg<MoneyKind> label="Entry type" value={kind} onChange={(k) => { setKind(k); setCat(cats[k][0]); }} options={[{ value: 'expense', label: 'Spent' }, { value: 'income', label: 'Income' }, { value: 'saving', label: 'Saved' }]} /></div>
          <div className="grid g2">
            <div className="field"><label htmlFor="ea">Amount ({cur})</label><input id="ea" className="input" type="number" min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
            {kind === 'saving'
              ? <div className="field"><label htmlFor="eg">Goal</label><select id="eg" className="input" value={goalId} onChange={(e) => setGoalId(e.target.value)}>{goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
              : <div className="field"><label htmlFor="ec">Category</label><select id="ec" className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{cats[kind].map((c) => <option key={c}>{c}</option>)}</select></div>}
          </div>
          {kind === 'expense' && <div className="field"><label>Need or want?</label><Seg label="Need or want" value={need ? 'need' : 'want'} onChange={(v) => setNeed(v === 'need')} options={[{ value: 'need', label: 'Need' }, { value: 'want', label: 'Want' }]} /></div>}
          {kind !== 'saving' && <div className="field"><label htmlFor="en">Note</label><input id="en" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>}
          <button className="btn btn-primary btn-block" onClick={() => {
            const ok = kind === 'saving'
              ? dispatch({ type: 'contribute', actorId: me.id, goalId, amount })
              : dispatch({ type: 'addMoney', actorId: me.id, entry: { id: uid('mn'), memberId: me.id, kind, amount, category: cat, note, need: kind === 'expense' ? need : undefined, date: new Date().toISOString().slice(0, 10) } });
            if (ok) { toast('Saved'); setSheet(null); setNote(''); }
          }}>Save</button>
        </Sheet>
      )}
      {sheet === 'goal' && (
        <Sheet title="New savings goal" onClose={() => setSheet(null)}>
          <div className="field"><label htmlFor="gn2">Goal</label><input id="gn2" className="input" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="e.g. New laptop" /></div>
          <div className="field"><label htmlFor="gt2">Target ({cur})</label><input id="gt2" className="input" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          <button className="btn btn-primary btn-block" onClick={() => { if (dispatch({ type: 'saveGoal', actorId: me.id, goal: { id: uid('g'), memberId: me.id, name: goalName, icon: '🎯', target: amount, saved: 0 } })) { toast('Goal created'); setSheet(null); } }}>Create goal</button>
        </Sheet>
      )}
    </>
  );
}

const GRAN: Record<Granularity, number> = { day: 14, week: 8, month: 6 };

export function IndInsights() {
  const { state, me, account } = useApp();
  const [g, setG] = useState<Granularity>('day');
  const data = useMemo(() => series(state.transactions, [me.id], g, GRAN[g]), [state.transactions, me.id, g]);
  const cycle = cycleKey(new Date());
  const prev = prevCycle(cycle);
  const cats = categoryBreakdown(state.transactions, [me.id], cycle);
  const months = [prevCycle(prevCycle(prev)), prevCycle(prev), prev, cycle];
  const budget = me.monthlyBudget ?? 0;
  const daily = series(state.transactions, [me.id], 'day', 30);
  let run = 0;
  const cum = daily.map((d) => ({ label: d.key.slice(5).replace('-', '/'), value: (run += d.net) }));
  return (
    <>
      <PageHead kicker="Analytics" title="Insights" lead="How your habits and money moved." right={<Seg label="Period" value={g} onChange={setG} options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />} />
      <div className="card"><h3>Good habits vs slips</h3><DivergingBars data={data} /></div>
      <div className="grid md2" style={{ marginTop: 12 }}>
        <div className="card"><h3>Running habit points, last 30 days</h3><LineChart points={cum} label="Cumulative habit points" /></div>
        <div className="card"><h3>By area, this month</h3>{cats.length ? <CategoryBars rows={cats} /> : <Empty icon="📊" text="Nothing logged yet." />}</div>
      </div>
      <h2 className="sec">Month by month</h2>
      <div className="card scroll-x">
        <table className="tbl">
          <thead><tr><th>Month</th><th className="r">Habit score</th><th className="r">Net pts</th><th className="r">Spent</th><th className="r">Saved</th><th className="r">Discipline</th></tr></thead>
          <tbody>{months.map((m) => {
            const f = finance(state.money, me.id, m);
            const s = summarise(state.transactions, me.id, m);
            const has = s.merit + s.demerit > 0 || f.income > 0;
            return <tr key={m}><td>{cycleLabel(m)}</td><td className="r">{has ? habitScore(state.transactions, me.id, m) : '–'}</td><td className="r">{has ? signed(s.net) : '–'}</td><td className="r">{has ? money(f.expense, account.currency) : '–'}</td><td className="r">{has ? money(f.saved, account.currency) : '–'}</td><td className="r">{has ? disciplineScore(f, budget) : '–'}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </>
  );
}

export function IndReview() {
  const { state, me, account, dispatch, toast } = useApp();
  const cur = cycleKey(new Date());
  const [month, setMonth] = useState(new Date().getDate() <= 7 ? prevCycle(cur) : cur);
  const existing = state.assessments.find((a) => a.memberId === me.id && a.month === month);
  const [rating, setRating] = useState(existing?.rating ?? 3);
  const [wentWell, setWentWell] = useState(existing?.wentWell ?? '');
  const [improve, setImprove] = useState(existing?.improve ?? '');
  const [focus, setFocus] = useState(existing?.focus ?? '');
  const s = summarise(state.transactions, me.id, month);
  const f = finance(state.money, me.id, month);
  const reward = proposeAllowance(state, account, me.id, month);
  const cats = categoryBreakdown(state.transactions, [me.id], month);
  const worst = [...cats].sort((a, b) => b.demerit - a.demerit)[0];
  const past = state.assessments.filter((a) => a.memberId === me.id);
  const switchMonth = (m: string) => {
    setMonth(m);
    const e = state.assessments.find((a) => a.memberId === me.id && a.month === m);
    setRating(e?.rating ?? 3); setWentWell(e?.wentWell ?? ''); setImprove(e?.improve ?? ''); setFocus(e?.focus ?? '');
  };
  return (
    <>
      <PageHead kicker="Monthly self-assessment" title={cycleLabel(month)} lead="Look back honestly, then set one focus for next month."
        right={<select className="input" style={{ width: 'auto' }} value={month} onChange={(e) => switchMonth(e.target.value)} aria-label="Month">{[cur, prevCycle(cur)].map((m) => <option key={m} value={m}>{cycleLabel(m)}</option>)}</select>} />
      <div className="grid g4">
        <Stat label="Habit score" value={habitScore(state.transactions, me.id, month)} sub={`+${s.merit} / −${s.demerit}`} />
        <Stat label="Reward earned" value={money(reward.total, account.currency)} sub={`${Math.round(account.allowance.savingsPct * 100)}% suggested to savings`} />
        <Stat label="Spent" value={money(f.expense, account.currency)} sub={`${money(f.wants, account.currency)} on wants`} />
        <Stat label="Discipline" value={`${disciplineScore(f, me.monthlyBudget ?? 0)}/100`} sub={worst && worst.demerit ? `Weakest area: ${worst.category}` : 'No slips logged'} />
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="field"><label>How was your month?</label>
          <div className="row" role="radiogroup" aria-label="Rating">{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={rating === n} className="icon-btn" style={{ fontSize: 22, borderColor: rating >= n ? 'var(--gold)' : undefined }} onClick={() => setRating(n)}>{rating >= n ? '★' : '☆'}</button>)}</div>
        </div>
        <div className="field"><label htmlFor="ww">What went well?</label><textarea id="ww" className="input" value={wentWell} onChange={(e) => setWentWell(e.target.value)} /></div>
        <div className="field"><label htmlFor="im">What would you change?</label><textarea id="im" className="input" value={improve} onChange={(e) => setImprove(e.target.value)} /></div>
        <div className="field"><label htmlFor="fo">One focus for next month</label><input id="fo" className="input" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. No delivery on weekdays" /></div>
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'addAssessment', actorId: me.id, assessment: { id: existing?.id ?? uid('as'), memberId: me.id, month, rating, wentWell, improve, focus, createdAt: new Date().toISOString() } }) && toast('Review saved')}>{existing ? 'Update review' : 'Save review'}</button>
      </div>
      <h2 className="sec">Past reviews</h2>
      <div className="card">
        {past.length ? <ul className="list">{past.map((a) => <li className="item" key={a.id}><div className="ic">{'★'.repeat(a.rating)}</div><div className="body"><div className="t">{cycleLabel(a.month)} · Focus: {a.focus || '–'}</div><div className="s">{a.wentWell} {a.improve && `· To change: ${a.improve}`} · {ago(a.createdAt)}</div></div></li>)}</ul> : <Empty icon="📝" text="No reviews yet." />}
      </div>
    </>
  );
}

export function IndSettings() {
  const { account, me, dispatch, toast } = useApp();
  const [a, setA] = useState(account);
  const [budget, setBudget] = useState(me.monthlyBudget ?? 0);
  const num = (v: string) => (v === '' ? 0 : Number(v));
  return (
    <>
      <PageHead kicker="Individual mode" title="Settings" />
      <div className="card">
        <div className="grid g2">
          <div className="field"><label htmlFor="c">Currency</label><input id="c" className="input" value={a.currency} onChange={(e) => setA({ ...a, currency: e.target.value })} /></div>
          <div className="field"><label htmlFor="r">Value of 1 point</label><input id="r" className="input" type="number" step="0.05" min={0.05} value={a.rate} onChange={(e) => setA({ ...a, rate: num(e.target.value) })} /></div>
          <div className="field"><label htmlFor="b">Monthly spending budget</label><input id="b" className="input" type="number" min={0} value={budget} onChange={(e) => setBudget(num(e.target.value))} /></div>
          <div className="field"><label htmlFor="cap">Reward fund cap</label><input id="cap" className="input" type="number" min={0} value={a.allowance.cap} onChange={(e) => setA({ ...a, allowance: { ...a.allowance, cap: num(e.target.value) } })} /></div>
          <div className="field"><label htmlFor="bp">Bonus %</label><input id="bp" className="input" type="number" min={0} value={a.allowance.bonusPct} onChange={(e) => setA({ ...a, allowance: { ...a.allowance, bonusPct: num(e.target.value) } })} /></div>
          <div className="field"><label htmlFor="sp">Suggested savings %</label><input id="sp" className="input" type="number" min={0} max={100} value={Math.round(a.allowance.savingsPct * 100)} onChange={(e) => setA({ ...a, allowance: { ...a.allowance, savingsPct: num(e.target.value) / 100 } })} /></div>
        </div>
        <button className="btn btn-primary" onClick={() => {
          const ok = dispatch({ type: 'updateAccount', accountId: account.id, actorId: me.id, patch: a }) && dispatch({ type: 'updateMember', actorId: me.id, memberId: me.id, patch: { monthlyBudget: budget } });
          if (ok) toast('Settings saved');
        }}>Save settings</button>
      </div>
      <AuditCard />
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Demo data</h3>
        <ResetDemo />
      </div>
    </>
  );
}
