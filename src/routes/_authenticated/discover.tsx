import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [
      { title: "Discover polls · Poll Your People" },
      { name: "description", content: "Answer polls matched to who you are." },
    ],
  }),
  component: Discover,
});

function Discover() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Discover polls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Soon: answer polls from creators looking for people like you — by age, location, hair type, and more.
        </p>
      </header>
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Coming soon. In the meantime, share your own polls with your friends.
        <div className="mt-4">
          <Button asChild size="sm" className="rounded-full bg-gradient-brand text-white shadow-brand">
            <Link to="/new">Create a poll</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}