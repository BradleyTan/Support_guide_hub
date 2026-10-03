-- Versions & releases was removed from the app (3 Oct 2026, at the user's request); its tables go too.
-- The 3 rows were the sample notes from "Load sample data". The purge-bin function no longer uses these tables.
drop table public.release_note_guides;
drop table public.release_notes;
