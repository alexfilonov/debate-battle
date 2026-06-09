# UI Inventory

Use this file as the starting map for visual and interaction work. It lists
where each visible part of the app lives, what kind of component it is, and what
to inspect before changing it.

## Main Screens

| Screen | Route | File | Notes |
| --- | --- | --- | --- |
| Landing / sign in | `/` | `app/page.tsx` | Client page. Owns the marketing copy, Google sign-in button, invite-only error states, and the three "how it works" tiles. |
| Dashboard | `/dashboard` | `app/dashboard/page.tsx` | Server page. Owns the top nav, signed-in email, debate list, empty state, and debate status badges. |
| New debate flow | `/debate/new` | `app/debate/new/page.tsx` | Client page. Three-step flow for topic, resolution, and side selection. Also calls `/api/resolutions`. |
| Debate room | `/debate/[id]` | `app/debate/[id]/page.tsx` | Client page. Owns invite/join state, side badge, round sections, transcript reveal logic, judge CTA, and polling. |
| Judge results | `/debate/[id]/judge` | `app/debate/[id]/judge/page.tsx` | Client page. Owns loading/judging/error states, verdict banner, score breakdown, reasoning, and feedback sections. |

## Shared UI Components

| Component | File | Used By | Notes |
| --- | --- | --- | --- |
| Speech recorder | `components/SpeechRecorder.tsx` | Debate room | Handles recording, countdown, submit states, errors, and the "speech submitted" state. Most recorder UI changes belong here. |
| Sign out button | `components/SignOutButton.tsx` | Dashboard | Small client component for signing out through Supabase. |
| Status badge | `app/dashboard/page.tsx` | Dashboard | Inline helper component. Move to `components/` if it gets reused elsewhere. |
| Score breakdown | `app/debate/[id]/judge/page.tsx` | Judge results | Inline helper component for per-category scoring. |
| Full feedback toggle | `app/debate/[id]/judge/page.tsx` | Judge results | Inline helper component for collapsed feedback. |

## Styling Entry Points

| Area | File | Notes |
| --- | --- | --- |
| Global CSS | `app/globals.css` | Tailwind import and any global element styles. |
| Root layout | `app/layout.tsx` | Global font setup, metadata, and body-level classes. |
| Tailwind setup | `postcss.config.mjs` | Tailwind 4 is wired through PostCSS. |
| Page-level styles | `app/**/page.tsx` | Most styling is currently inline Tailwind classes inside each page. |

## Non-UI Files That Affect UI Behavior

| File | Why It Matters |
| --- | --- |
| `proxy.ts` | Redirects unauthenticated users away from protected debate routes and refreshes auth cookies. |
| `app/auth/callback/route.ts` | Sets the login/allowlist outcomes that appear as landing page error messages. |
| `app/api/resolutions/route.ts` | Controls generated resolution content shown in the new debate flow. |
| `app/api/transcribe/route.ts` | Controls recorder submit success/failure and transcript output. |
| `app/api/judge/route.ts` | Controls verdict, scores, reasoning, and feedback shown on the judge page. |
| `lib/supabase.ts` | Contains the TypeScript shapes used by UI pages for debates, speeches, and judgements. |

## Current UI Patterns

- Dark background: most screens use `bg-gray-950` with `bg-gray-900` panels.
- Rounded panels/buttons: most cards and buttons use `rounded-xl`.
- Status color language:
  - Yellow: waiting
  - Blue: in progress / affirmative
  - Orange: negative
  - Green: complete / success
  - Red: errors / recording / losing result
- Navigation is duplicated across pages rather than shared.
- Several reusable pieces are currently inline helper components inside pages.

## Good First Refactors

1. Extract a shared app shell/top nav if the nav design changes across pages.
2. Extract reusable `Button`, `Panel`, `StatusBadge`, and `SideBadge` components once visual direction is chosen.
3. Move judge-page helpers into `components/` if results UI becomes richer.
4. Create a small design token section in `app/globals.css` if colors/radii need to become consistent.
5. Replace emoji UI markers with icon components if the app moves toward a polished product feel.

## Suggested UI Work Order

1. Decide the product tone: serious debate tool, competitive game, or clean minimal app.
2. Update shared visual basics: background, panels, buttons, status/side badges.
3. Redesign the debate room next, because it is the main product surface.
4. Redesign the judge results page after the debate room so scoring and verdicts feel connected.
5. Polish landing and dashboard once the core app experience has a visual language.
