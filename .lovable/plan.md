## Scope

Five asks, grouped into shippable slices. Public respond stays public; creating/duplicating/exporting requires an account. Respondents see a soft "Create an account to save your poll history" prompt.

## Slice 1 — Accounts (Email + Google)

- Enable Supabase auth: email/password + Google (managed). No auto-confirm.
- New `/auth` public route (sign in / sign up tabs, Google button).
- `profiles` table (id → auth.users, display_name, created_at) auto-created via trigger on signup.
- `responses.user_id` (nullable) — filled when a signed-in user takes a poll, powering "polls you took".
- `surveys.user_id` — filled on create; keep `creator_token` for legacy/anon migration.
- Root nav: show sign-in state (avatar menu with Sign out, My surveys, Polls I took).
- Migrate existing localStorage `creator_token` surveys: on first sign-in, offer one-tap claim (server fn matches token → sets user_id).
- Protected routes under `_authenticated/`: `/new`, `/mine`, `/s/$slug/results` (creator-only), `/s/$slug/export`.

## Slice 2 — My surveys & Polls I took

- `/mine` — list surveys the user created (with response counts, links to results/edit/duplicate/export).
- `/history` — list surveys the user has responded to (via `responses.user_id`).
- Landing page nudges signed-out respondents post-submit: "Create an account to save this poll."

## Slice 3 — Duplicate a survey

- Server fn `duplicateSurvey({ slug })` — auth required. Copies survey + questions (not responses/answers) under the caller's account with new slug. Copies affiliate links too.
- "Duplicate for my audience" button on results page + `/mine` row action.

## Slice 4 — Export answers

- CSV: server fn streams `text/csv` — one row per response, columns = respondent, submitted_at, then one column per question (choice/text/rating/yes-no rendered as string).
- PDF summary: server-rendered HTML → client-side print-to-PDF via a `/s/$slug/results/print` route styled for print (avoids adding a heavy PDF lib on the Worker). Button labeled "Download PDF" triggers `window.print()`.
- Both gated to survey owner.

## Slice 5 — AI product matching (respondent suggests a product)

- New question type: `product_suggestion`. Respondent types a product name.
- On blur / "Find matches", client calls `suggestProductMatches` server fn → Lovable AI Gateway (google/gemini-2.5-flash) with a strict JSON schema prompt: returns up to 5 candidates `{title, brand, category, guessed_url}`.
- Respondent picks one match (or "None of these — use my link" with a URL field, or "Skip").
- Stored on `answers` as `value_text` = chosen title, `value_choice` = candidate id, plus a new `answers.suggested_url` column for the raw/user URL.
- Affiliate override: server fn `resolveAffiliateUrl(url)` — if the domain matches a known partner (Amazon, Etsy) and the survey owner has an affiliate tag configured on their profile (`profiles.amazon_tag`, `profiles.etsy_tag`), rewrite the URL (strip existing tag, inject ours) before storing / rendering. User-provided affiliate params are stripped.
- Results page shows suggested products as cards, click-tracked through existing `/api/public/aff/$id` (new affiliate_links rows created on the fly per unique product per survey).

## Slice 6 — Foundations for audience targeting (later)

Not built now, but structured so it drops in cleanly:

- `audiences` table (owner_id, name, criteria jsonb — age_range, gender, location, ethnicity, hair_type, free-form tags).
- `survey_audiences` join table (survey_id → audience_id, quota).
- `profiles` gets demographic opt-in fields (nullable, self-reported): age_range, gender, location_region, ethnicity[], hair_type, interests[].
- `/discover` route stub for signed-in users → shows polls whose audience criteria match their profile. Empty state today; wired to real matching in a future turn.
- No paid distribution / panel integration yet — this is opt-in matching among app users.

## Technical notes

- All new tables get `GRANT` + RLS in the same migration. Owner policies via `auth.uid()`; responses readable by survey owner via `EXISTS` on surveys.
- Existing anonymous flows keep working — auth is additive.
- Google OAuth uses `lovable.auth.signInWithOAuth` with `redirect_uri: window.location.origin`; provider configured via `supabase--configure_social_auth`.
- Lovable AI calls: server-side only, using `LOVABLE_API_KEY` (already set).
- No new external secrets required.

## Order of execution

1. Migration: auth-adjacent tables (`profiles`, columns on `surveys`/`responses`/`answers`, `audiences`, `survey_audiences`) + RLS + trigger.
2. Configure Google auth.
3. Auth UI + `_authenticated` layout + nav state.
4. Claim-legacy-surveys flow.
5. `/mine`, `/history`, duplicate, CSV + PDF export.
6. AI product matching + affiliate override.
7. `/discover` stub.

Ask me to start, or say which slice to defer.
