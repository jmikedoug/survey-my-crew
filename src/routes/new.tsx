import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCreatorToken, rememberSurvey } from "@/lib/creator-token";
import { createSurvey } from "@/lib/surveys.functions";

type QType = "rating" | "choice" | "text" | "yes_no";
type Draft = { type: QType; prompt: string; options: string };
type AffDraft = { label: string; url: string; source: "amazon" | "etsy" | "creator" | "other" };

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "New survey · Poll Your People" },
      {
        name: "description",
        content: "Build a quick survey to share with your friends in under two minutes.",
      },
    ],
  }),
  component: NewSurvey,
});

function NewSurvey() {
  const navigate = useNavigate();
  const create = useServerFn(createSurvey);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [questions, setQuestions] = useState<Draft[]>([
    { type: "rating", prompt: "", options: "" },
  ]);
  const [affiliates, setAffiliates] = useState<AffDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function updateQ(i: number, patch: Partial<Draft>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function removeQ(i: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }
  function addQ(type: QType = "rating") {
    setQuestions((qs) => [...qs, { type, prompt: "", options: "" }]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Give your survey a title");
    const cleaned = questions
      .map((q) => ({
        type: q.type,
        prompt: q.prompt.trim(),
        options:
          q.type === "choice"
            ? q.options
                .split("\n")
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
      }))
      .filter((q) => q.prompt.length > 0);
    if (cleaned.length === 0) return toast.error("Add at least one question");
    for (const q of cleaned) {
      if (q.type === "choice" && (!q.options || q.options.length < 2)) {
        return toast.error(`Question “${q.prompt}” needs at least 2 options`);
      }
    }
    const affClean = affiliates
      .map((a) => ({ ...a, label: a.label.trim(), url: a.url.trim() }))
      .filter((a) => a.label && a.url);

    setSubmitting(true);
    try {
      const created = await create({
        data: {
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          creator_token: getCreatorToken(),
          questions: cleaned,
          affiliate_links: affClean.length ? affClean : undefined,
        },
      });
      rememberSurvey({ slug: created.slug, title: created.title, created_at: created.created_at });
      toast.success("Survey created — share the link!");
      navigate({ to: "/s/$slug", params: { slug: created.slug } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Build your survey</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a few questions. You’ll get a shareable link at the end.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Which deodorant should I switch to?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="A little context for your friends…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={600}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category (optional)</Label>
            <Input
              id="category"
              placeholder="Books, movies, personal care…"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={60}
            />
          </div>
        </Card>

        <section aria-labelledby="questions-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="questions-heading" className="text-lg font-semibold">
              Questions
            </h2>
            <span className="text-xs text-muted-foreground">{questions.length} total</span>
          </div>

          <ul className="space-y-3">
            {questions.map((q, i) => (
              <li key={i}>
                <Card className="space-y-3 p-4">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Question {i + 1}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <Select
                        value={q.type}
                        onValueChange={(v) => updateQ(i, { type: v as QType })}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rating">Rating 1–5</SelectItem>
                          <SelectItem value="choice">Multiple choice</SelectItem>
                          <SelectItem value="yes_no">Yes / No</SelectItem>
                          <SelectItem value="text">Short text</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove question ${i + 1}`}
                        onClick={() => removeQ(i)}
                        disabled={questions.length === 1}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`q-${i}-prompt`}>Prompt</Label>
                    <Input
                      id={`q-${i}-prompt`}
                      placeholder="What do you think about…"
                      value={q.prompt}
                      onChange={(e) => updateQ(i, { prompt: e.target.value })}
                      maxLength={280}
                    />
                  </div>
                  {q.type === "choice" && (
                    <div className="space-y-1.5">
                      <Label htmlFor={`q-${i}-options`}>Options (one per line)</Label>
                      <Textarea
                        id={`q-${i}-options`}
                        placeholder={"Option A\nOption B\nOption C"}
                        value={q.options}
                        onChange={(e) => updateQ(i, { options: e.target.value })}
                        rows={4}
                      />
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full"
            onClick={() => addQ()}
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add question
          </Button>
        </section>

        <section aria-labelledby="aff-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="aff-heading" className="text-lg font-semibold">
              Product links <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste product links (Amazon, Etsy, creator sites). They’ll appear on the results page
            with a clear affiliate disclosure and tracked clicks.
          </p>

          <ul className="space-y-3">
            {affiliates.map((a, i) => (
              <li key={i}>
                <Card className="space-y-2 p-3">
                  <div className="flex gap-2">
                    <Input
                      aria-label={`Product ${i + 1} label`}
                      placeholder="Label (e.g. Native Coconut & Vanilla)"
                      value={a.label}
                      onChange={(e) =>
                        setAffiliates((xs) =>
                          xs.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove product link ${i + 1}`}
                      onClick={() =>
                        setAffiliates((xs) => xs.filter((_, idx) => idx !== i))
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      aria-label={`Product ${i + 1} URL`}
                      placeholder="https://…"
                      value={a.url}
                      onChange={(e) =>
                        setAffiliates((xs) =>
                          xs.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)),
                        )
                      }
                    />
                    <Select
                      value={a.source}
                      onValueChange={(v) =>
                        setAffiliates((xs) =>
                          xs.map((x, idx) =>
                            idx === i ? { ...x, source: v as AffDraft["source"] } : x,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amazon">Amazon</SelectItem>
                        <SelectItem value="etsy">Etsy</SelectItem>
                        <SelectItem value="creator">Creator</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full"
            onClick={() =>
              setAffiliates((xs) => [...xs, { label: "", url: "", source: "other" }])
            }
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add product link
          </Button>
        </section>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={submitting}
            size="lg"
            className="rounded-full bg-gradient-brand text-white shadow-brand"
          >
            {submitting ? "Publishing…" : "Publish survey"}
          </Button>
        </div>
      </form>
    </div>
  );
}