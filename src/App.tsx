import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from './lib/store';
import type { Role, State } from './lib/types';
import { backend, demoStore, type User } from './lib/backend';
import { seed } from './lib/seed';
import { ProfilePicker, Setup, Welcome } from './views/Auth';
import { AppCtx, useToast, type Ctx, type SaveStatus, type Session } from './components/ui';
import { ActivityView, AllowanceView, AwardView, GuardianHome, ReportsView, roleName, SettingsView } from './views/Guardian';
import { ChildBadges, ChildHome, ChildMoney, ChildPoints } from './views/Child';
import { IndHabits, IndInsights, IndMoney, IndReview, IndSettings, IndToday } from './views/Individual';
import { NotificationsSheet } from './views/shared';

interface Tab { id: string; label: string; icon: string; view: () => React.JSX.Element }

const NAV: Record<Role, Tab[]> = {
  guardian: [
    { id: 'home', label: 'Home', icon: '🏠', view: GuardianHome },
    { id: 'award', label: 'Award', icon: '➕', view: AwardView },
    { id: 'activity', label: 'History', icon: '🧾', view: ActivityView },
    { id: 'allowance', label: 'Allowance', icon: '💰', view: AllowanceView },
    { id: 'reports', label: 'Reports', icon: '📊', view: ReportsView },
    { id: 'settings', label: 'Settings', icon: '⚙️', view: SettingsView },
  ],
  coguardian: [
    { id: 'home', label: 'Home', icon: '🏠', view: GuardianHome },
    { id: 'award', label: 'Award', icon: '➕', view: AwardView },
    { id: 'activity', label: 'History', icon: '🧾', view: ActivityView },
    { id: 'allowance', label: 'Allowance', icon: '💰', view: AllowanceView },
    { id: 'reports', label: 'Reports', icon: '📊', view: ReportsView },
  ],
  child: [
    { id: 'home', label: 'Home', icon: '🏠', view: ChildHome },
    { id: 'points', label: 'Points', icon: '⭐', view: ChildPoints },
    { id: 'badges', label: 'Badges', icon: '🎖️', view: ChildBadges },
    { id: 'money', label: 'Money', icon: '💰', view: ChildMoney },
  ],
  individual: [
    { id: 'home', label: 'Today', icon: '☀️', view: IndToday },
    { id: 'habits', label: 'Habits', icon: '✅', view: IndHabits },
    { id: 'money', label: 'Money', icon: '💳', view: IndMoney },
    { id: 'insights', label: 'Insights', icon: '📊', view: IndInsights },
    { id: 'review', label: 'Review', icon: '📝', view: IndReview },
    { id: 'settings', label: 'Settings', icon: '⚙️', view: IndSettings },
  ],
};

// Routing lives in component state (no URL hash), so the app also works
// inside embedded viewers that restrict hash formats.
type Route = { tab: string; param?: string };

type Phase =
  | { kind: 'loading' }
  | { kind: 'welcome' }
  | { kind: 'setup'; user: User }
  | { kind: 'ready'; source: 'demo' | 'account'; user?: User; state: State };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const { msg, show } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const u = await backend().current();
        if (!u) return setPhase({ kind: 'welcome' });
        const st = await backend().load(u);
        setPhase(st ? { kind: 'ready', source: 'account', user: u, state: st } : { kind: 'setup', user: u });
      } catch (e) {
        show((e as Error).message);
        setPhase({ kind: 'welcome' });
      }
    })();
  }, [show]);

  const onAuthed = async (u: User) => {
    try {
      const st = await backend().load(u);
      setPhase(st ? { kind: 'ready', source: 'account', user: u, state: st } : { kind: 'setup', user: u });
    } catch (e) { show((e as Error).message); }
  };
  const signOut = async () => { await backend().signOut().catch(() => undefined); setPhase({ kind: 'welcome' }); };

  const toast = msg && <div className="toast" role="status">{msg}</div>;
  if (phase.kind === 'loading') return <div className="app theme-pro"><div className="login"><p className="muted">Loading…</p></div></div>;
  if (phase.kind === 'welcome') return <div className="app theme-pro"><Welcome onAuthed={onAuthed} onDemo={() => setPhase({ kind: 'ready', source: 'demo', state: (() => { const d = demoStore.load(); return d && d.moods ? d : seed(); })() })} />{toast}</div>;
  if (phase.kind === 'setup') {
    return <div className="app theme-pro"><Setup user={phase.user} onCancel={signOut} onDone={async (st) => {
      try { await backend().save(phase.user, st); setPhase({ kind: 'ready', source: 'account', user: phase.user, state: st }); show('All set! Your family is saved.'); }
      catch (e) { show((e as Error).message); }
    }} />{toast}</div>;
  }
  return <Workspace key={phase.user?.id ?? 'demo'} source={phase.source} user={phase.user} initial={phase.state}
    onExit={phase.source === 'demo' ? () => setPhase({ kind: 'welcome' }) : signOut} toast={show} toastEl={toast} />;
}

function Workspace({ source, user, initial, onExit, toast, toastEl }: { source: 'demo' | 'account'; user?: User; initial: State; onExit: () => void; toast: (m: string) => void; toastEl: React.ReactNode }) {
  const [saveState, setSaveState] = useState<SaveStatus>('saved');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<State | null>(null);
  const flush = useCallback(async () => {
    const st = pending.current;
    if (!st || !user) return;
    pending.current = null;
    try { await backend().save(user, st); setSaveState(pending.current ? 'saving' : 'saved'); }
    catch (e) { setSaveState('error'); toast((e as Error).message); pending.current = pending.current ?? st; }
  }, [user, toast]);
  const onChange = useCallback((st: State) => {
    if (source === 'demo') { demoStore.save(st); return; }
    pending.current = st;
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }, [source, flush]);
  useEffect(() => {
    const before = () => { if (pending.current) void flush(); };
    window.addEventListener('pagehide', before);
    return () => window.removeEventListener('pagehide', before);
  }, [flush]);

  const { state, dispatch, error, setError } = useStore(initial, onChange);
  const single = state.members.length === 1 ? state.members[0].id : null;
  const [memberId, setMemberId] = useState<string | null>(single);
  const [route, setRoute] = useState<Route>({ tab: 'home' });
  const [notifOpen, setNotifOpen] = useState(false);
  useEffect(() => { if (error) { toast(error); setError(null); } }, [error, toast, setError]);

  const me = state.members.find((m) => m.id === memberId);
  const account = me && state.accounts.find((a) => a.id === me.accountId);
  const go = useCallback((tab: string, param?: string) => {
    setRoute({ tab, param });
    window.scrollTo({ top: 0 });
  }, []);
  const session: Session = useMemo(() => ({
    source, email: user?.email, storage: source === 'demo' ? 'demo' : backend().kind, saveState, signOut: onExit,
    deleteAccount: user ? async () => { if (timer.current) clearTimeout(timer.current); pending.current = null; await backend().deleteAccount(user); onExit(); } : undefined,
  }), [source, user, saveState, onExit]);

  const ctx: Ctx | null = useMemo(() => (me && account ? { state, me, account, dispatch, toast, go, param: route.param, session } : null), [state, me, account, dispatch, toast, go, route.param, session]);

  if (!me || !account || !ctx) {
    return (
      <div className="app theme-pro">
        <ProfilePicker state={state} title={source === 'demo' ? 'Demo family: who is using Ritsu?' : 'Who is using Ritsu?'}
          exitLabel={source === 'demo' ? '← Leave demo' : 'Sign out'} onExit={onExit}
          onPick={(m) => { setMemberId(m.id); go('home'); }} />
        {toastEl}
      </div>
    );
  }

  const tabs = NAV[me.role];
  const tab = tabs.find((t) => t.id === route.tab) ?? tabs[0];
  const View = tab.view;
  const unread = state.notifications.filter((n) => n.memberId === me.id && !n.read).length;
  const kid = me.role === 'child';
  const saveLabel = source === 'demo' ? 'Demo' : saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : backend().kind === 'cloud' ? 'Saved ☁️' : 'Saved';

  const nav = (cls: string) => (
    <nav className={cls} aria-label="Main">
      {tabs.map((t) => (
        <button key={t.id} className="navbtn" aria-current={t.id === tab.id ? 'page' : undefined} onClick={() => go(t.id)}>
          <span className="ni" aria-hidden="true">{t.icon}</span>{t.label}
        </button>
      ))}
    </nav>
  );

  return (
    <AppCtx.Provider value={ctx}>
      <div className={`app ${kid ? 'theme-kid' : 'theme-pro'}`}>
        <header className="topbar">
          <div className="brand"><svg viewBox="0 0 100 100" width="30" height="30" aria-hidden="true"><rect x="16" y="14" width="20" height="72" rx="10" fill="currentColor" /><path d="M44 60 L72 86" stroke="currentColor" strokeWidth="20" strokeLinecap="round" /><circle cx="54" cy="37" r="23" fill="#6BE683" /></svg><span>Ritsu</span></div>
          {!kid && <span className={`chip ${saveState === 'error' ? 'bad' : ''}`} aria-live="polite">{saveLabel}</span>}
          <div className="spacer" />
          <button className="icon-btn" onClick={() => setNotifOpen(true)} aria-label={`Notifications, ${unread} unread`}>🔔{unread > 0 && <span className="dot">{unread}</span>}</button>
          <button className="who" onClick={() => { if (state.members.length > 1) { setMemberId(null); setRoute({ tab: 'home' }); } else go('settings'); }} title="Switch profile">
            <span className="av">{me.avatar}</span>
            <span style={{ textAlign: 'left' }}><b>{me.name}</b><small>{state.members.length > 1 ? 'switch' : roleName(me.role)}</small></span>
          </button>
        </header>
        <div className="layout">
          {nav('sidenav')}
          <main className="main" key={tab.id + (route.param ?? '')}><View /></main>
        </div>
        {nav('bottomnav')}
        {notifOpen && <NotificationsSheet onClose={() => setNotifOpen(false)} />}
        {toastEl}
      </div>
    </AppCtx.Provider>
  );
}
