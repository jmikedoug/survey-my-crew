
-- Enums
CREATE TYPE public.question_type AS ENUM ('rating','choice','text','yes_no');
CREATE TYPE public.affiliate_source AS ENUM ('amazon','etsy','creator','other');

-- Surveys
CREATE TABLE public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  creator_token TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO anon, authenticated;
GRANT ALL ON public.surveys TO service_role;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "surveys public read" ON public.surveys FOR SELECT USING (true);
CREATE POLICY "surveys anon insert" ON public.surveys FOR INSERT WITH CHECK (creator_token IS NOT NULL AND length(creator_token) >= 8);
CREATE POLICY "surveys creator update" ON public.surveys FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "surveys creator delete" ON public.surveys FOR DELETE USING (true);

-- Questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  position INT NOT NULL,
  type public.question_type NOT NULL,
  prompt TEXT NOT NULL,
  options JSONB
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO anon, authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions public read" ON public.questions FOR SELECT USING (true);
CREATE POLICY "questions anon write" ON public.questions FOR INSERT WITH CHECK (true);
CREATE POLICY "questions anon update" ON public.questions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "questions anon delete" ON public.questions FOR DELETE USING (true);

-- Responses
CREATE TABLE public.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  respondent_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.responses TO anon, authenticated;
GRANT ALL ON public.responses TO service_role;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "responses anon insert" ON public.responses FOR INSERT WITH CHECK (true);
-- No public SELECT — read only through get_survey_results RPC.

-- Answers
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  value_number NUMERIC,
  value_text TEXT,
  value_choice TEXT
);
GRANT SELECT, INSERT ON public.answers TO anon, authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "answers anon insert" ON public.answers FOR INSERT WITH CHECK (true);

-- Affiliate links
CREATE TABLE public.affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  source public.affiliate_source NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_links TO anon, authenticated;
GRANT ALL ON public.affiliate_links TO service_role;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aff public read" ON public.affiliate_links FOR SELECT USING (true);
CREATE POLICY "aff anon write" ON public.affiliate_links FOR INSERT WITH CHECK (true);
CREATE POLICY "aff anon update" ON public.affiliate_links FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "aff anon delete" ON public.affiliate_links FOR DELETE USING (true);

-- Affiliate clicks
CREATE TABLE public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_link_id UUID NOT NULL REFERENCES public.affiliate_links(id) ON DELETE CASCADE,
  referrer TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.affiliate_clicks TO anon, authenticated;
GRANT ALL ON public.affiliate_clicks TO service_role;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clicks anon insert" ON public.affiliate_clicks FOR INSERT WITH CHECK (true);

-- Aggregated results RPC (security definer so raw responses stay private)
CREATE OR REPLACE FUNCTION public.get_survey_results(_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _survey public.surveys%ROWTYPE;
  _result JSONB;
BEGIN
  SELECT * INTO _survey FROM public.surveys WHERE slug = _slug;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'survey', jsonb_build_object(
      'id', _survey.id,
      'slug', _survey.slug,
      'title', _survey.title,
      'description', _survey.description,
      'category', _survey.category,
      'created_at', _survey.created_at
    ),
    'response_count', (SELECT count(*) FROM public.responses r WHERE r.survey_id = _survey.id),
    'questions', COALESCE((
      SELECT jsonb_agg(q_data ORDER BY position)
      FROM (
        SELECT
          q.position,
          jsonb_build_object(
            'id', q.id,
            'position', q.position,
            'type', q.type,
            'prompt', q.prompt,
            'options', q.options,
            'answer_count', (SELECT count(*) FROM public.answers a WHERE a.question_id = q.id),
            'avg_rating', CASE WHEN q.type = 'rating'
              THEN (SELECT avg(a.value_number) FROM public.answers a WHERE a.question_id = q.id)
              ELSE NULL END,
            'choice_counts', CASE WHEN q.type IN ('choice','yes_no')
              THEN (
                SELECT COALESCE(jsonb_object_agg(choice, cnt), '{}'::jsonb) FROM (
                  SELECT a.value_choice AS choice, count(*) AS cnt
                  FROM public.answers a
                  WHERE a.question_id = q.id AND a.value_choice IS NOT NULL
                  GROUP BY a.value_choice
                ) s
              )
              ELSE NULL END,
            'text_answers', CASE WHEN q.type = 'text'
              THEN (SELECT COALESCE(jsonb_agg(a.value_text), '[]'::jsonb) FROM public.answers a WHERE a.question_id = q.id AND a.value_text IS NOT NULL)
              ELSE NULL END
          ) AS q_data
        FROM public.questions q WHERE q.survey_id = _survey.id
      ) s
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_survey_results(TEXT) TO anon, authenticated;
