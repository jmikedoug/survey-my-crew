# Migrate Poll-Your-People off Lovable

Goal: own the code on GitHub, own the database in your own Supabase account, host on Vercel or Netlify. Fresh start on data (schema only, no rows carried over).

## What can and can't move

- **Code**: fully portable. Git sync pushes the whole repo to GitHub; nothing about it is Lovable-specific except a few build/config packages listed below.
- **Database**: the current backend is a Lovable-managed Supabase project. It can't be transferred into your account, and privileged credentials (service role key, DB password) aren't exposed here. Instead we recreate the schema in a Supabase project you own — you'll have the dashboard and all keys there.

## Step 1 — GitHub

Connect GitHub from the chat "+" menu → GitHub → Connect project, and create the repo. Sync is two-way, so you can keep editing here or locally until you cut over.

## Step 2 — Your own Supabase project

You create a project at supabase.com. I prepare a single consolidated `supabase/migrations/00000000000000_init.sql` that recreates everything, in dependency order:

- Enums: `question_type`
- Tables: `profiles`, `surveys`, `questions`, `responses`, `answers`, `affiliate_links`, `affiliate_clicks`, `audiences`, `survey_audiences` — with GRANTs, RLS enabled, and every current policy
- Functions: `handle_new_user`, `touch_updated_at`, `claim_surveys`, `claim_responses`, `duplicate_survey`, `get_survey_results`, `discover_polls` (with the same `SECURITY DEFINER` / `search_path` / EXECUTE-revoke hardening)
- Triggers: `on_auth_user_created`, `profiles_updated_at`, `audiences_updated_at`

You run it with `supabase db push` (or paste into the SQL editor). Then enable Email and Google providers in your project's Auth settings and add your Google OAuth client.

## Step 3 — De-Lovable the app code

Replace the pieces that only work inside Lovable:

- `src/integrations/lovable/*` Google sign-in broker → plain `supabase.auth.signInWithOAuth('google', { redirectTo })` in `src/routes/auth.tsx`.
- `src/integrations/supabase/client.ts` and `client.server.ts` are generated files; convert them into normal committed files reading `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` and server-side `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
- **Lovable AI Gateway** powers AI product matching (`src/lib/product-matching.functions.ts`) and depends on `LOVABLE_API_KEY`, which does not travel. Swap to a direct provider key (OpenAI or Google Gemini) that you own, read from `process.env` inside the handler.
- **Agent integrations (MCP)** at `/mcp` rely on the Lovable MCP plugin and Lovable's OAuth server. Decision point: either drop MCP for the initial cutover (simplest), or re-implement OAuth against your own Supabase authorization server later. Plan assumes drop-and-revisit unless you say otherwise.
- `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which bundles TanStack Start, React, Tailwind, tsconfig paths and Nitro. Replace with a plain `vite.config.ts` composing those plugins directly, and target the Node/Vercel preset instead of Cloudflare Workers.
- Remove `componentTagger` / sandbox-specific behaviour that came from that config package.

## Step 4 — Hosting on Vercel or Netlify

- Add a Nitro preset for the host (`vercel` or `netlify`) in the new vite config.
- Env vars to set in the host dashboard: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus your AI provider key.
- Move the `pyp.jmikedoug.com` DNS to the new host once the deploy is green, and add that origin to Supabase Auth redirect URLs.
- I'll add a `README.md` with local setup (`bun install`, `.env.example`, `supabase db push`, `bun dev`) so the repo stands on its own.

## Verification

- Local run against your Supabase: sign up with email, sign in with Google, create a poll, submit it anonymously in a private window, view results, duplicate, export CSV.
- Confirm RLS still blocks cross-user reads (a second account cannot see the first's surveys or profile).

## Notes

- Nothing in this plan deletes the Lovable project — it keeps working until you switch DNS, so you can roll back.
- Existing poll data stays here. If you later want it, request an export in More → Cloud → Advanced settings and we can import it.
