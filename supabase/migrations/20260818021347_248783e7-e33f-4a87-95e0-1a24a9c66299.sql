REVOKE SELECT ON public.surveys FROM anon;
REVOKE SELECT ON public.surveys FROM authenticated;
GRANT SELECT (id, slug, title, description, category, user_id, created_at) ON public.surveys TO anon;
GRANT SELECT (id, slug, title, description, category, user_id, created_at) ON public.surveys TO authenticated;
GRANT ALL ON public.surveys TO service_role;