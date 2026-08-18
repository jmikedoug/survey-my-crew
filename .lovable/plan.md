# Fix sign-in on the Netlify site

Both symptoms point at one root cause: the deployed site is talking to the backend with a key it doesn't accept.

- Email/password sign-in returning **"Invalid API key"** means `VITE_SUPABASE_PUBLISHABLE_KEY` on Netlify does not belong to the project in `VITE_SUPABASE_URL` (usually a key copied from the old project, a truncated paste, or quotes/whitespace included).
- Google sign-in "works" but lands on the home page signed out for the same reason: Google returns to your site with a one-time code, the app tries to exchange it with the backend, that call fails on the bad key, so no session is stored and the page renders as a signed-out visitor.

## Step 1 — Verify the keys on Netlify (you)

In Netlify → Site configuration → Environment variables, confirm all four values come from the **new** backend project (Project Settings → API keys), with no quotes and no trailing spaces:

- `VITE_SUPABASE_URL` and `SUPABASE_URL` — the same `https://<new-ref>.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY` — the same publishable/anon key from that project

Then Deploys → **Clear cache and deploy site** (these are baked in at build time, so a plain redeploy of an old build won't pick them up).

Also confirm in the backend's Authentication → URL Configuration that both the Netlify URL and `https://pyp.jmikedoug.com` are listed as Site URL / Redirect URLs.

## Step 2 — Code changes so this fails loudly instead of silently

1. **Dedicated OAuth callback route** (`/auth/callback`): finishes the Google code exchange explicitly, shows a spinner, and on success sends the user to their saved destination (or `/mine`). On failure it shows the real error text instead of dumping the user on the home page. Google sign-in will point its return URL here.
2. **Readable error mapping** on the sign-in page: translate `Invalid API key` / failed-fetch responses into "This site isn't configured to reach the backend yet — check the deployment environment variables", so a misconfigured deploy is obvious.
3. **Startup config check**: on the sign-in page, a one-time lightweight call to the auth endpoint; if the key is rejected, show a persistent banner naming the exact env var to fix.

## Technical notes

- The callback route is public (top-level `src/routes/auth.callback.tsx`), uses `supabase.auth.exchangeCodeForSession` when a `?code=` is present and falls back to `getSession()` for hash-token returns, then reads the stashed `ppp.auth_redirect` path from `sessionStorage`.
- `src/routes/auth.tsx` changes `redirect_uri` to `${window.location.origin}/auth/callback` (still a public same-origin URL) and gains the error-mapping helper plus the config banner.
- No backend/schema changes; no changes to the shared Supabase client factory.
