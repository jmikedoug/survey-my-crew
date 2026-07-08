import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getResults } from "@/lib/surveys.functions";

function opts(slug: string) {
  return queryOptions({ queryKey: ["results-print", slug], queryFn: () => getResults({ data: { slug } }) });
}

export const Route = createFileRoute("/s/$slug/print")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `Print · ${loaderData.survey.title}` : "Print" },
      { name: "robots", content: "noindex" },
    ],
  }),
  notFoundComponent: () => <p className="p-8">Not found.</p>,
  errorComponent: ({ error }) => <p className="p-8 text-red-600">{error.message}</p>,
  component: PrintPage,
});

function PrintPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  if (!data) return null;
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 print:py-0 print:px-0">
      <style>{`@media print { nav, footer { display: none !important; } body { background: #fff !important; } }`}</style>
      <header className="mb-6 border-b pb-4">
        <h1 className="text-2xl font-semibold">{data.survey.title}</h1>
        {data.survey.description && <p className="mt-1 text-sm text-gray-600">{data.survey.description}</p>}
        <p className="mt-2 text-xs text-gray-500">{data.response_count} responses · Generated {new Date().toLocaleString()}</p>
      </header>
      <ol className="space-y-6">
        {data.questions.map((q) => (
          <li key={q.id}>
            <h2 className="text-base font-medium">{q.position + 1}. {q.prompt}</h2>
            <p className="text-xs text-gray-500">{q.answer_count} answers</p>
            {q.type === "rating" && (
              <p className="mt-1 text-sm">Average: <strong>{q.avg_rating ? q.avg_rating.toFixed(2) : "—"}</strong> / 5</p>
            )}
            {(q.type === "choice" || q.type === "yes_no") && q.choice_counts && (
              <ul className="mt-1 space-y-0.5 text-sm">
                {Object.entries(q.choice_counts).map(([k, v]) => (
                  <li key={k}>· {k} — {v}</li>
                ))}
              </ul>
            )}
            {q.type === "text" && q.text_answers && (
              <ul className="mt-1 space-y-1 text-sm">
                {q.text_answers.map((t, i) => <li key={i} className="italic">“{t}”</li>)}
              </ul>
            )}
            {q.type === "product_suggestion" && q.product_suggestions && (
              <ul className="mt-1 space-y-0.5 text-sm">
                {q.product_suggestions.map((p, i) => (
                  <li key={i}>· {p.title} — {p.votes} vote{p.votes === 1 ? "" : "s"}{p.url ? ` (${p.url})` : ""}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-8 text-xs text-gray-500">Use your browser's Save as PDF option when the print dialog appears.</p>
    </div>
  );
}