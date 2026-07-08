import { createFileRoute, Link, useNavigate, useRouter, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getSurvey, submitResponse } from "@/lib/surveys.functions";

type SurveyData = NonNullable<Awaited<ReturnType<typeof getSurvey>>>;

function surveyQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["survey", slug],
    queryFn: () => getSurvey({ data: { slug } }),
  });
}

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(surveyQueryOptions(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.survey.title} · Poll Your People` : "Survey" },
      {
        name: "description",
        content:
          loaderData?.survey.description?.slice(0, 155) ??
          "Answer a quick survey from a friend.",
      },
      { property: "og:title", content: loaderData?.survey.title ?? "Survey" },
      {
        property: "og:description",
        content: loaderData?.survey.description ?? "Answer a quick survey from a friend.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Couldn’t load this survey</h1>
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
  notFoundComponent: () => {
    const { slug } = Route.useParams();
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Survey not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn’t find <span className="font-mono">/s/{slug}</span>.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    );
  },
  component: RespondPage,
});

function RespondPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(surveyQueryOptions(slug));
  const submit = useServerFn(submitResponse);

  const survey = data!;
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, { n?: number; t?: string; c?: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setShareUrl(window.location.href);
  }, []);

  function setVal(id: string, patch: { n?: number; t?: string; c?: string }) {
    setValues((v) => ({ ...v, [id]: { ...v[id], ...patch } }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const answers = survey.questions
      .map((q) => {
        const v = values[q.id] ?? {};
        if (q.type === "rating" && typeof v.n === "number")
          return { question_id: q.id, value_number: v.n };
        if (q.type === "text" && v.t && v.t.trim())
          return { question_id: q.id, value_text: v.t.trim() };
        if ((q.type === "choice" || q.type === "yes_no") && v.c)
          return { question_id: q.id, value_choice: v.c };
        return null;
      })
      .filter(Boolean) as { question_id: string; value_number?: number; value_text?: string; value_choice?: string }[];

    if (answers.length === 0) return toast.error("Please answer at least one question");

    setSubmitting(true);
    try {
      await submit({
        data: { slug, respondent_name: name.trim() || null, answers },
      });
      toast.success("Thanks for the input!");
      navigate({ to: "/s/$slug/results", params: { slug } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: survey.survey.title, url: shareUrl });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn’t copy link");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <article aria-labelledby="survey-title">
        <header className="mb-6">
          {survey.survey.category && (
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              {survey.survey.category}
            </p>
          )}
          <h1 id="survey-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {survey.survey.title}
          </h1>
          {survey.survey.description && (
            <p className="mt-2 text-muted-foreground">{survey.survey.description}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={share}>
              <Share2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> Share
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/s/$slug/results" params={{ slug }}>
                View results
              </Link>
            </Button>
          </div>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          {survey.questions.map((q, i) => (
            <Card key={q.id} className="p-5">
              <div className="mb-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Question {i + 1} of {survey.questions.length}
                </span>
                <p className="mt-1 text-base font-medium">{q.prompt}</p>
              </div>
              <QuestionField
                q={q}
                value={values[q.id]}
                onChange={(patch) => setVal(q.id, patch)}
              />
            </Card>
          ))}

          <Card className="space-y-3 p-5">
            <Label htmlFor="name">Your name (optional)</Label>
            <Input
              id="name"
              placeholder="Just a first name is fine"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="rounded-full bg-gradient-brand text-white shadow-brand"
            >
              {submitting ? "Sending…" : "Submit answers"}
            </Button>
          </div>
        </form>
      </article>
    </div>
  );
}

function QuestionField({
  q,
  value,
  onChange,
}: {
  q: SurveyData["questions"][number];
  value: { n?: number; t?: string; c?: string } | undefined;
  onChange: (patch: { n?: number; t?: string; c?: string }) => void;
}) {
  if (q.type === "rating") {
    return (
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={q.prompt}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value?.n === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ n })}
              className={
                "flex h-12 w-12 items-center justify-center rounded-full border text-base font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (active
                  ? "border-transparent bg-gradient-brand text-white shadow-brand"
                  : "border-border bg-background text-foreground hover:bg-accent/40")
              }
            >
              {n}
            </button>
          );
        })}
      </div>
    );
  }
  if (q.type === "yes_no") {
    return (
      <RadioGroup
        value={value?.c ?? ""}
        onValueChange={(v) => onChange({ c: v })}
        className="flex gap-3"
        aria-label={q.prompt}
      >
        {["Yes", "No"].map((o) => (
          <label
            key={o}
            className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm hover:bg-accent/30 has-[:checked]:border-primary has-[:checked]:bg-accent/40"
          >
            <RadioGroupItem value={o} />
            <span>{o}</span>
          </label>
        ))}
      </RadioGroup>
    );
  }
  if (q.type === "choice") {
    return (
      <RadioGroup
        value={value?.c ?? ""}
        onValueChange={(v) => onChange({ c: v })}
        className="space-y-2"
        aria-label={q.prompt}
      >
        {(q.options ?? []).map((o) => (
          <label
            key={o}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm hover:bg-accent/30 has-[:checked]:border-primary has-[:checked]:bg-accent/40"
          >
            <RadioGroupItem value={o} />
            <span>{o}</span>
          </label>
        ))}
      </RadioGroup>
    );
  }
  return (
    <Textarea
      value={value?.t ?? ""}
      onChange={(e) => onChange({ t: e.target.value })}
      placeholder="Type your answer…"
      rows={3}
      maxLength={2000}
      aria-label={q.prompt}
    />
  );
}

export { Copy };