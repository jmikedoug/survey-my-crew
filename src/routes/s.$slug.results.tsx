import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getResults, getSurvey } from "@/lib/surveys.functions";

function resultsQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["results", slug],
    queryFn: () => getResults({ data: { slug } }),
  });
}
function affQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["survey-meta", slug],
    queryFn: () => getSurvey({ data: { slug } }),
  });
}

export const Route = createFileRoute("/s/$slug/results")({
  loader: async ({ context, params }) => {
    const [results, meta] = await Promise.all([
      context.queryClient.ensureQueryData(resultsQueryOptions(params.slug)),
      context.queryClient.ensureQueryData(affQueryOptions(params.slug)),
    ]);
    if (!results) throw notFound();
    return { results, meta };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Results · ${loaderData.results.survey.title}`
          : "Results",
      },
      {
        name: "description",
        content: `See what people said about ${loaderData?.results.survey.title ?? "this survey"}.`,
      },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Couldn’t load results</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button
          className="mt-6"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </Button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Survey not found</h1>
      <Button asChild className="mt-6">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  ),
  component: ResultsPage,
});

function ResultsPage() {
  const { slug } = Route.useParams();
  const { data: results } = useSuspenseQuery(resultsQueryOptions(slug));
  const { data: meta } = useSuspenseQuery(affQueryOptions(slug));
  if (!results) return null;

  const affiliates = meta?.affiliate_links ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <Link
          to="/s/$slug"
          params={{ slug }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to survey
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {results.survey.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {results.response_count} {results.response_count === 1 ? "response" : "responses"} so far
        </p>
      </header>

      <section aria-labelledby="results-heading" className="space-y-4">
        <h2 id="results-heading" className="sr-only">
          Question results
        </h2>
        {results.questions.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No questions yet.
          </Card>
        )}
        {results.questions.map((q) => (
          <Card key={q.id} className="p-5">
            <p className="text-sm font-medium">{q.prompt}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {q.answer_count} {q.answer_count === 1 ? "answer" : "answers"}
            </p>
            <div className="mt-3">
              <ResultBody q={q} />
            </div>
          </Card>
        ))}
      </section>

      {affiliates.length > 0 && (
        <section aria-labelledby="aff-heading" className="mt-8">
          <h2 id="aff-heading" className="text-lg font-semibold">
            Related picks
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Affiliate links — we may earn a small commission if you buy through them.
          </p>
          <ul className="mt-3 space-y-2">
            {affiliates.map((a) => (
              <li key={a.id}>
                <a
                  href={`/api/public/aff/${a.id}`}
                  target="_blank"
                  rel="noopener sponsored"
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.label}</p>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {a.source}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ResultBody({
  q,
}: {
  q: NonNullable<Awaited<ReturnType<typeof getResults>>>["questions"][number];
}) {
  if (q.type === "rating") {
    const avg = q.avg_rating ?? 0;
    return (
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{avg ? avg.toFixed(1) : "—"}</span>
          <span className="text-xs text-muted-foreground">average out of 5</span>
        </div>
        <Progress value={(avg / 5) * 100} className="mt-3 h-2" />
      </div>
    );
  }
  if (q.type === "choice" || q.type === "yes_no") {
    const counts = q.choice_counts ?? {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const options =
      q.type === "yes_no"
        ? ["Yes", "No"]
        : Object.keys(counts).length
          ? Object.keys(counts)
          : ((q.options as string[] | null) ?? []);
    return (
      <ul className="space-y-2">
        {options.map((o) => {
          const n = counts[o] ?? 0;
          const pct = Math.round((n / total) * 100);
          return (
            <li key={o}>
              <div className="flex items-center justify-between text-sm">
                <span>{o}</span>
                <span className="tabular-nums text-muted-foreground">
                  {n} · {pct}%
                </span>
              </div>
              <Progress value={pct} className="mt-1 h-2" />
            </li>
          );
        })}
      </ul>
    );
  }
  const answers = q.text_answers ?? [];
  if (answers.length === 0) {
    return <p className="text-sm text-muted-foreground">No answers yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {answers.map((t, i) => (
        <li key={i} className="rounded-md bg-muted/60 p-3 text-sm">
          “{t}”
        </li>
      ))}
    </ul>
  );
}