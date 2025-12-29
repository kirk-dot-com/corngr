-- Phase 6.5: Document Naming
-- Add title column to documents table

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Untitled Document';
