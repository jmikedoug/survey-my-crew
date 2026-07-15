import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Profile ----------

const AGE_RANGES = ["under_18", "18_24", "25_34", "35_44", "45_54", "55_plus"] as const;

const profileSchema = z.object({
  display_name: z.string().trim().max(60).optional().nullable(),
  age_range: z.enum(AGE_RANGES).nullable().optional(),
  gender: z.string().trim().max(40).nullable().optional(),
  location_region: z.string().trim().max(80).nullable().optional(),
  amazon_tag: z.string().trim().max(60).nullable().optional(),
  etsy_tag: z.string().trim().max(60).nullable().optional(),
});

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, display_name, age_range, gender, location_region, amazon_tag, etsy_tag")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const patch: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(data)) {
      patch[k] = v === undefined ? null : (v as string | null);
    }
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Audience ----------

const audienceSchema = z.object({
  survey_slug: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  age_ranges: z.array(z.enum(AGE_RANGES)).max(6).optional(),
  gender: z.string().trim().max(40).optional(),
  location_contains: z.string().trim().max(80).optional(),
});

export const setSurveyAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => audienceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: survey, error: sErr } = await context.supabase
      .from("surveys").select("id, user_id, title").eq("slug", data.survey_slug).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!survey) throw new Error("Survey not found");
    if (survey.user_id !== context.userId) throw new Error("Not the owner of this survey");

    const criteria: Record<string, unknown> = {};
    if (data.age_ranges?.length) criteria.age_ranges = data.age_ranges;
    if (data.gender && data.gender !== "any") criteria.gender = data.gender;
    if (data.location_contains) criteria.location_contains = data.location_contains;

    // Delete previous audience link(s) for this survey; keep it simple (one audience per survey for now).
    const { data: prev } = await context.supabase
      .from("survey_audiences").select("audience_id").eq("survey_id", survey.id);
    if (prev?.length) {
      const ids = prev.map((r) => r.audience_id as string);
      await context.supabase.from("survey_audiences").delete().eq("survey_id", survey.id);
      await context.supabase.from("audiences").delete().in("id", ids).eq("owner_id", context.userId);
    }

    if (Object.keys(criteria).length === 0) return { ok: true };

    const { data: aud, error: aErr } = await context.supabase
      .from("audiences")
      .insert({ owner_id: context.userId, name: data.name ?? survey.title, criteria })
      .select("id").single();
    if (aErr || !aud) throw new Error(aErr?.message ?? "Failed to save audience");
    const { error: linkErr } = await context.supabase
      .from("survey_audiences").insert({ survey_id: survey.id, audience_id: aud.id });
    if (linkErr) throw new Error(linkErr.message);
    return { ok: true };
  });

export const getSurveyAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ survey_slug: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: survey } = await context.supabase
      .from("surveys").select("id, user_id").eq("slug", data.survey_slug).maybeSingle();
    if (!survey || survey.user_id !== context.userId) return null;
    const { data } = await context.supabase
      .from("survey_audiences")
      .select("audience_id, audiences!inner(id, name, criteria)")
      .eq("survey_id", survey.id)
      .maybeSingle();
    return (data?.audiences as unknown) as { id: string; name: string; criteria: Record<string, unknown> } | null;
  });

// ---------- Discover ----------

export const discoverPolls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      only_matching: z.boolean().default(false),
      category: z.string().trim().max(60).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("discover_polls", {
      _only_matching: data.only_matching,
      _category: data.category ?? "",
    });
    if (error) throw new Error(error.message);
    return (rows as Array<{
      slug: string; title: string; category: string | null; description: string | null;
      created_at: string; response_count: number; match_reason: string | null;
    }>) ?? [];
  });

// ---------- Claim anonymous responses ----------

export const claimAnonResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: count, error } = await context.supabase.rpc("claim_responses", { _token: data.token });
    if (error) throw new Error(error.message);
    return { claimed: (count ?? 0) as number };
  });

export const getMySurveys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("surveys")
      .select("id, slug, title, description, category, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // Response counts
    const ids = (data ?? []).map((s) => s.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: rc } = await context.supabase
        .from("responses")
        .select("survey_id")
        .in("survey_id", ids);
      counts = (rc ?? []).reduce<Record<string, number>>((m, r) => {
        m[r.survey_id as string] = (m[r.survey_id as string] ?? 0) + 1;
        return m;
      }, {});
    }
    return (data ?? []).map((s) => ({ ...s, response_count: counts[s.id] ?? 0 }));
  });

export const getMyResponseHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("responses")
      .select("id, created_at, surveys!inner(slug, title, category)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      created_at: r.created_at as string,
      survey: r.surveys as unknown as { slug: string; title: string; category: string | null },
    }));
  });

export const claimAnonSurveys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: count, error } = await context.supabase.rpc("claim_surveys", { _token: data.token });
    if (error) throw new Error(error.message);
    return { claimed: (count ?? 0) as number };
  });

function randSlug(title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "survey";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

export const duplicateSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    // Look up title for a nicer slug
    const { data: src } = await context.supabase
      .from("surveys").select("title").eq("slug", data.slug).maybeSingle();
    const newSlug = randSlug((src?.title ?? "survey") + " copy");
    const { data: out, error } = await context.supabase.rpc("duplicate_survey", {
      _slug: data.slug, _new_slug: newSlug,
    });
    if (error) throw new Error(error.message);
    return { slug: (out as string) ?? newSlug };
  });

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const exportSurveyCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    // Owner check via RLS: we only get rows if we own the survey.
    const { data: survey, error: sErr } = await context.supabase
      .from("surveys").select("id, title, user_id").eq("slug", data.slug).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!survey) throw new Error("Survey not found");
    if (survey.user_id !== context.userId) throw new Error("Not the owner of this survey");

    const [{ data: questions }, { data: responses }] = await Promise.all([
      context.supabase.from("questions").select("id, position, prompt, type").eq("survey_id", survey.id).order("position"),
      context.supabase.from("responses").select("id, respondent_name, created_at, user_id").eq("survey_id", survey.id).order("created_at"),
    ]);
    const qs = questions ?? [];
    const rs = responses ?? [];

    const respIds = rs.map((r) => r.id as string);
    let answers: Array<{ response_id: string; question_id: string; value_number: number | null; value_text: string | null; value_choice: string | null; suggested_url: string | null }> = [];
    if (respIds.length) {
      const { data: ans, error: aErr } = await context.supabase
        .from("answers")
        .select("response_id, question_id, value_number, value_text, value_choice, suggested_url")
        .in("response_id", respIds);
      if (aErr) throw new Error(aErr.message);
      answers = (ans ?? []) as typeof answers;
    }

    const answerMap = new Map<string, Map<string, string>>();
    for (const a of answers) {
      const key = a.response_id;
      if (!answerMap.has(key)) answerMap.set(key, new Map());
      const parts: string[] = [];
      if (a.value_number != null) parts.push(String(a.value_number));
      if (a.value_choice != null) parts.push(a.value_choice);
      if (a.value_text != null) parts.push(a.value_text);
      if (a.suggested_url != null) parts.push(a.suggested_url);
      answerMap.get(key)!.set(a.question_id as string, parts.join(" | "));
    }

    const header = ["response_id", "respondent_name", "submitted_at", ...qs.map((q) => q.prompt as string)];
    const lines = [header.map(csvEscape).join(",")];
    for (const r of rs) {
      const row = [
        r.id, r.respondent_name ?? "", r.created_at,
        ...qs.map((q) => answerMap.get(r.id as string)?.get(q.id as string) ?? ""),
      ];
      lines.push(row.map(csvEscape).join(","));
    }
    return { csv: lines.join("\n"), filename: `${data.slug}.csv` };
  });