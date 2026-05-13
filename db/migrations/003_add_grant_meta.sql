-- Migration 003: add how_to_apply + repayability_type to grantmakers
ALTER TABLE grantmakers
  ADD COLUMN IF NOT EXISTS how_to_apply TEXT,
  ADD COLUMN IF NOT EXISTS repayability_type TEXT,
  ADD COLUMN IF NOT EXISTS typical_amount TEXT;
