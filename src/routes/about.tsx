import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About · Poll Your People" },
      {
        name: "description",
        content:
          "Poll Your People is a tiny survey tool for the small, everyday decisions you never quite make.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <div className="prose prose-sm mt-6 max-w-none space-y-4 text-foreground/90">
        <p>
          Some decisions are too small to research and too personal to guess. Which deodorant
          works for you as the seasons change. Which novel to pick up next. Which taco place
          your friends actually love.
        </p>
        <p>
          Poll Your People lets you spin up a two-minute survey, share the link, and get a
          clean report back — averages, tallies, and quotes. No accounts needed for the friends
          who answer.
        </p>
        <h2 className="mt-8 text-xl font-semibold">Affiliate disclosure</h2>
        <p>
          When a survey creator attaches a product link, it may be an affiliate link (Amazon,
          Etsy, or a creator’s own site). If you click through and buy, we may earn a small
          commission — it doesn’t cost you anything extra, and it helps keep this app free.
        </p>
        <h2 className="mt-8 text-xl font-semibold">Coming later</h2>
        <ul className="list-disc pl-5">
          <li>Optional accounts so your surveys follow you across devices</li>
          <li>AI-summarized reports of the free-text answers</li>
          <li>Native iOS + Android apps</li>
        </ul>
      </div>
      <div className="mt-8">
        <Button asChild className="rounded-full bg-gradient-brand text-white shadow-brand">
          <Link to="/new">Create a survey</Link>
        </Button>
      </div>
    </div>
  );
}