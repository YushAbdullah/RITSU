import { InfoLinks } from './Info';
import { useState } from 'react';
import { AuthError, backend, hashSecret, newSalt, type User } from '../lib/backend';
import { newFamilyState, newIndividualState, type NewChild } from '../lib/setup';
import type { Member, State } from '../lib/types';
import { Seg, Sheet } from '../components/ui';

const PARENT_AVATARS = ['👩🏻', '👨🏻', '👩🏽', '👨🏽', '👩🏾', '👨🏾', '🧕🏻', '🧔🏻'];
const KID_AVATARS = ['🦖', '🦊', '🐼', '🦁', '🐯', '🐸', '🐙', '🦄', '🐧', '🐨'];

export function PlayMoneyNote({ compact }: { compact?: boolean }) {
  return (
    <div className="banner info" style={compact ? { marginBottom: 0 } : undefined}>
      <span aria-hidden="true">🎲</span>
      <span><b>Play money only.</b> Ritsu never holds, sends or receives real money. The amounts are a game value to motivate; any real pocket money is up to you.</span>
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 100 100" width="44" height="44" aria-hidden="true">
      <rect x="16" y="14" width="20" height="72" rx="10" fill="currentColor" />
      <path d="M44 60 L72 86" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />
      <circle cx="54" cy="37" r="23" fill="#6BE683" />
    </svg>
  );
}

export function Welcome({ onAuthed, onDemo }: { onAuthed: (u: User) => void; onDemo: () => void }) {
  const be = backend();
  const [tab, setTab] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const u = tab === 'signup' ? await be.signUp(email, password, name) : await be.signIn(email, password);
      onAuthed(u);
    } catch (err) {
      setMsg({ text: err instanceof AuthError ? err.message : 'Something went wrong. Please try again.', err: true });
    } finally { setBusy(false); }
  };
  const forgot = async () => {
    try { setMsg({ text: await be.resetPassword(email), err: false }); } catch (err) { setMsg({ text: (err as Error).message, err: true }); }
  };
  return (
    <div className="login">
      <div className="login-hero">
        <div className="row" style={{ gap: 6 }}><Logo /><span className="wordmark">ritsu</span></div>
        <h1>Every good action <span className="hl">counts<svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 14 C 40 4, 80 4, 110 11 S 170 18, 197 6" /></svg></span>.</h1>
        <p className="lead" style={{ margin: 0 }}>Turn good habits into points and points into a fun reward value, with a clear record of why every point moved.</p>
      </div>
      <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <Seg label="Account" value={tab} onChange={(t) => { setTab(t); setMsg(null); }} options={[{ value: 'signup', label: 'Create account' }, { value: 'signin', label: 'Sign in' }]} />
        </div>
        <form onSubmit={submit} noValidate>
          {tab === 'signup' && <div className="field"><label htmlFor="su-name">Your name</label><input id="su-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aisyah" /></div>}
          <div className="field"><label htmlFor="su-email">Email</label><input id="su-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
          <div className="field"><label htmlFor="su-pw">Password {tab === 'signup' && <span className="muted">(at least 8 characters)</span>}</label><input id="su-pw" className="input" type="password" autoComplete={tab === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {msg && <div className={`banner ${msg.err ? 'err' : ''}`} role="alert">{msg.text}</div>}
          <button className="btn btn-primary btn-block" disabled={busy} type="submit">{busy ? 'Please wait…' : tab === 'signup' ? 'Create account' : 'Sign in'}</button>
          {tab === 'signin' && <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={forgot}>Forgot password?</button>}
        </form>
        <p className="small muted" style={{ marginBottom: 0 }}>
          {be.kind === 'cloud' ? '☁️ Your family data is saved securely in the cloud and available on any device you sign in on.' : '📱 Your account and data stay private on this device and are never sent anywhere. Download a backup from Settings to move to another device.'}
        </p>
      </div>
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={onDemo}>Just looking? Try the demo family</button>
      </div>
      <InfoLinks center />
      <p className="small muted" style={{ textAlign: 'center', margin: '4px 0 0' }}>© 2026 Ritsu · Made in Malaysia</p>
    </div>
  );
}

export function Setup({ user, onDone, onCancel }: { user: User; onDone: (s: State) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'family' | 'individual'>('family');
  const [familyName, setFamilyName] = useState(user.name ? `${user.name}'s family` : '');
  const [avatar, setAvatar] = useState(PARENT_AVATARS[0]);
  const [currency, setCurrency] = useState('RM');
  const [rate, setRate] = useState(1);
  const [budget, setBudget] = useState(2000);
  const [pin, setPin] = useState('');
  const [kids, setKids] = useState<(NewChild & { pin: string })[]>([{ name: '', age: 8, avatar: KID_AVATARS[0], pin: '' }]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pinOk = (p: string) => p === '' || /^\d{4}$/.test(p);

  const finish = async () => {
    setErr('');
    if (mode === 'family') {
      if (!kids.some((k) => k.name.trim())) return setErr('Add at least one child. You can add more later in Settings.');
      if (!pinOk(pin) || kids.some((k) => !pinOk(k.pin))) return setErr('PINs must be exactly 4 digits, or left empty.');
    }
    setBusy(true);
    try {
      if (mode === 'individual') {
        onDone(newIndividualState(user.id, user.name || 'Me', avatar, currency, rate || 0.5, budget));
        return;
      }
      const withPin = async (p: string) => { if (!p) return {}; const salt = newSalt(); return { pinSalt: salt, pinHash: await hashSecret(p, salt) }; };
      const parentPin = await withPin(pin);
      const children: NewChild[] = [];
      for (const k of kids) children.push({ name: k.name, age: k.age, avatar: k.avatar, ...(await withPin(k.pin)) });
      onDone(newFamilyState({ userId: user.id, familyName, parentName: user.name || 'Parent', parentAvatar: avatar, parentPinHash: parentPin.pinHash, parentPinSalt: parentPin.pinSalt, currency, rate, children }));
    } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <p className="kicker">Welcome, {user.name || user.email}</p>
      <h1 className="title" style={{ fontSize: 40 }}>Let's set up Ritsu</h1>
      <p className="lead">Takes about a minute. You can change everything later.</p>
      <div className="card" style={{ display: 'grid', gap: 4 }}>
        <div className="field"><label>Who is Ritsu for?</label>
          <Seg label="Mode" value={mode} onChange={setMode} options={[{ value: 'family', label: '👨‍👩‍👧 My family' }, { value: 'individual', label: '🙋 Just me' }]} />
        </div>
        {mode === 'family' && <div className="field"><label htmlFor="st-fam">Family name</label><input id="st-fam" className="input" value={familyName} onChange={(e) => setFamilyName(e.target.value)} /></div>}
        <div className="field"><label>Your avatar</label><div className="row">{PARENT_AVATARS.map((a) => <button key={a} type="button" className="icon-btn" aria-pressed={avatar === a} style={{ borderColor: avatar === a ? 'var(--primary)' : undefined, borderWidth: avatar === a ? 2 : 1 }} onClick={() => setAvatar(a)}>{a}</button>)}</div></div>
        <div className="grid g2">
          <div className="field"><label htmlFor="st-cur">Currency label</label><input id="st-cur" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="RM, coins, stars…" /></div>
          <div className="field"><label htmlFor="st-rate">Value of 1 point</label><input id="st-rate" className="input" type="number" min={0.05} step="0.05" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></div>
        </div>
        <PlayMoneyNote compact />
        {mode === 'individual' ? (
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="st-bud">Monthly spending budget (for tracking)</label><input id="st-bud" className="input" type="number" min={0} value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></div>
        ) : (
          <>
            <h2 className="sec">Your children</h2>
            {kids.map((k, i) => (
              <div key={i} className="card" style={{ background: 'var(--card-2)', marginBottom: 8 }}>
                <div className="grid g2">
                  <div className="field"><label htmlFor={`k-n-${i}`}>Name</label><input id={`k-n-${i}`} className="input" value={k.name} onChange={(e) => setKids(kids.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></div>
                  <div className="field"><label htmlFor={`k-a-${i}`}>Age</label><input id={`k-a-${i}`} className="input" type="number" min={3} max={21} value={k.age} onChange={(e) => setKids(kids.map((x, j) => (j === i ? { ...x, age: Number(e.target.value) } : x)))} /></div>
                </div>
                <div className="field"><label>Avatar</label><div className="row">{KID_AVATARS.map((a) => <button key={a} type="button" className="icon-btn" style={{ borderColor: k.avatar === a ? 'var(--primary)' : undefined, borderWidth: k.avatar === a ? 2 : 1 }} onClick={() => setKids(kids.map((x, j) => (j === i ? { ...x, avatar: a } : x)))}>{a}</button>)}</div></div>
                <div className="row-between">
                  <div className="field" style={{ marginBottom: 0 }}><label htmlFor={`k-p-${i}`}>4-digit PIN (optional)</label><input id={`k-p-${i}`} className="input" inputMode="numeric" maxLength={4} style={{ width: 120 }} value={k.pin} onChange={(e) => setKids(kids.map((x, j) => (j === i ? { ...x, pin: e.target.value.replace(/\D/g, '') } : x)))} /></div>
                  {kids.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setKids(kids.filter((_, j) => j !== i))}>Remove</button>}
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => setKids([...kids, { name: '', age: 8, avatar: KID_AVATARS[kids.length % KID_AVATARS.length], pin: '' }])}>＋ Add another child</button>
            <h2 className="sec">Parent PIN</h2>
            <p className="small muted" style={{ marginTop: 0 }}>If your children use the same phone or tablet, a PIN stops them opening the parent screens.</p>
            <div className="field"><label htmlFor="st-pin">4-digit parent PIN (recommended)</label><input id="st-pin" className="input" inputMode="numeric" maxLength={4} style={{ width: 140 }} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>
            <p className="small muted">We add a starter set of household rules (chores, study, kindness, screen time). Edit them anytime.</p>
          </>
        )}
        {err && <div className="banner err" role="alert">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={busy} onClick={finish}>{busy ? 'Setting up…' : 'Finish setup'}</button>
        <button className="btn btn-ghost btn-block" onClick={onCancel}>Sign out</button>
      </div>
    </div>
  );
}

export function ProfilePicker({ state, onPick, onExit, exitLabel, title }: { state: State; onPick: (m: Member) => void; onExit: () => void; exitLabel: string; title: string }) {
  const [asking, setAsking] = useState<Member | null>(null);
  const adults = state.members.filter((m) => m.role !== 'child');
  const kids = state.members.filter((m) => m.role === 'child');
  const card = (m: Member) => (
    <button key={m.id} className="profile" onClick={() => (m.pinHash ? setAsking(m) : onPick(m))}>
      <span className="av" aria-hidden="true">{m.avatar}</span>
      <b>{m.name}</b>
      <span className="chip" style={{ alignSelf: 'flex-start' }}>{m.role === 'child' ? `Child${m.age ? ` · ${m.age}` : ''}` : m.role === 'guardian' ? 'Parent' : m.role === 'coguardian' ? 'Co-parent' : 'Me'}{m.pinHash ? ' · 🔒' : ''}</span>
    </button>
  );
  return (
    <div className="login">
      <p className="kicker">{state.accounts[0]?.name}</p>
      <h1 className="title" style={{ fontSize: 40 }}>{title}</h1>
      <div className="profiles">{adults.map(card)}</div>
      {kids.length > 0 && <><h2 className="sec">Children</h2><div className="profiles">{kids.map(card)}</div></>}
      <div style={{ marginTop: 24 }}><button className="btn btn-ghost" onClick={onExit}>{exitLabel}</button></div>
      {asking && <PinSheet member={asking} onClose={() => setAsking(null)} onOk={() => { onPick(asking); setAsking(null); }} />}
    </div>
  );
}

export function PinSheet({ member, onOk, onClose }: { member: Member; onOk: () => void; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const check = async (p: string) => {
    if (p.length < 4) return;
    if (member.pinSalt && (await hashSecret(p, member.pinSalt)) === member.pinHash) onOk();
    else { setErr('That PIN is not right. Try again.'); setPin(''); }
  };
  const press = (d: string) => { const p = (pin + d).slice(0, 4); setPin(p); setErr(''); void check(p); };
  return (
    <Sheet title={`Enter ${member.name}'s PIN`} onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        <div className="num" aria-live="polite" style={{ fontSize: 40, letterSpacing: '0.4em', margin: '8px 0 12px' }}>{'●'.repeat(pin.length)}{'○'.repeat(4 - pin.length)}</div>
        {err && <div className="banner err" role="alert">{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12, justifyContent: 'center' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) => d === '' ? <span key={i} /> : (
            <button key={i} className="btn btn-ghost" style={{ height: 64, fontSize: 22 }} aria-label={d === '⌫' ? 'Delete' : d} onClick={() => (d === '⌫' ? setPin(pin.slice(0, -1)) : press(d))}>{d}</button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
