
-- === Enum extension ===
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'product_suggestion';

-- === Profiles ===
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  amazon_tag TEXT,
  etsy_tag TEXT,
  age_range TEXT,
  gender TEXT,
  location_region TEXT,
  ethnicity TEXT[],
  hair_type TEXT,
  interests TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles owner insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles owner update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- === Column additions ===
ALTER TABLE public.responses ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX responses_user_id_idx ON public.responses(user_id);
CREATE INDEX responses_survey_id_idx ON public.responses(survey_id);

ALTER TABLE public.answers ADD COLUMN suggested_url TEXT;

CREATE INDEX surveys_user_id_idx ON public.surveys(user_id);
CREATE INDEX surveys_creator_token_idx ON public.surveys(creator_token);

-- === Tighten RLS on existing tables ===

-- Surveys: keep public read + anon insert; restrict update/delete to owner.
DROP POLICY IF EXISTS "surveys creator update" ON public.surveys;
DROP POLICY IF EXISTS "surveys creator delete" ON public.surveys;
CREATE POLICY "surveys owner update" ON public.surveys
  FOR UPDATE TO authenticated
  USING (user_id IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id);
CREATE POLICY "surveys owner delete" ON public.surveys
  FOR DELETE TO authenticated
  USING (user_id IS NOT NULL AND auth.uid() = user_id);

-- Questions: public read stays; write/update/delete only by survey owner (or during initial create via server fn).
DROP POLICY IF EXISTS "questions anon write" ON public.questions;
DROP POLICY IF EXISTS "questions anon update" ON public.questions;
DROP POLICY IF EXISTS "questions anon delete" ON public.questions;
CREATE POLICY "questions owner write" ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid()));
CREATE POLICY "questions owner update" ON public.questions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid()));
CREATE POLICY "questions owner delete" ON public.questions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid()));

-- Affiliate links: same pattern.
DROP POLICY IF EXISTS "aff anon write" ON public.affiliate_links;
DROP POLICY IF EXISTS "aff anon update" ON public.affiliate_links;
DROP POLICY IF EXISTS "aff anon delete" ON public.affiliate_links;
CREATE POLICY "aff owner write" ON public.affiliate_links
  FOR INSERT TO authenticated
  WITH CHECK (survey_id IS NULL OR EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid()));
CREATE POLICY "aff owner update" ON public.affiliate_links
  FOR UPDATE TO authenticated
  USING (survey_id IS NULL OR EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid()))
  WITH CHECK (survey_id IS NULL OR EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid()));
CREATE POLICY "aff owner delete" ON public.affiliate_links
  FOR DELETE TO authenticated
  USING (survey_id IS NULL OR EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid()));

-- Responses: survey owner can read their responses (for export/history); respondent can read their own.
CREATE POLICY "responses owner read" ON public.responses
  FOR SELECT TO authenticated
  USING (
    (user_id IS NOT NULL AND auth.uid() = user_id)
    OR EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid())
  );
GRANT SELECT ON public.responses TO authenticated;

-- Answers: same audience as responses.
CREATE POLICY "answers owner read" ON public.answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.responses r
      LEFT JOIN public.surveys s ON s.id = r.survey_id
      WHERE r.id = response_id
        AND (
          (r.user_id IS NOT NULL AND r.user_id = auth.uid())
          OR (s.user_id IS NOT NULL AND s.user_id = auth.uid())
        )
    )
  );
GRANT SELECT ON public.answers TO authenticated;

-- === Audiences (foundations for targeting) ===
CREATE TABLE public.audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audiences TO authenticated;
GRANT ALL ON public.audiences TO service_role;
ALTER TABLE public.audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audiences owner all" ON public.audiences
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER audiences_updated_at BEFORE UPDATE ON public.audiences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.survey_audiences (
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  audience_id UUID NOT NULL REFERENCES public.audiences(id) ON DELETE CASCADE,
  quota INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, audience_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_audiences TO authenticated;
GRANT ALL ON public.survey_audiences TO service_role;
ALTER TABLE public.survey_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "survey_audiences owner all" ON public.survey_audiences
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid()));

-- === RPC: claim anonymous surveys by local token ===
CREATE OR REPLACE FUNCTION public.claim_surveys(_token TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _n INT;
BEGIN
  IF _uid IS NULL OR _token IS NULL OR length(_token) < 8 THEN
    RETURN 0;
  END IF;
  UPDATE public.surveys
     SET user_id = _uid
   WHERE creator_token = _token
     AND user_id IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_surveys(TEXT) TO authenticated;

-- === RPC: duplicate a survey into caller's account ===
CREATE OR REPLACE FUNCTION public.duplicate_survey(_slug TEXT, _new_slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _src public.surveys%ROWTYPE;
  _new_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _src FROM public.surveys WHERE slug = _slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;

  INSERT INTO public.surveys (slug, title, description, category, creator_token, user_id)
  VALUES (_new_slug, _src.title || ' (copy)', _src.description, _src.category, encode(gen_random_bytes(16), 'hex'), _uid)
  RETURNING id INTO _new_id;

  INSERT INTO public.questions (survey_id, position, type, prompt, options)
  SELECT _new_id, position, type, prompt, options FROM public.questions WHERE survey_id = _src.id;

  INSERT INTO public.affiliate_links (survey_id, question_id, label, url, source)
  SELECT _new_id, NULL, label, url, source FROM public.affiliate_links WHERE survey_id = _src.id;

  RETURN _new_slug;
END;
$$;
GRANT EXECUTE ON FUNCTION public.duplicate_survey(TEXT, TEXT) TO authenticated;

-- === Updated results RPC to include product_suggestion aggregation ===
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
            'avg_rating', CASE WHEN q.type::text = 'rating'
              THEN (SELECT avg(a.value_number) FROM public.answers a WHERE a.question_id = q.id)
              ELSE NULL END,
            'choice_counts', CASE WHEN q.type::text IN ('choice','yes_no')
              THEN (
                SELECT COALESCE(jsonb_object_agg(choice, cnt), '{}'::jsonb) FROM (
                  SELECT a.value_choice AS choice, count(*) AS cnt
                  FROM public.answers a
                  WHERE a.question_id = q.id AND a.value_choice IS NOT NULL
                  GROUP BY a.value_choice
                ) s
              )
              ELSE NULL END,
            'text_answers', CASE WHEN q.type::text = 'text'
              THEN (SELECT COALESCE(jsonb_agg(a.value_text), '[]'::jsonb) FROM public.answers a WHERE a.question_id = q.id AND a.value_text IS NOT NULL)
              ELSE NULL END,
            'product_suggestions', CASE WHEN q.type::text = 'product_suggestion'
              THEN (
                SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
                  SELECT
                    coalesce(a.value_text, 'Unnamed') AS title,
                    (array_agg(a.suggested_url) FILTER (WHERE a.suggested_url IS NOT NULL))[1] AS url,
                    count(*) AS votes
                  FROM public.answers a
                  WHERE a.question_id = q.id
                  GROUP BY coalesce(a.value_text, 'Unnamed')
                  ORDER BY count(*) DESC
                  LIMIT 20
                ) t
              )
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
