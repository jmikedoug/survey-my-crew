# Poll-Your-People

Survey your people about the small stuff — deodorants that survive a heat wave, books
worth a curated list, anything you'd rather crowdsource than guess at. Create a poll,
share a link, read the aggregated report.

Stack: React 19 + TanStack Start (SSR) + Tailwind v4 + shadcn/ui, Supabase for
database/auth, affiliate links with click tracking.

## Local development

```bash
bun install
cp self-host/.env.example .env   # fill in your Supabase project values
bun dev                          # http://localhost:8080
```

## Structure

```
src/routes/            file-based routes (public poll pages + _authenticated area)
src/lib/*.functions.ts server functions (createServerFn) — all DB writes
src/lib/mcp/           agent (MCP) read tools
src/integrations/      generated Supabase + auth clients
supabase/migrations/   schema history
self-host/             kit + guide for running this outside Lovable
```

## Running it yourself

See [`self-host/README.md`](./self-host/README.md) for the full migration guide:
own Supabase project, schema bootstrap SQL, the file swaps that remove
Lovable-specific dependencies, and Vercel/Netlify deployment.

## Security notes

- Every table has RLS on; poll content is publicly readable, responses and profiles
  are owner-only.
- `surveys.creator_token` is a bearer secret and is excluded from public reads via
  column-level grants.
- Affiliate redirects (`/api/public/aff/:id`) only allow known retailer domains.
