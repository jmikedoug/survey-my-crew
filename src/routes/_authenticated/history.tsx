import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { getMyResponseHistory } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Polls I took · Poll Your People" },
      { name: "description", content: "Surveys you've answered." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const list = useServerFn(getMyResponseHistory);
  const q = useQuery({ queryKey: ["my-history"], queryFn: () => list({}) });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Polls I took</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every survey you've answered while signed in.</p>
      </header>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.data?.length === 0 && (
        <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
          No poll history yet. When you take a friend's poll while signed in, it'll show up here.
        </Card>
      )}
      <ul className="space-y-2">
        {q.data?.map((r) => (
          <li key={r.id}>
            <Card className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <Link to="/s/$slug/results" params={{ slug: r.survey.slug }} className="truncate font-medium hover:underline">
                  {r.survey.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {r.survey.category ? `${r.survey.category} · ` : ""}
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}