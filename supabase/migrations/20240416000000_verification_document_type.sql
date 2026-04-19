/** KYC — document type selected before ID capture (optional metadata for review). */
ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS document_type TEXT;
