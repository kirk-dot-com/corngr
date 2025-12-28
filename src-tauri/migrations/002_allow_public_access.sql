-- Phase 5 Hotfix: Allow Public Access for Cloud Sync Verification
-- Since we haven't implemented a Login UI yet, we need to allow
-- anonymous/public access to the documents table to verify sync works.

-- Drop existing strict policies
DROP POLICY IF EXISTS documents_select_policy ON documents;
DROP POLICY IF EXISTS documents_insert_policy ON documents;
DROP POLICY IF EXISTS documents_update_policy ON documents;
DROP POLICY IF EXISTS documents_delete_policy ON documents;

-- Create permissive policies (Public Read/Write)
CREATE POLICY documents_public_select ON documents FOR SELECT USING (true);
CREATE POLICY documents_public_insert ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY documents_public_update ON documents FOR UPDATE USING (true);
CREATE POLICY documents_public_delete ON documents FOR DELETE USING (true);

-- Note: In production (Phase 7), we will revert to strict RLS
-- once we have a proper Authentication system.
