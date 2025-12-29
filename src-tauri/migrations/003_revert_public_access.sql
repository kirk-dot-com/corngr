-- Phase 6: Strict Security Hardening
-- Reverts the public access hotfix and enforces strict RLS

-- 1. Drop permissive policies
DROP POLICY IF EXISTS documents_public_select ON documents;
DROP POLICY IF EXISTS documents_public_insert ON documents;
DROP POLICY IF EXISTS documents_public_update ON documents;
DROP POLICY IF EXISTS documents_public_delete ON documents;
DROP POLICY IF EXISTS documents_select_policy ON documents;
DROP POLICY IF EXISTS documents_insert_policy ON documents;
DROP POLICY IF EXISTS documents_update_policy ON documents;
DROP POLICY IF EXISTS documents_delete_policy ON documents;

-- 2. Re-enable Owner-Only Policies (Strict RLS)
-- SELECT: Users can only see documents they own
CREATE POLICY documents_select_policy ON documents
    FOR SELECT
    USING (auth.uid()::text = owner_id);

-- INSERT: Users can only insert documents where they are the owner
CREATE POLICY documents_insert_policy ON documents
    FOR INSERT
    WITH CHECK (auth.uid()::text = owner_id);

-- UPDATE: Users can only update their own documents
CREATE POLICY documents_update_policy ON documents
    FOR UPDATE
    USING (auth.uid()::text = owner_id);

-- DELETE: Users can only delete their own documents
CREATE POLICY documents_delete_policy ON documents
    FOR DELETE
    USING (auth.uid()::text = owner_id);
