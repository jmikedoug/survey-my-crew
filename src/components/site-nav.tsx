import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User as UserIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function onSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

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
          <Link to="/about" className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            About
          </Link>
          {loading ? null : user ? (
            <>
              <Link to="/new" className="rounded-full bg-gradient-brand px-4 py-2 text-sm font-medium text-white shadow-brand transition-transform hover:-translate-y-px">
                New survey
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background hover:bg-accent/40" aria-label="Account menu">
                  <UserIcon className="h-4 w-4" aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  <DropdownMenuLabel className="truncate text-xs">
                    {user.email ?? "Signed in"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/mine">My surveys</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/history">Polls I took</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/discover">Discover</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onSignOut}>
                    <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/auth" className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground">
                Sign in
              </Link>
              <Link to="/auth" search={{ redirect: "/new" }} className="rounded-full bg-gradient-brand px-4 py-2 text-sm font-medium text-white shadow-brand transition-transform hover:-translate-y-px">
                New survey
              </Link>
            </>
          )}
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