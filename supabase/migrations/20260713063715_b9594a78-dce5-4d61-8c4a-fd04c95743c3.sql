
-- Ensure anon and authenticated roles can access tables needed for public poll response
GRANT SELECT ON public.surveys TO anon, authenticated;
GRANT SELECT ON public.questions TO anon, authenticated;
GRANT SELECT ON public.affiliate_links TO anon, authenticated;
GRANT INSERT ON public.responses TO anon, authenticated;
GRANT INSERT ON public.answers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_links TO authenticated;
GRANT SELECT, INSERT ON public.affiliate_clicks TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT ALL ON public.surveys, public.questions, public.affiliate_links, public.responses, public.answers, public.affiliate_clicks, public.profiles, public.audiences, public.survey_audiences TO service_role;
