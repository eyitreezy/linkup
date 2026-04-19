-- Escrow disputes ↔ support tickets; optional free-text detail for dispute form.

ALTER TABLE public.escrow_disputes
  ADD COLUMN IF NOT EXISTS support_ticket_id UUID REFERENCES public.support_tickets (id) ON DELETE SET NULL;

ALTER TABLE public.escrow_disputes
  ADD COLUMN IF NOT EXISTS detail TEXT;

CREATE INDEX IF NOT EXISTS idx_escrow_disputes_support_ticket ON public.escrow_disputes (support_ticket_id);
