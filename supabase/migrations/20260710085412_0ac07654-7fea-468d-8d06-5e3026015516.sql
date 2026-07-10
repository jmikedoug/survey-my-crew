
DROP POLICY IF EXISTS "responses anon insert" ON public.responses;
CREATE POLICY "responses insert valid"
  ON public.responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id)
    AND (user_id IS NULL OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "answers anon insert" ON public.answers;
CREATE POLICY "answers insert valid"
  ON public.answers FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.responses r
      JOIN public.questions q ON q.survey_id = r.survey_id
      WHERE r.id = response_id AND q.id = question_id
    )
  );
