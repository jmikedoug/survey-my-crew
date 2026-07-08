import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Users, BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Poll Your People — quick surveys for the small stuff" },
      {
        name: "description",
        content:
          "Ask your friends about the tiny everyday things — deodorants, books, playlists — and get a clean report of what they think.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const primaryTo = user ? "/new" : "/auth";
  const primarySearch = user ? undefined : ({ redirect: "/new" } as const);

  return (
    <div>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-soft opacity-70"
        />
        <div className="relative mx-auto max-w-3xl px-4 pb-14 pt-12 sm:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            For the small stuff you never get around to
          </div>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Ask your people.
            <br />
            <span className="bg-gradient-brand bg-clip-text text-transparent">
              Decide the small stuff.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Which deodorant, which book, which pizza place. Spin up a two-minute survey, send
            the link to your friends, and get a clean little report back.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-full bg-gradient-brand text-white shadow-brand hover:opacity-95">
              {primarySearch ? (
                <Link to={primaryTo} search={primarySearch}>
                  Create a survey <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <Link to={primaryTo}>
                  Create a survey <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </Button>
            <Button asChild variant="ghost" size="lg" className="rounded-full">
              <Link to="/about">How it works</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="grid gap-3 sm:grid-cols-3">
          <FeatureCard
            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            title="Build in minutes"
            body="Mix ratings, multiple choice, yes/no, and free text."
          />
          <FeatureCard
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
            title="No signups for friends"
            body="They tap your link, answer, done — no account needed."
          />
          <FeatureCard
            icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
            title="Instant report"
            body="Averages, tallies, and quotes — nothing you have to interpret."
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
          {loading ? (
            "Loading…"
          ) : user ? (
            <>
              Welcome back.{" "}
              <Link to="/mine" className="font-medium text-primary hover:underline">See my surveys →</Link>
            </>
          ) : (
            <>
              <Link to="/auth" className="font-medium text-primary hover:underline">Create an account</Link>{" "}
              to save your surveys, take polls with history, and export answers.
            </>
          )}
        </Card>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent/40 text-accent-foreground">
        {icon}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </Card>
  );
}
