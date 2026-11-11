import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from './lib/store';
import type { Member, Role } from './lib/types';
import { AppCtx, useToast, type Ctx } from './components/ui';
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
    { id: 'money', label: 'Money', icon: '🐷', view: ChildMoney },
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

const SESSION = 'ritsu:session';
// Routing lives in component state (no URL hash), so the app also works
// inside embedded viewers that restrict hash formats.
type Route = { tab: string; param?: string };

export default function App() {
  const { state, dispatch, error, setError } = useStore();
  const [memberId, setMemberId] = useState<string | null>(() => { try { return localStorage.getItem(SESSION); } catch { return null; } });
  const [route, setRoute] = useState<Route>({ tab: 'home' });
  const [notifOpen, setNotifOpen] = useState(false);
  const { msg, show } = useToast();

  useEffect(() => { try { memberId ? localStorage.setItem(SESSION, memberId) : localStorage.removeItem(SESSION); } catch { /* ignore */ } }, [memberId]);
  useEffect(() => { if (error) { show(error); setError(null); } }, [error, show, setError]);

  const me = state.members.find((m) => m.id === memberId);
  const account = me && state.accounts.find((a) => a.id === me.accountId);
  const go = useCallback((tab: string, param?: string) => {
    setRoute({ tab, param });
    window.scrollTo({ top: 0 });
  }, []);

  const ctx: Ctx | null = useMemo(() => (me && account ? { state, me, account, dispatch, toast: show, go, param: route.param } : null), [state, me, account, dispatch, show, go, route.param]);

  if (!me || !account || !ctx) {
    return <div className="app theme-pro"><Login members={state.members} onPick={(m) => { setMemberId(m.id); go('home'); }} />{msg && <div className="toast" role="status">{msg}</div>}</div>;
  }

  const tabs = NAV[me.role];
  const tab = tabs.find((t) => t.id === route.tab) ?? tabs[0];
  const View = tab.view;
  const unread = state.notifications.filter((n) => n.memberId === me.id && !n.read).length;
  const kid = me.role === 'child';

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
          <div className="brand"><span className="brand-mark">R</span><span>Ritsu</span></div>
          <div className="spacer" />
          <button className="icon-btn" onClick={() => setNotifOpen(true)} aria-label={`Notifications, ${unread} unread`}>🔔{unread > 0 && <span className="dot">{unread}</span>}</button>
          <button className="who" onClick={() => { setMemberId(null); setRoute({ tab: 'home' }); }} title="Switch profile">
            <span className="av">{me.avatar}</span>
            <span style={{ textAlign: 'left' }}><b>{me.name}</b><small>{roleName(me.role)} · switch</small></span>
          </button>
        </header>
        <div className="layout">
          {nav('sidenav')}
          <main className="main" key={tab.id + (route.param ?? '')}><View /></main>
        </div>
        {nav('bottomnav')}
        {notifOpen && <NotificationsSheet onClose={() => setNotifOpen(false)} />}
        {msg && <div className="toast" role="status">{msg}</div>}
      </div>
    </AppCtx.Provider>
  );
}

function Login({ members, onPick }: { members: Member[]; onPick: (m: Member) => void }) {
  const family = members.filter((m) => m.role !== 'individual');
  const solo = members.filter((m) => m.role === 'individual');
  const describe: Record<Role, string> = {
    guardian: 'Run the family: rules, points, allowance, reports.',
    coguardian: 'Award points; big deductions need approval.',
    child: 'See your points, badges and savings.',
    individual: 'Personal habits, money and monthly review.',
  };
  const card = (m: Member) => (
    <button key={m.id} className="profile" onClick={() => onPick(m)}>
      <span className="av" aria-hidden="true">{m.avatar}</span>
      <b>{m.name}</b>
      <span className="chip" style={{ alignSelf: 'flex-start' }}>{roleName(m.role)}{m.age ? ` · ${m.age}` : ''}</span>
      <span className="small muted">{describe[m.role]}</span>
    </button>
  );
  return (
    <div className="login">
      <div className="login-hero">
        <p className="kicker">Merit &amp; reward platform</p>
        <h1>EVERY ACTION HAS VALUE</h1>
        <p style={{ margin: 0, fontWeight: 500 }}>Ritsu turns good habits into points and points into an allowance or a personal reward budget, with a clear record of why every point moved.</p>
      </div>
      <h2 className="sec">Family mode · Rahman Family</h2>
      <div className="profiles">{family.map(card)}</div>
      <h2 className="sec">Individual mode</h2>
      <div className="profiles">{solo.map(card)}</div>
      <p className="small muted" style={{ marginTop: 24 }}>Demo: choose any profile to see its dashboard. Data is saved in this browser only. The production version uses email sign-in for adults and a family code or PIN for children.</p>
    </div>
  );
}
