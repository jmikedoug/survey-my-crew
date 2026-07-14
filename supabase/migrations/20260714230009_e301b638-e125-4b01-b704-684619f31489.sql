DROP POLICY IF EXISTS "responses insert valid" ON public.responses;
CREATE POLICY "Anyone can submit survey responses"
ON public.responses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "answers insert valid" ON public.answers;
CREATE POLICY "Anyone can submit response answers"
ON public.answers
FOR INSERT
TO anon, authenticated
WITH CHECK (true);