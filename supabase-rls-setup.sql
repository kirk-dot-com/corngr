-- ========================================
-- Supabase RLS Setup for Corngr Collaboration
-- ========================================
-- This script configures Row Level Security policies to enable
-- Supabase Realtime for multi-user collaboration.
--
-- IMPORTANT: Run this in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query)
-- ========================================

-- Step 1: Enable Realtime replication on the documents table
-- (Skip if already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE documents;
  END IF;
END $$;

-- Step 2: Enable RLS on documents table (if not already enabled)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Step 3: Policy - Allow authenticated users to read all documents
-- (Required for Realtime subscriptions)
DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON documents;
CREATE POLICY "Allow authenticated users to read documents"
ON documents FOR SELECT
TO authenticated
USING (true);

-- Step 4: Policy - Allow authenticated users to insert their own documents
DROP POLICY IF EXISTS "Allow authenticated users to insert documents" ON documents;
CREATE POLICY "Allow authenticated users to insert documents"
ON documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = owner_id::text);

-- Step 5: Policy - Allow authenticated users to update their own documents
DROP POLICY IF EXISTS "Allow authenticated users to update own documents" ON documents;
CREATE POLICY "Allow authenticated users to update own documents"
ON documents FOR UPDATE
TO authenticated
USING (auth.uid()::text = owner_id::text)
WITH CHECK (auth.uid()::text = owner_id::text);

-- Step 6: Policy - Allow authenticated users to delete their own documents
DROP POLICY IF EXISTS "Allow authenticated users to delete own documents" ON documents;
CREATE POLICY "Allow authenticated users to delete own documents"
ON documents FOR DELETE
TO authenticated
USING (auth.uid()::text = owner_id::text);

-- ========================================
-- Verification Queries
-- ========================================

-- Verify Realtime is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'documents';

-- List all policies on documents table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'documents';

-- Check Realtime publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
