import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { discoverPolls } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [
      { title: "Discover polls · Poll Your People" },
      { name: "description", content: "Browse polls or find ones looking for people like you." },
    ],
  }),
  component: Discover,
});

function Discover() {
  const discover = useServerFn(discoverPolls);
  const [category, setCategory] = useState("");
  const [onlyMatching, setOnlyMatching] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["discover", category.trim().toLowerCase(), onlyMatching],
    queryFn: () =>
      discover({ data: { only_matching: onlyMatching, category: category.trim() ? `%${category.trim()}%` : null } }),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Discover polls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse recent polls, or flip the toggle to see only polls looking for people like you.
        </p>
      </header>

      <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[180px] space-y-1.5">
          <Label htmlFor="cat">Category contains</Label>
          <Input id="cat" placeholder="beauty, food, tech…"
            value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={onlyMatching} onCheckedChange={setOnlyMatching} />
          <span>Only polls looking for me</span>
        </label>
      </Card>

      {isError && (
        <Card className="p-5 text-sm text-muted-foreground">Couldn't load polls right now.</Card>
      )}
      {isLoading && (
        <Card className="p-5 text-sm text-muted-foreground">Loading…</Card>
      )}
      {!isLoading && data && data.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {onlyMatching ? (
            <>
              No polls match your profile yet.{" "}
              <Link to="/profile" className="text-primary underline">Fill in your profile</Link> so more polls can find you,
              or turn off the filter to browse everything.
            </>
          ) : (
            <>Nothing yet in this category.</>
          )}
        </Card>
      )}
      <ul className="space-y-3">
        {data?.map((p) => (
          <li key={p.slug}>
            <Card className="p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  {p.category && (
                    <p className="text-xs font-medium uppercase tracking-wider text-primary">{p.category}</p>
                  )}
                  <Link to="/s/$slug" params={{ slug: p.slug }}
                    className="text-base font-semibold hover:underline">{p.title}</Link>
                </div>
                {p.match_reason === "match" && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Looking for you
                  </span>
                )}
              </div>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{p.response_count} response{p.response_count === 1 ? "" : "s"}</p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}