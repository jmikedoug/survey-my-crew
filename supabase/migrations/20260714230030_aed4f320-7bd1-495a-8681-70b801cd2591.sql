DROP POLICY IF EXISTS "Anyone can submit response answers" ON public.answers;
CREATE POLICY "Anyone can submit response answers"
ON public.answers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  response_id IS NOT NULL
  AND question_id IS NOT NULL
);