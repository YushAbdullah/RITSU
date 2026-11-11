// About, privacy, terms, user guide and collaboration pages. Opened from anywhere with openInfo().
import { useEffect, useState, type ReactNode } from 'react';
import { AdinaAvatar, YusriAvatar } from '../components/avatars';

export type InfoPage = 'about' | 'guide' | 'privacy' | 'terms' | 'collab';

const PAGES: { id: InfoPage; label: string }[] = [
  { id: 'about', label: 'About' },
  { id: 'guide', label: 'User guide' },
  { id: 'collab', label: 'Collaboration' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
];

const EVENT = 'ritsu:info';
export const openInfo = (page: InfoPage) => window.dispatchEvent(new CustomEvent<InfoPage>(EVENT, { detail: page }));

const UPDATED = '11 November 2026';

/** Footer row of links, used on the welcome screen and in Settings. */
export function InfoLinks({ center }: { center?: boolean }) {
  return (
    <nav className="info-links" aria-label="About Ritsu" style={center ? { justifyContent: 'center' } : undefined}>
      {PAGES.map((p) => <button key={p.id} type="button" onClick={() => openInfo(p.id)}>{p.label}</button>)}
    </nav>
  );
}

/** Mounted once at the root; shows the requested page full-screen. */
export function InfoHost() {
  const [page, setPage] = useState<InfoPage | null>(null);
  useEffect(() => {
    const on = (e: Event) => { setPage((e as CustomEvent<InfoPage>).detail); window.scrollTo({ top: 0 }); };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!page) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setPage(null);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [page]);
  if (!page) return null;
  return (
    <div className="app theme-pro info-page" role="dialog" aria-modal="true" aria-label={PAGES.find((p) => p.id === page)?.label}>
      <header className="info-top">
        <button className="btn btn-ghost btn-sm" onClick={() => setPage(null)}>← Back to Ritsu</button>
      </header>
      <div className="info-tabs" role="tablist">
        {PAGES.map((p) => <button key={p.id} role="tab" aria-selected={p.id === page} onClick={() => setPage(p.id)}>{p.label}</button>)}
      </div>
      <article className="info-body">
        {page === 'about' && <About />}
        {page === 'guide' && <Guide />}
        {page === 'collab' && <Collab />}
        {page === 'privacy' && <Privacy />}
        {page === 'terms' && <Terms />}
      </article>
    </div>
  );
}

const H = ({ children }: { children: ReactNode }) => <h2 className="info-h">{children}</h2>;

function About() {
  return (
    <>
      <p className="kicker">About Ritsu</p>
      <h1 className="title">Every good action counts.</h1>
      <p className="lead">Ritsu helps families and individuals turn good habits into points, and points into a fun reward value, with a clear record of why every point moved.</p>
      <H>Why we built it</H>
      <p>Rewards at home often depend on memory and mood. A child is not sure why they lost a privilege, a parent forgets what was promised, and pocket money becomes an argument. Ritsu makes it fair and visible: rules are agreed up front, every point has a reason, children can ask about a deduction, and the monthly allowance is worked out the same way every time.</p>
      <H>Who it's for</H>
      <ul>
        <li><b>Parents and guardians</b> who want a calm, consistent way to encourage good habits and teach money skills.</li>
        <li><b>Children</b> who like to see their progress, earn badges and save towards something they want.</li>
        <li><b>Adults</b> who want to track their own habits, spending and savings in one place.</li>
      </ul>
      <H>What makes it different</H>
      <ul>
        <li><b>Play money only.</b> Points become a reward value for practice and motivation. Ritsu never holds, sends or receives real money.</li>
        <li><b>Fair by design.</b> Deductions need a written reason, purchases need a receipt, and nothing is deleted. Mistakes are corrected openly.</li>
        <li><b>Feelings matter.</b> Children check in with how they feel, and parents react to spending with a question instead of a lecture.</li>
        <li><b>Private.</b> Your family's data stays on your device.</li>
      </ul>
      <H>Made in Malaysia</H>
      <p>Ritsu was founded by Yusri and shaped with Adina, our UI/UX designer and Community Catalyst, from real conversations with parents and children. See <button className="linkish" onClick={() => openInfo('collab')}>Collaboration</button>.</p>
    </>
  );
}

function Guide() {
  const Step = ({ n, t, children }: { n: number; t: string; children: ReactNode }) => (
    <div className="guide-step"><span className="n" aria-hidden="true">{n}</span><div><b>{t}</b><div className="small muted">{children}</div></div></div>
  );
  return (
    <>
      <p className="kicker">User guide</p>
      <h1 className="title">Getting started</h1>
      <p className="lead">Five minutes to set up, then a few taps a day.</p>
      <H>For parents</H>
      <Step n={1} t="Create your account">Tap Create account, then set up your family: your name, each child's name and age, and the value of one point (RM1 by default).</Step>
      <Step n={2} t="Protect profiles with a PIN (optional)">On a shared phone or tablet, set a 4-digit PIN for each person so children can't open a parent's profile.</Step>
      <Step n={3} t="Agree the rules">In Settings → Household rules, check the starter list of merits and demerits and edit the points. Children can see these rules.</Step>
      <Step n={4} t="Award or deduct">Tap Award, pick the child and what happened. Merits need a photo or link as proof (you can turn this off in Settings). Deductions always need a written reason your child will read.</Step>
      <Step n={5} t="Answer questions">If a child asks about a deduction, it appears under Needs you. Keep it, reverse it, or give some points back, with a short reply.</Step>
      <Step n={6} t="React to spending">Under Spending on the home screen, see each purchase with its receipt and your child's mood. Tap 👍 Good choice, 🙂 Okay, 🤔 Why so much? or 💬 Let's talk.</Step>
      <Step n={7} t="Approve the monthly allowance">On the Allowance tab, Ritsu shows how the amount was worked out: base + points × value + bonus, within your minimum and maximum. Adjust if you like, then approve.</Step>
      <H>For children</H>
      <Step n={1} t="Say how you feel">Each day, tap the face that matches your mood on your home screen.</Step>
      <Step n={2} t="Watch your points grow">See your points, streak, level and badges. Finish weekly challenges for extra stars.</Step>
      <Step n={3} t="Log what you buy">Tap I spent money, say how much, how you feel, and add a picture of the receipt or a link.</Step>
      <Step n={4} t="Ask if something seems unfair">Open the deduction and tap to ask about it. Your grown-up will reply.</Step>
      <Step n={5} t="Save for something">Make a savings jar for something you want and add to it when you can.</Step>
      <H>For individuals</H>
      <p>Choose Just me during setup. Track your own habits on Today, log income, spending (with receipts) and savings on Money, see trends on Insights, and write a short monthly Review.</p>
      <H>Keeping your data safe</H>
      <p>Everything is saved in this browser on this device. Go to Settings → Your account → <b>Download backup</b> regularly, and use <b>Restore backup</b> to move to a new phone. Clearing your browser data deletes your Ritsu data too.</p>
    </>
  );
}

function Collab() {
  return (
    <>
      <p className="kicker">Key collaboration</p>
      <h1 className="title">Built with the people who use it</h1>
      <p className="lead">Ritsu started from real pain points shared by parents and children, not from a feature list.</p>
      <div className="grid md2">
        <div className="card person">
          <YusriAvatar size={112} />
          <div><b>Yusri</b><div className="small muted">Founder</div></div>
          <p className="small">Product vision, rules and reward logic, and building Ritsu.</p>
        </div>
        <div className="card person">
          <AdinaAvatar size={112} />
          <div><b>Adina</b><div className="small muted">UI/UX Designer · Community Catalyst</div></div>
          <p className="small">Led the research into user pain points, ran conversations with families and the community, and shaped how Ritsu looks and feels so it is easy for both parents and children.</p>
        </div>
      </div>
      <H>Pain points we set out to fix</H>
      <ul>
        <li>Children don't know why they lost points, so rewards feel unfair. <b>→ Every deduction needs a written reason, and children can ask about it.</b></li>
        <li>Parents forget what was promised and argue about pocket money. <b>→ Clear rules and a monthly allowance worked out the same way every time.</b></li>
        <li>Spending happens out of sight. <b>→ Receipts or photos for every purchase, and a gentle "why so much?" from parents.</b></li>
        <li>Feelings get lost behind numbers. <b>→ Daily mood check-ins and a mood on each purchase.</b></li>
        <li>Two parents, two sets of rules. <b>→ Co-guardian deductions above a limit need the main guardian's approval.</b></li>
      </ul>
      <H>Join the community</H>
      <p>Have an idea or a pain point we haven't solved? Tell us through the <a href="https://github.com/YushAbdullah/RITSU/issues" target="_blank" rel="noopener noreferrer">Ritsu project page</a>. Every suggestion is read.</p>
    </>
  );
}

function Privacy() {
  return (
    <>
      <p className="kicker">Privacy policy</p>
      <h1 className="title">Your family's data stays with you</h1>
      <p className="small muted">Last updated {UPDATED}</p>
      <H>The short version</H>
      <ul>
        <li>Ritsu stores your account and family data <b>only in this browser on this device</b>. We do not run a server that receives it.</li>
        <li>We do not sell, share or rent your data. We do not show ads or use tracking cookies.</li>
        <li>Ritsu uses play money only and never asks for bank or card details.</li>
      </ul>
      <H>What is stored</H>
      <ul>
        <li><b>Account:</b> name, email and a password hash (PBKDF2-SHA256, never the password itself).</li>
        <li><b>Family:</b> names, ages and avatars of family members, optional PIN hashes, rules, points history, allowance cycles, savings goals, money entries, mood check-ins, reactions and the audit log.</li>
        <li><b>Proof:</b> photos you attach are shrunk and stored on the device; links are stored as text. Opening a link takes you to that website, which has its own privacy policy.</li>
      </ul>
      <H>Where it is stored</H>
      <p>In your browser's local storage on the device you use. It is not sent to Ritsu or anyone else. Anyone with access to the device and browser may be able to see it, so use profile PINs and your device's lock screen. If a future version offers optional cloud sync, this policy will be updated and you will be asked before anything leaves your device.</p>
      <H>Children's data</H>
      <p>Children's profiles are created and managed by a parent or guardian, who is responsible for consent. Children cannot create accounts on their own. Parents can view, change or delete any child's data at any time.</p>
      <H>Your rights</H>
      <p>Because the data is on your device, you are in control. You can view it in the app, export it with <b>Download backup</b>, correct it, or erase it with <b>Delete account</b> in Settings (or by clearing your browser data). This reflects the principles of Malaysia's Personal Data Protection Act 2010 (PDPA).</p>
      <H>Third parties</H>
      <p>The app is delivered by a static website host and loads its font from Google Fonts. Like any website, these services may see your IP address and browser type when you open the page. They never receive your Ritsu data.</p>
      <H>Contact</H>
      <p>Questions about privacy? Reach us through the <a href="https://github.com/YushAbdullah/RITSU/issues" target="_blank" rel="noopener noreferrer">Ritsu project page</a>.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <p className="kicker">Terms of service and conditions</p>
      <h1 className="title">Terms of use</h1>
      <p className="small muted">Last updated {UPDATED}</p>
      <p>By creating an account or using Ritsu, you agree to these terms. If you do not agree, please don't use the app.</p>
      <H>1. What Ritsu is</H>
      <p>Ritsu is a free tool for tracking habits, points and play-money rewards for families and individuals. It is offered "as is" and may change over time.</p>
      <H>2. Play money only</H>
      <p>Points and their reward value are for motivation and practice. Ritsu is not a bank, wallet or payment service. It does not hold, transfer or pay out real money, and nothing in Ritsu creates a legal obligation to pay anyone. Any real pocket money you choose to give is agreed between you and your family.</p>
      <H>3. Accounts and children</H>
      <ul>
        <li>You must be 18 or older, or the parent or legal guardian of the children you add, to create an account.</li>
        <li>You are responsible for the profiles you create, for keeping your password and PINs safe, and for supervising children's use.</li>
        <li>Give accurate information and use Ritsu kindly. Reasons, notes and reactions should be respectful to children.</li>
      </ul>
      <H>4. Your content</H>
      <p>Photos, links, notes and other content you add remain yours. Only add content you have the right to use, and do not upload anything unlawful, harmful or that identifies people outside your family without their permission.</p>
      <H>5. Your data and backups</H>
      <p>Data is stored on your device (see the <button className="linkish" onClick={() => openInfo('privacy')}>Privacy policy</button>). You are responsible for keeping backups. We cannot recover data that is lost when a device is reset, a browser's data is cleared, or storage runs out.</p>
      <H>6. Acceptable use</H>
      <p>Don't misuse Ritsu: no attempts to break, overload or reverse-engineer the service to cause harm, and no use that breaks the law.</p>
      <H>7. No warranty and limit of liability</H>
      <p>Ritsu is provided without warranties of any kind. To the fullest extent allowed by law, the Ritsu team is not liable for indirect or consequential loss, lost data, or decisions made using the app. Ritsu is a parenting aid, not professional, financial or psychological advice.</p>
      <H>8. Changes and ending use</H>
      <p>We may update these terms; the date above will change and continued use means you accept the new terms. You can stop using Ritsu at any time and delete your account in Settings.</p>
      <H>9. Governing law</H>
      <p>These terms are governed by the laws of Malaysia.</p>
      <H>10. Contact</H>
      <p>Questions about these terms? Reach us through the <a href="https://github.com/YushAbdullah/RITSU/issues" target="_blank" rel="noopener noreferrer">Ritsu project page</a>.</p>
    </>
  );
}
