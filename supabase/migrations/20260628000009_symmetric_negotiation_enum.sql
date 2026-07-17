-- Part 1/2: extend offer_status enum only.
-- PostgreSQL forbids using new enum labels in the same transaction as ADD VALUE.
-- Run this migration alone (or commit before any migration that references the new values).

ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'countered_by_host';
ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'countered_by_guest';
ALTER TYPE public.offer_status ADD VALUE IF NOT EXISTS 'withdrawn';
