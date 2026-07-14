import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveAffiliateUrl } from "@/lib/product-matching.functions";

function serverSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "survey";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

const questionSchema = z.object({
  type: z.enum(["rating", "choice", "text", "yes_no", "product_suggestion"]),
  prompt: z.string().trim().min(1).max(280),
  options: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600).optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
  creator_token: z.string().min(8).max(128),
  questions: z.array(questionSchema).min(1).max(30),
  affiliate_links: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        url: z.string().trim().url().max(600),
        source: z.enum(["amazon", "etsy", "creator", "other"]).default("other"),
      }),
    )
    .max(20)
    .optional(),
});

export const createSurveyAsUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const slug = slugify(data.title);

    const { data: survey, error: sErr } = await supabase
      .from("surveys")
      .insert({
        slug,
        title: data.title,
        description: data.description ?? null,
        category: data.category ?? null,
        creator_token: data.creator_token,
        user_id: context.userId,
      })
      .select("id, slug, title, created_at")
      .single();
    if (sErr || !survey) throw new Error(sErr?.message ?? "Failed to create survey");

    const qRows = data.questions.map((q, i) => ({
      survey_id: survey.id,
      position: i,
      type: q.type,
      prompt: q.prompt,
      options: q.options && q.options.length ? q.options : null,
    }));
    const { error: qErr } = await supabase.from("questions").insert(qRows);
    if (qErr) throw new Error(qErr.message);

    if (data.affiliate_links?.length) {
      const { error: aErr } = await supabase.from("affiliate_links").insert(
        data.affiliate_links.map((a) => ({
          survey_id: survey.id,
          label: a.label,
          url: a.url,
          source: a.source,
        })),
      );
      if (aErr) throw new Error(aErr.message);
    }

    return survey;
  });

export const getSurvey = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = serverSupabase();
    const { data: survey, error } = await supabase
      .from("surveys")
      .select("id, slug, title, description, category, created_at")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!survey) return null;

    const [{ data: questions }, { data: aff }] = await Promise.all([
      supabase
        .from("questions")
        .select("id, position, type, prompt, options")
        .eq("survey_id", survey.id)
        .order("position"),
      supabase
        .from("affiliate_links")
        .select("id, label, url, source")
        .eq("survey_id", survey.id),
    ]);

    return { survey, questions: questions ?? [], affiliate_links: aff ?? [] };
  });

const answerSchema = z.object({
  question_id: z.string().uuid(),
  value_number: z.number().nullable().optional(),
  value_text: z.string().max(2000).nullable().optional(),
  value_choice: z.string().max(120).nullable().optional(),
  suggested_url: z.string().trim().url().max(600).nullable().optional(),
});

const submitSchema = z.object({
  slug: z.string().min(1),
  respondent_name: z.string().trim().max(60).optional().nullable(),
  answers: z.array(answerSchema).min(1).max(60),
});

export const submitResponse = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    return doSubmit(data, null);
  });

export const submitResponseAsUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data, context }) => {
    return doSubmit(data, context.userId, context.supabase);
  });

async function doSubmit(
  data: z.infer<typeof submitSchema>,
  userId: string | null,
  client?: ReturnType<typeof serverSupabase>,
) {
    const supabase = client ?? serverSupabase();
    const responseId = crypto.randomUUID();
    const { data: survey, error: sErr } = await supabase
      .from("surveys")
      .select("id, user_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!survey) throw new Error("Survey not found");

    const { error: rErr } = await supabase
      .from("responses")
      .insert({
        id: responseId,
        survey_id: survey.id,
        respondent_name: data.respondent_name || null,
        user_id: userId,
      });
    if (rErr) throw new Error(rErr.message);

    const rows = await Promise.all(
      data.answers.map(async (a) => {
        let url = a.suggested_url ?? null;
        if (url) url = await resolveAffiliateUrl(url, survey.user_id ?? null);
        return {
          response_id: responseId,
          question_id: a.question_id,
          value_number: a.value_number ?? null,
          value_text: a.value_text ?? null,
          value_choice: a.value_choice ?? null,
          suggested_url: url,
        };
      }),
    );
    const { error: aErr } = await supabase.from("answers").insert(rows);
    if (aErr) throw new Error(aErr.message);
    return { ok: true };
}

export const getResults = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = serverSupabase();
    const { data: result, error } = await supabase.rpc("get_survey_results", {
      _slug: data.slug,
    });
    if (error) throw new Error(error.message);
    return result as null | {
      survey: {
        id: string;
        slug: string;
        title: string;
        description: string | null;
        category: string | null;
        created_at: string;
      };
      response_count: number;
      questions: Array<{
        id: string;
        position: number;
        type: "rating" | "choice" | "text" | "yes_no" | "product_suggestion";
        prompt: string;
        options: string[] | null;
        answer_count: number;
        avg_rating: number | null;
        choice_counts: Record<string, number> | null;
        text_answers: string[] | null;
        product_suggestions: Array<{ title: string; url: string | null; votes: number }> | null;
      }>;
    };
  });