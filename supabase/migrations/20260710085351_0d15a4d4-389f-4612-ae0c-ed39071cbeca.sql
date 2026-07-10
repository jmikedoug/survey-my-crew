
-- Profiles: replace public read with owner-only read
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
CREATE POLICY "profiles owner read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Affiliate clicks: replace WITH CHECK (true) with a real integrity check
DROP POLICY IF EXISTS "clicks anon insert" ON public.affiliate_clicks;
CREATE POLICY "clicks insert valid"
  ON public.affiliate_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.affiliate_links l WHERE l.id = affiliate_link_id)
  );

-- Fix mutable search_path on updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Lock down SECURITY DEFINER function execution
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_surveys(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.duplicate_survey(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_survey_results(text) FROM PUBLIC;

-- Grant only what the app needs
GRANT EXECUTE ON FUNCTION public.claim_surveys(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_survey(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_survey_results(text) TO anon, authenticated;
