-- Sprint 10 Migration: Add 'acontecendo' value to event_type_enum
-- Applied to remote database: 2026-06-23

-- 1. Add value to the event_type_enum enum
ALTER TYPE public.event_type_enum ADD VALUE 'acontecendo';
