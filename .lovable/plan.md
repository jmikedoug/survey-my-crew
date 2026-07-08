
# Poll-Your-People — Build Plan

A mobile-first web app (installable PWA-style) where you create a survey about anything (deodorants, books, movies…), share a link with friends, collect responses anonymously, and view a clean results report. Built so user accounts, affiliate links, and native mobile can slot in later without a rewrite.

## Scope for v1 (this build)

In:
- Create a survey: title, description, category, questions (rating 1–5, multiple choice, short text, yes/no).
- Share via unique link (`/s/:slug`).
- Friends respond without an account (optional first name).
- Results page: per-question aggregates (avg rating, bar charts, response list).
- Optional affiliate product links attached to a survey/question (e.g. Amazon/Etsy URL + label), rendered with a clear "affiliate" disclosure and click tracking.
- Home: list of surveys you created on this device (tracked via a local `creator_token` stored in `localStorage`, later migratable to a real `user_id`).
- Mobile-first layout, sleek/minimal, Tiffany blue + violet + white theme, WCAG AA.

Out (later):
- Real user accounts, profile pics, phone numbers, addresses, passwords, payments, shipping — not needed for v1, but the schema leaves room.
- Native iOS/Android — the PWA works on phones now; wrap with Capacitor later.
- AI-generated report summaries — easy add-on once results exist.

## Design system

Tokens in `src/styles.css` (oklch):
- `--primary` = violet, `--accent` = Tiffany blue, `--background` = white, soft neutral borders.
- Gradient token `--gradient-brand` (Tiffany → violet) for hero + CTAs.
- Rounded-2xl cards, generous spacing, Inter or similar clean sans (loaded via `<link>` in `__root.tsx`).
- Semantic HTML (`<main>`, `<nav>`, `<article>`, `<button>`), visible focus rings, `aria-label` on icon buttons, contrast ≥ 4.5:1.

## Backend (Lovable Cloud)

Enable Cloud. Tables:

- `surveys` — id, slug (unique), title, description, category, creator_token (text, nullable user_id later), created_at.
- `questions` — id, survey_id, position, type (`rating|choice|text|yes_no`), prompt, options (jsonb, nullable).
- `responses` — id, survey_id, respondent_name (nullable), created_at.
- `answers` — id, response_id, question_id, value_number, value_text, value_choice.
- `affiliate_links` — id, survey_id (nullable), question_id (nullable), label, url, source (`amazon|etsy|creator|other`).
- `affiliate_clicks` — id, affiliate_link_id, clicked_at, referrer.

RLS on from day one, with `GRANT`s. v1 policies (no auth yet):
- `surveys`, `questions`, `affiliate_links`: `SELECT` to `anon` + `authenticated`.
- Inserts to `surveys/questions` allowed to `anon` for now (guarded by `creator_token`); tighten to `auth.uid()` when accounts land.
- `responses`/`answers`: `INSERT` to `anon`, `SELECT` only via a security-definer RPC `get_survey_results(slug)` so raw rows aren't scrape-able.
- `affiliate_clicks`: `INSERT` to `anon`, no public `SELECT`.

Data access: TanStack Start server functions (`createServerFn`) for reads/writes, publishable-key client for public reads, `supabaseAdmin` reserved for later admin work.

## Routes

- `/` — landing + "Create survey" CTA + list of my surveys (from localStorage tokens).
- `/new` — survey builder (add/remove/reorder questions).
- `/s/$slug` — respondent view (fill and submit).
- `/s/$slug/results` — aggregated report + affiliate link cards.
- `/about` — what this is, affiliate disclosure.
- Each route has its own `head()` metadata (title/description/OG).
- `sitemap.xml` + `robots.txt` added per template.

## Affiliate handling

- Links stored in DB, rendered as cards with a small "Affiliate link — I may earn a commission" note.
- Click goes through `/api/public/aff/$id` server route which records a row in `affiliate_clicks` then 302-redirects to the target URL. Works for Amazon, Etsy, creator sites uniformly.

## Future-proofing

- `creator_token` column becomes optional; add `user_id uuid references auth.users` later and a migration to backfill.
- Auth (email + Google) drops in via Lovable Cloud without schema churn.
- Capacitor wrap turns the PWA into iOS/Android apps.
- Reports upgrade: add an AI summary server fn using Lovable AI Gateway.

## Tech notes

- React 19 + TanStack Start (already scaffolded), Tailwind v4, shadcn/ui components (Button, Card, Input, RadioGroup, Slider, Progress, Sonner toasts), Recharts for result bars.
- Zod validation on every server fn input.
- No secrets needed for v1 (no Amazon API — plain affiliate URLs the user pastes).

## First implementation slice

1. Enable Lovable Cloud, run schema migration + grants + RLS + `get_survey_results` RPC.
2. Design tokens + shared layout (nav, footer with disclosure).
3. Home + `/new` builder.
4. `/s/$slug` respondent flow.
5. `/s/$slug/results` with charts + affiliate cards + click-tracking route.
6. SEO (`head()` per route, sitemap, robots), accessibility pass.

Approve this and I'll start with step 1.
