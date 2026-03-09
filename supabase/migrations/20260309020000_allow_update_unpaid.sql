-- Allow anon to update sales ONLY where payment_method is currently NULL
-- and ONLY to set it to a non-null value (prevents reverting paid → unpaid)
CREATE POLICY "anon can update unpaid sales" ON sales
  FOR UPDATE TO anon
  USING (payment_method IS NULL)
  WITH CHECK (payment_method IS NOT NULL);
