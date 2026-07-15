
-- 1) Fix affiliate_links: forbid survey_id NULL on write; owner check remains.
DROP POLICY IF EXISTS "aff owner write" ON public.affiliate_links;
DROP POLICY IF EXISTS "aff owner update" ON public.affiliate_links;
DROP POLICY IF EXISTS "aff owner delete" ON public.affiliate_links;

CREATE POLICY "aff owner write" ON public.affiliate_links
  FOR INSERT TO authenticated
  WITH CHECK (
    survey_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid())
  );
CREATE POLICY "aff owner update" ON public.affiliate_links
  FOR UPDATE TO authenticated
  USING (
    survey_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    survey_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid())
  );
CREATE POLICY "aff owner delete" ON public.affiliate_links
  FOR DELETE TO authenticated
  USING (
    survey_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.user_id = auth.uid())
  );

-- Clean up any orphan rows that could be planted redirects.
DELETE FROM public.affiliate_links WHERE survey_id IS NULL;

-- 2) responses.respondent_token for anonymous submissions.
ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS respondent_token TEXT;
CREATE INDEX IF NOT EXISTS responses_respondent_token_idx
  ON public.responses (respondent_token)
  WHERE respondent_token IS NOT NULL;

-- 3) claim_responses(_token): link past anonymous responses to signed-in user.
CREATE OR REPLACE FUNCTION public.claim_responses(_token text)
RETURNS integer
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
  UPDATE public.responses
     SET user_id = _uid
   WHERE respondent_token = _token
     AND user_id IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_responses(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_responses(text) TO authenticated;

-- 4) discover_polls(_only_matching bool, _category text): browse or match.
CREATE OR REPLACE FUNCTION public.discover_polls(_only_matching boolean, _category text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _prof public.profiles%ROWTYPE;
  _rows jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _prof FROM public.profiles WHERE id = _uid;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (t->>'created_at') DESC), '[]'::jsonb)
    INTO _rows
  FROM (
    SELECT
      s.slug,
      s.title,
      s.category,
      s.description,
      s.created_at,
      (SELECT count(*) FROM public.responses r WHERE r.survey_id = s.id) AS response_count,
      -- match_reason: 'match' if any linked audience passes, 'browse' otherwise, null if no audience defined
      CASE WHEN NOT EXISTS (SELECT 1 FROM public.survey_audiences sa WHERE sa.survey_id = s.id) THEN NULL
           WHEN EXISTS (
             SELECT 1
             FROM public.survey_audiences sa
             JOIN public.audiences a ON a.id = sa.audience_id
             WHERE sa.survey_id = s.id
               AND (
                 (a.criteria->'age_ranges' IS NULL OR jsonb_array_length(a.criteria->'age_ranges') = 0
                    OR (_prof.age_range IS NOT NULL AND a.criteria->'age_ranges' ? _prof.age_range))
                 AND (a.criteria->>'gender' IS NULL OR a.criteria->>'gender' = 'any' OR a.criteria->>'gender' = ''
                    OR (_prof.gender IS NOT NULL AND lower(a.criteria->>'gender') = lower(_prof.gender)))
                 AND (a.criteria->>'location_contains' IS NULL OR a.criteria->>'location_contains' = ''
                    OR (_prof.location_region IS NOT NULL
                        AND position(lower(a.criteria->>'location_contains') IN lower(_prof.location_region)) > 0))
               )
           ) THEN 'match'
           ELSE 'browse'
      END AS match_reason
    FROM public.surveys s
    WHERE (_category IS NULL OR _category = '' OR s.category ILIKE _category)
    ORDER BY s.created_at DESC
    LIMIT 200
  ) t
  WHERE (
    NOT _only_matching
    OR (t.match_reason = 'match')
  );

  RETURN COALESCE(_rows, '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.discover_polls(boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.discover_polls(boolean, text) TO authenticated;
