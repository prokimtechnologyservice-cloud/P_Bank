/*
# Add identity verification: national ID + selfie

This migration:
1. Adds national_id, selfie_url, verification_status columns to profiles
2. Adds a UNIQUE constraint on national_id to prevent duplicate accounts
3. Creates check_national_id_available() function
4. Updates handle_new_user() to store national_id from signup metadata
5. Creates a private storage bucket for selfie photos
6. Adds storage policies so users can upload/read only their own selfie
*/

-- ========== Add columns to profiles ==========
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS national_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selfie_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';

-- Unique constraint on national_id (partial index, only where not null)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_national_id_key
  ON profiles (national_id) WHERE national_id IS NOT NULL;

-- ========== check_national_id_available function ==========
CREATE OR REPLACE FUNCTION public.check_national_id_available(p_national_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM profiles WHERE national_id = p_national_id);
$$;

REVOKE EXECUTE ON FUNCTION public.check_national_id_available(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_national_id_available(text) TO anon, authenticated;

-- ========== Update handle_new_user trigger ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_account_number text;
BEGIN
  LOOP
    new_account_number := lpad(floor(random() * 10000000000)::text, 10, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = new_account_number);
  END LOOP;

  INSERT INTO profiles (id, full_name, national_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'national_id'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    national_id = COALESCE(EXCLUDED.national_id, profiles.national_id);

  INSERT INTO accounts (user_id, account_number, account_name, balance)
  VALUES (
    NEW.id,
    new_account_number,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ========== Create storage bucket for selfies ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('selfies', 'selfies', false)
ON CONFLICT (id) DO NOTHING;

-- ========== Storage policies ==========
CREATE POLICY "users_upload_own_selfie"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'selfies' AND name LIKE auth.uid()::text || '/%');

CREATE POLICY "users_read_own_selfie"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'selfies' AND name LIKE auth.uid()::text || '/%');

CREATE POLICY "users_update_own_selfie"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'selfies' AND name LIKE auth.uid()::text || '/%')
  WITH CHECK (bucket_id = 'selfies' AND name LIKE auth.uid()::text || '/%');

CREATE POLICY "users_delete_own_selfie"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'selfies' AND name LIKE auth.uid()::text || '/%');
