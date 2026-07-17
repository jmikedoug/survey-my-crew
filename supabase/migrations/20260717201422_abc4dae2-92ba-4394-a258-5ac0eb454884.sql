-- Add owner SELECT policy for affiliate_clicks so survey owners can view analytics
CREATE POLICY "clicks owner read" ON public.affiliate_clicks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.affiliate_links l
    JOIN public.surveys s ON s.id = l.survey_id
    WHERE l.id = affiliate_clicks.affiliate_link_id
      AND s.user_id = auth.uid()
  ));
GRANT SELECT ON public.affiliate_clicks TO authenticated;