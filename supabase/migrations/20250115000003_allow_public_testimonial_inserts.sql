-- Allow anonymous users to insert testimonials (for public form)
CREATE POLICY "Anyone can insert testimonials"
  ON testimonials
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

