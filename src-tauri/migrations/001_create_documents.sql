-- Corngr Phase 5: Cloud Sync Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Documents table for Yjs state persistence
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster owner queries
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);

-- Row Level Security (RLS)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own documents
DROP POLICY IF EXISTS documents_select_policy ON documents;
CREATE POLICY documents_select_policy ON documents
    FOR SELECT
    USING (auth.uid()::text = owner_id);

-- Policy: Users can insert their own documents  
DROP POLICY IF EXISTS documents_insert_policy ON documents;
CREATE POLICY documents_insert_policy ON documents
    FOR INSERT
    WITH CHECK (auth.uid()::text = owner_id);

-- Policy: Users can update their own documents
DROP POLICY IF EXISTS documents_update_policy ON documents;
CREATE POLICY documents_update_policy ON documents
    FOR UPDATE
    USING (auth.uid()::text = owner_id);

-- Policy: Users can delete their own documents
DROP POLICY IF EXISTS documents_delete_policy ON documents;
CREATE POLICY documents_delete_policy ON documents
    FOR DELETE
    USING (auth.uid()::text = owner_id);
