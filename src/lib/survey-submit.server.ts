import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SubmitAnswer = {
  question_id: string;
  value_number?: number | null;
  value_text?: string | null;
  value_choice?: string | null;
  suggested_url?: string | null;
};

type SubmitPayload = {
  slug: string;
  respondent_name?: string | null;
  respondent_token?: string | null;
  answers: SubmitAnswer[];
};

function serverSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function resolveAffiliateUrl(rawUrl: string, ownerId: string | null): Promise<string> {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    for (const p of ["tag", "ascsubtag", "linkCode", "linkId", "ref_", "aff", "affiliate_id"]) {
      u.searchParams.delete(p);
    }
    if (!ownerId) return u.toString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("amazon_tag, etsy_tag")
      .eq("id", ownerId)
      .maybeSingle();
    if (!profile) return u.toString();

    if (/(^|\.)amazon\.[a-z.]+$/.test(host) && profile.amazon_tag) {
      u.searchParams.set("tag", profile.amazon_tag);
    } else if (/(^|\.)etsy\.com$/.test(host) && profile.etsy_tag) {
      u.searchParams.set("utm_source", profile.etsy_tag);
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

export async function submitSurveyResponse(
  data: SubmitPayload,
  userId: string | null,
  client?: SupabaseClient,
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

  const { error: rErr } = await supabase.from("responses").insert({
    id: responseId,
    survey_id: survey.id,
    respondent_name: data.respondent_name || null,
    respondent_token: data.respondent_token || null,
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