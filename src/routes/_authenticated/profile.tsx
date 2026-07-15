import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getMyProfile, updateMyProfile } from "@/lib/user.functions";

const AGE_OPTIONS = [
  { v: "", label: "Prefer not to say" },
  { v: "under_18", label: "Under 18" },
  { v: "18_24", label: "18–24" },
  { v: "25_34", label: "25–34" },
  { v: "35_44", label: "35–44" },
  { v: "45_54", label: "45–54" },
  { v: "55_plus", label: "55+" },
];

function profileQueryOptions() {
  return queryOptions({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
  });
}

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile · Poll Your People" },
      { name: "description", content: "Optional details that help match you to polls looking for people like you." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQueryOptions()),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile } = useSuspenseQuery(profileQueryOptions());
  const update = useServerFn(updateMyProfile);
  const qc = useQueryClient();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [ageRange, setAgeRange] = useState(profile?.age_range ?? "");
  const [gender, setGender] = useState(profile?.gender ?? "");
  const [location, setLocation] = useState(profile?.location_region ?? "");
  const [amazonTag, setAmazonTag] = useState(profile?.amazon_tag ?? "");
  const [etsyTag, setEtsyTag] = useState(profile?.etsy_tag ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setAgeRange(profile?.age_range ?? "");
    setGender(profile?.gender ?? "");
    setLocation(profile?.location_region ?? "");
    setAmazonTag(profile?.amazon_tag ?? "");
    setEtsyTag(profile?.etsy_tag ?? "");
  }, [profile]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await update({
        data: {
          display_name: displayName.trim() || null,
          age_range: (ageRange || null) as
            | "under_18" | "18_24" | "25_34" | "35_44" | "45_54" | "55_plus" | null,
          gender: gender.trim() || null,
          location_region: location.trim() || null,
          amazon_tag: amazonTag.trim() || null,
          etsy_tag: etsyTag.trim() || null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All fields optional. What you share here powers Discover — polls will find <em>you</em> based on what matches.
        </p>
      </header>

      <form onSubmit={onSave} className="space-y-6">
        <Card className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" maxLength={60}
              value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age_range">Age range</Label>
            <Select value={ageRange || "__none__"} onValueChange={(v) => setAgeRange(v === "__none__" ? "" : v)}>
              <SelectTrigger id="age_range"><SelectValue placeholder="Prefer not to say" /></SelectTrigger>
              <SelectContent>
                {AGE_OPTIONS.map((o) => (
                  <SelectItem key={o.v || "__none__"} value={o.v || "__none__"}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender</Label>
            <Input id="gender" placeholder="e.g. woman, man, non-binary — free text"
              maxLength={40} value={gender} onChange={(e) => setGender(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" placeholder="e.g. US-CA, London, Berlin — free text"
              maxLength={80} value={location} onChange={(e) => setLocation(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Creators use a simple substring match (e.g. audience "US" matches "US-CA").
            </p>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">Affiliate tags (creators only)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              When a respondent suggests an Amazon or Etsy product on one of your polls, we'll rewrite the link to use your tag.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="amz">Amazon tag</Label>
              <Input id="amz" placeholder="yourtag-20" maxLength={60}
                value={amazonTag} onChange={(e) => setAmazonTag(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etsy">Etsy source</Label>
              <Input id="etsy" placeholder="e.g. pollyourpeople" maxLength={60}
                value={etsyTag} onChange={(e) => setEtsyTag(e.target.value)} />
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} size="lg"
            className="rounded-full bg-gradient-brand text-white shadow-brand">
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}