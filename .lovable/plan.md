## What you've said we'd do "later" — recap

**Slice 6 — Audience targeting foundations** (from `.lovable/plan.md`)
- `audiences` table, `survey_audiences` join, demographic opt-in fields on `profiles`
- `/discover` route for signed-in users to answer polls matched to them
- No paid panels — opt-in matching among app users only

**Slice 5 leftovers — AI product matching polish**
- `product_suggestion` question type end-to-end in the respondent UI
- Affiliate override on Amazon/Etsy using `profiles.amazon_tag` / `etsy_tag`
- Product cards on the results page, click-tracked

**Anonymous → account nudges**
- Post-submit "Create an account to save this poll" prompt
- Claim-legacy-surveys UI on first sign-in (server fn already exists)

**Other parked polish** (not selected — noted for later)
- CSV/PDF export UI polish
- Category browse UX beyond current results

---

## This iteration — three shippable slices

### Slice A · Audience targeting v1 (minimal + browse+filter + optional profile)

**Profile page**
- New route `/_authenticated/profile` — form with three nullable fields: `age_range` (enum: under_18 / 18_24 / 25_34 / 35_44 / 45_54 / 55_plus), `gender` (free-text short + "prefer not to say"), `location_region` (free-text, e.g. "US-CA", "UK", etc.)
- Save via `updateMyProfile` server fn (`requireSupabaseAuth`)
- Nav gets a "Profile" link in the avatar menu

**Audience builder (creator side)**
- Add "Audience" step to `/new` (optional): pick target age ranges (multi), gender (any/specific), location contains (free-text substring). Stored as one `audiences` row + `survey_audiences` link with the new survey
- Existing `audiences` / `survey_audiences` tables already exist — add columns if missing (`age_ranges text[]`, `gender text`, `location_contains text`) and RLS/GRANTs

**Discover feed (browse + filter)**
- `/_authenticated/discover` becomes real: category tabs across top (All, Beauty, Food, Tech, …) + toggle "Only polls looking for me"
- When toggle is on, filter by matching `survey_audiences` criteria against caller's profile (via a `discover_polls` RPC). When off, show recent public polls
- Empty state when profile is incomplete: "Fill in your profile to see polls looking for you" → link to /profile

**Why**: matches your answers — minimal fields, category browse, optional profile, no forced onboarding. Ships value even for users who never fill out demographics (they just see recent polls).

### Slice B · Product suggestion polish

- Respondent flow for `product_suggestion` questions:
  - Text input → debounced "Find matches" button → server fn `suggestProductMatches` (Lovable AI Gateway, gemini-2.5-flash, strict JSON schema)
  - Show up to 5 candidate cards; user picks one, or "None — use my link" (URL field), or "Skip"
  - Store choice in `answers` (title, suggested_url)
- Results page renders "Suggested products" as clickable cards linking through `/api/public/aff/$id` (creates `affiliate_links` rows on the fly per unique URL+survey)
- Affiliate override already lives in `survey-submit.server.ts` — verify it fires and add tests via Playwright

**Why**: the schema is there but the respondent-side UX is stubbed. This closes the loop and makes the affiliate revenue path real.

### Slice C · Anonymous → account conversion

- After a signed-out respondent submits, show a soft banner on the thanks screen: "Create an account to save your poll history and get matched to more polls" → CTA to `/auth?redirect=/history`
- On first sign-in, if `localStorage.creator_token` exists, quietly call `claimAnonSurveys({ token })` and toast "Claimed N surveys you made before signing in"
- Add same claim call for anonymous responses: store a `respondent_token` in localStorage per submit (like creator_token), and add `claim_responses(_token)` RPC + server fn that fills `responses.user_id` on first sign-in

**Why**: converts drive-by respondents/creators into accounts without gating the public flow.

---

## Technical notes

- New RPC `discover_polls(_only_matching bool, _category text)` — SECURITY DEFINER, joins `surveys` + `survey_audiences` + `audiences` + caller's `profiles`, returns `{slug, title, category, response_count, match_reason}`. `SET search_path = public`.
- New RPC `claim_responses(_token text)` — matches SECURITY DEFINER pattern used by `claim_surveys`.
- All new columns/tables: GRANT + RLS in the same migration. `audiences` policies: owner-only. `profiles` demographic columns keep existing RLS (already scoped to `auth.uid()`).
- No new external secrets. Product matching uses existing `LOVABLE_API_KEY`.
- Discover uses `useSuspenseQuery` + loader `ensureQueryData` under `_authenticated/` (safe to call protected server fns there).

## Order of execution

1. Migration: profile demographic columns, `audiences`/`survey_audiences` column additions, `discover_polls` + `claim_responses` RPCs, RLS/GRANTs
2. Slice A: `/profile`, audience step in `/new`, real `/discover`
3. Slice B: respondent product_suggestion UI, results product cards, affiliate verification
4. Slice C: post-submit account nudge, auto-claim on sign-in for both surveys and responses

Tell me to start, or say "skip B" / "just A" / "reorder" and I'll re-plan.
