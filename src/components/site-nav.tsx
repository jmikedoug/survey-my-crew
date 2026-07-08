import { Link } from "@tanstack/react-router";

export function SiteNav() {
  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur"
    >
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="Poll Your People — Home">
          <span
            aria-hidden="true"
            className="inline-block h-6 w-6 rounded-full bg-gradient-brand shadow-brand"
          />
          <span className="font-display text-lg font-semibold tracking-tight">
            Poll<span className="text-primary">·</span>Your·People
          </span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link
            to="/about"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            About
          </Link>
          <Link
            to="/new"
            className="rounded-full bg-gradient-brand px-4 py-2 text-sm font-medium text-white shadow-brand transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            New survey
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-8 text-xs text-muted-foreground">
        <p>
          Some product links on this site are affiliate links — if you buy through them, we may
          earn a small commission at no extra cost to you.
        </p>
        <p className="mt-2">© {new Date().getFullYear()} Poll Your People.</p>
      </div>
    </footer>
  );
}