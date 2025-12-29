-- Phase 6.5: Enable Realtime for Documents
-- This ensures that the 'postgres_changes' listener in TauriSecureNetwork.ts works.

ALTER PUBLICATION supabase_realtime ADD TABLE documents;
