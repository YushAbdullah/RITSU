# Ritsu: merit and reward platform

Ritsu helps families and individuals build habits, accountability and money skills with a transparent points system. Good actions earn points, slips cost points, and points convert into a monthly allowance (Family Mode) or a guilt-free reward budget (Individual Mode). Default rate: **1 point = RM1**, configurable.

This repository holds the working **mobile-first MVP** (Phase 0 prototype) and the technical plan.

## What's in the MVP

| Role | Dashboard |
| --- | --- |
| Guardian (admin) | Family overview with a "Needs you" queue (approvals, disputes), 3-tap award or deduct, full ledger with corrections, monthly allowance with a line-by-line formula and approval, reports (daily, weekly, monthly; merit vs demerit, running total, categories, month comparison), settings (conversion rate, allowance rules, household rules, members, audit log) |
| Co-guardian | Award and view; deductions above the threshold wait for the guardian |
| Child | Big points counter with RM value, streak, level, badges, weekly challenges, savings jars, spending log (need vs want), full history with a "Not fair?" dispute button, and the household rules |
| Individual adult | Daily habit check-in, habit score, reward fund, budget ring, income and spending tracker, savings goals, insights, monthly self-assessment |

Every transaction stores timestamp, category, description, member and authorised actor. Nothing is edited or deleted: mistakes are fixed with reversal entries, and every write is audit-logged.

Demo data: the Rahman family (guardian Aisyah, co-guardian Faiz, Danish 9, Sara 15) and an individual, Hafiz. Pick any profile on the start screen. Data is stored in the browser (localStorage); **Settings → Reset demo data** restores it.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # points and allowance engine tests
npm run build        # static build in dist/
npm run build:single # one self-contained HTML file in dist-single/
```

## Code map

| Path | What |
| --- | --- |
| `src/lib/types.ts` | Domain model (accounts, members, rules, transactions, disputes, cycles, goals, money, assessments, audit) |
| `src/lib/logic.ts` | Pure engine: summaries, allowance formula, streaks, levels, badges, challenges, analytics series, finance and discipline score |
| `src/lib/store.ts` | Every state change as a pure, validated, audit-logged action (role checks live here) |
| `src/lib/seed.ts` | Six weeks of deterministic demo data |
| `src/views/` | Guardian, Child and Individual screens |
| `src/components/` | UI kit and hand-rolled SVG charts |
| `docs/PRODUCT_PLAN.md` | Roles, IA, ERD, architecture, points and allowance logic, roadmap, acceptance criteria |
| `docs/screens/` | Screenshots of every screen at phone and desktop widths |

## Design

Based on the Ember & Steel design system, split into two themes: a professional steel-and-brick theme (Montserrat + Bebas Neue, dark mode supported) for guardians and adults, and a warm, rounded kid theme (Nunito + Fredoka, large numbers) for children. Merit and demerit use a colour-blind-safe blue/brick pair and are also separated by position (above or below the zero line).

## Next steps

See the roadmap in `docs/PRODUCT_PLAN.md`: backend API with PostgreSQL and real sign-in (Phase 1), family beta with invites and notifications (Phase 2), individual-mode polish (Phase 3), and launch with subscriptions (Phase 4).
