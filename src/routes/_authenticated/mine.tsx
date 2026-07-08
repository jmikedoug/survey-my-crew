import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, FileDown, BarChart3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMySurveys, duplicateSurvey, exportSurveyCsv } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/mine")({
  head: () => ({
    meta: [
      { title: "My surveys · Poll Your People" },
      { name: "description", content: "Surveys you've created." },
    ],
  }),
  component: MinePage,
});

function MinePage() {
  const router = useRouter();
  const list = useServerFn(getMySurveys);
  const dup = useServerFn(duplicateSurvey);
  const exp = useServerFn(exportSurveyCsv);
  const q = useQuery({ queryKey: ["my-surveys"], queryFn: () => list({}) });

  async function onDup(slug: string) {
    try {
      const out = await dup({ data: { slug } });
      toast.success("Duplicated");
      router.navigate({ to: "/s/$slug", params: { slug: out.slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to duplicate");
    }
  }

  async function onExport(slug: string) {
    try {
      const out = await exp({ data: { slug } });
      const blob = new Blob([out.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = out.filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My surveys</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything you've created.</p>
        </div>
        <Button asChild size="sm" className="rounded-full bg-gradient-brand text-white shadow-brand">
          <Link to="/new">New survey</Link>
        </Button>
      </header>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data?.length === 0 && (
        <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
          You haven't created any surveys yet.{" "}
          <Link to="/new" className="font-medium text-primary hover:underline">Start one →</Link>
        </Card>
      )}
      <ul className="space-y-2">
        {q.data?.map((s) => (
          <li key={s.id}>
            <Card className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link to="/s/$slug" params={{ slug: s.slug }} className="truncate font-medium hover:underline">
                  {s.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {s.response_count} {s.response_count === 1 ? "response" : "responses"} · {new Date(s.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/s/$slug/results" params={{ slug: s.slug }}>
                    <BarChart3 className="mr-1 h-3.5 w-3.5" /> Results
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => onDup(s.slug)}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button variant="outline" size="sm" onClick={() => onExport(s.slug)}>
                  <FileDown className="mr-1 h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}