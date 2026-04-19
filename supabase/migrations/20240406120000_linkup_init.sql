/**
 * LinkUp MVP — Postgres schema, enums, RLS, Realtime, triggers.
 * Apply with: supabase db push / SQL editor (order matters).
 */

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.account_status AS ENUM ('active', 'restricted', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_status AS ENUM (
    'draft', 'negotiating', 'agreed', 'active', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.offer_status AS ENUM (
    'pending', 'countered', 'accepted', 'declined', 'superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.escrow_status AS ENUM (
    'pending_funding', 'funded', 'released', 'disputed', 'refunded', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dispute_status AS ENUM ('open', 'under_review', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_request_status AS ENUM (
    'pending', 'ai_pass', 'ai_flag', 'admin_approved', 'admin_rejected', 'more_info'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.moderation_status AS ENUM ('pending', 'clean', 'flagged', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Core: users (1:1 with auth.users) + profiles
-- Passwords live in auth.users only — never duplicate secrets in public.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  account_status public.account_status NOT NULL DEFAULT 'active',
  verification_status public.user_verification_status NOT NULL DEFAULT 'unverified',
  premium_until TIMESTAMPTZ,
  boost_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  age_min INTEGER,
  age_max INTEGER,
  radius_km NUMERIC(10, 2),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_profile_public BOOLEAN NOT NULL DEFAULT true,
  ai_trust_score NUMERIC(5, 2),
  verified_badge BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_status public.user_verification_status NOT NULL DEFAULT 'unverified';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS boost_credits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_min INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age_max INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS radius_km NUMERIC(10, 2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_trust_score NUMERIC(5, 2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_badge BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'moderator' CHECK (role IN ('moderator', 'super_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'moderator';
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- Plans & InDrive-style negotiation (plan_offers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  starting_price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status public.plan_status NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'radius', 'friends')),
  boosted_until TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  location_label TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accepted_offer_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pre-existing `plans` (from a partial/old run): `CREATE TABLE IF NOT EXISTS` does not add new columns.
-- Add every column before indexes / FKs that reference them (e.g. idx_plans_geo needs latitude/longitude).
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS starting_price_cents INTEGER;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS status public.plan_status NOT NULL DEFAULT 'draft';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS location_label TEXT;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS accepted_offer_id UUID;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.plan_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  amount_cents INTEGER,
  message TEXT,
  status public.offer_status NOT NULL DEFAULT 'pending',
  round INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_offers ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE public.plan_offers ADD COLUMN IF NOT EXISTS bidder_id UUID;
ALTER TABLE public.plan_offers ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
ALTER TABLE public.plan_offers ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.plan_offers ADD COLUMN IF NOT EXISTS status public.offer_status NOT NULL DEFAULT 'pending';
ALTER TABLE public.plan_offers ADD COLUMN IF NOT EXISTS round INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.plan_offers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_accepted_offer_fk'
  ) THEN
    ALTER TABLE public.plans
      ADD CONSTRAINT plans_accepted_offer_fk
      FOREIGN KEY (accepted_offer_id) REFERENCES public.plan_offers (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plans_creator ON public.plans (creator_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON public.plans (status);
CREATE INDEX IF NOT EXISTS idx_plans_geo ON public.plans (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_plan_offers_plan ON public.plan_offers (plan_id);

-- ---------------------------------------------------------------------------
-- Messaging (direct conversations + messages)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_ordered CHECK (user_a::text < user_b::text),
  CONSTRAINT conversations_pair UNIQUE (user_a, user_b)
);

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user_a UUID;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user_b UUID;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  body TEXT,
  moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_id UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS moderation_status public.moderation_status NOT NULL DEFAULT 'pending';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages (conversation_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Media (polymorphic parent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_table TEXT NOT NULL,
  parent_id UUID NOT NULL,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.media ADD COLUMN IF NOT EXISTS parent_table TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS storage_bucket TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_media_parent ON public.media (parent_table, parent_id);

-- ---------------------------------------------------------------------------
-- Escrow & disputes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL UNIQUE REFERENCES public.plans (id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  payee_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  paystack_reference TEXT,
  status public.escrow_status NOT NULL DEFAULT 'pending_funding',
  metadata JSONB DEFAULT '{}'::jsonb,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS payer_id UUID;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS payee_id UUID;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN';
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS paystack_reference TEXT;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS status public.escrow_status NOT NULL DEFAULT 'pending_funding';
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.escrow_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES public.escrow_transactions (id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status public.dispute_status NOT NULL DEFAULT 'open',
  admin_resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.escrow_disputes ADD COLUMN IF NOT EXISTS escrow_id UUID;
ALTER TABLE public.escrow_disputes ADD COLUMN IF NOT EXISTS opened_by UUID;
ALTER TABLE public.escrow_disputes ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.escrow_disputes ADD COLUMN IF NOT EXISTS status public.dispute_status NOT NULL DEFAULT 'open';
ALTER TABLE public.escrow_disputes ADD COLUMN IF NOT EXISTS admin_resolution TEXT;
ALTER TABLE public.escrow_disputes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.escrow_disputes ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_escrow_disputes_escrow ON public.escrow_disputes (escrow_id);

-- ---------------------------------------------------------------------------
-- Support & verification
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS status public.ticket_status NOT NULL DEFAULT 'open';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status public.verification_request_status NOT NULL DEFAULT 'pending',
  id_document_path TEXT,
  selfie_video_path TEXT,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.admins (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS status public.verification_request_status NOT NULL DEFAULT 'pending';
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS id_document_path TEXT;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS selfie_video_path TEXT;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS ai_analysis JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_verification_user ON public.verification_requests (user_id);

-- ---------------------------------------------------------------------------
-- Notifications (in-app; push can use this table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_notifications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.app_notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.app_notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.app_notifications ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.app_notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.app_notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_app_notifications_user ON public.app_notifications (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at + auth.users sync + notify helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_users_updated ON public.users;
CREATE TRIGGER tr_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_profiles_updated ON public.profiles;
CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_plans_updated ON public.plans;
CREATE TRIGGER tr_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_escrow_updated ON public.escrow_transactions;
CREATE TRIGGER tr_escrow_updated BEFORE UPDATE ON public.escrow_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_tickets_updated ON public.support_tickets;
CREATE TRIGGER tr_tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_verification_updated ON public.verification_requests;
CREATE TRIGGER tr_verification_updated BEFORE UPDATE ON public.verification_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- New Supabase user → public.users + profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sync email on auth update
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_updated();

-- Insert notification when escrow status changes (client can subscribe to app_notifications)
CREATE OR REPLACE FUNCTION public.notify_escrow_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    uid := NEW.payer_id;
    INSERT INTO public.app_notifications (user_id, title, body, payload)
    VALUES (
      uid,
      'Escrow updated',
      'Your escrow is now: ' || NEW.status::text,
      jsonb_build_object('escrow_id', NEW.id, 'status', NEW.status)
    );
    uid := NEW.payee_id;
    INSERT INTO public.app_notifications (user_id, title, body, payload)
    VALUES (
      uid,
      'Escrow updated',
      'Your escrow is now: ' || NEW.status::text,
      jsonb_build_object('escrow_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_escrow_notify ON public.escrow_transactions;
CREATE TRIGGER tr_escrow_notify
  AFTER UPDATE ON public.escrow_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_escrow_change();

-- ---------------------------------------------------------------------------
-- Helper: is admin?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(check_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = check_uid);
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

-- users: self read/update; admins read all; admins update verification status
CREATE POLICY users_select_self ON public.users FOR SELECT USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY users_update_self ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY users_update_admin ON public.users FOR UPDATE USING (public.is_admin(auth.uid()));

-- profiles (public cards vs own profile vs admin)
CREATE POLICY profiles_select ON public.profiles FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_profile_public = true
    OR public.is_admin(auth.uid())
  );
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));

-- admins: read own row (for role check) or full list for admins
CREATE POLICY admins_select ON public.admins FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- plans: public visibility or owner or participant in offers
CREATE POLICY plans_select ON public.plans FOR SELECT
  USING (
    creator_id = auth.uid()
    OR visibility = 'public'
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.plan_offers o WHERE o.plan_id = plans.id AND o.bidder_id = auth.uid()
    )
  );
CREATE POLICY plans_insert ON public.plans FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY plans_update_creator ON public.plans FOR UPDATE USING (creator_id = auth.uid() OR public.is_admin(auth.uid()));

-- plan_offers
CREATE POLICY offers_select ON public.plan_offers FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_offers.plan_id AND (p.creator_id = auth.uid() OR public.is_admin(auth.uid())))
    OR bidder_id = auth.uid()
  );
CREATE POLICY offers_insert ON public.plan_offers FOR INSERT WITH CHECK (auth.uid() = bidder_id);
CREATE POLICY offers_update ON public.plan_offers FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.plans p WHERE p.id = plan_offers.plan_id AND p.creator_id = auth.uid())
    OR bidder_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- conversations
CREATE POLICY conv_select ON public.conversations FOR SELECT
  USING (user_a = auth.uid() OR user_b = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY conv_insert ON public.conversations FOR INSERT
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

-- messages
CREATE POLICY messages_select ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
    OR public.is_admin(auth.uid())
  );
CREATE POLICY messages_insert ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

-- media: owner or admin
CREATE POLICY media_select ON public.media FOR SELECT
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY media_insert ON public.media FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY media_delete ON public.media FOR DELETE USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- escrow
CREATE POLICY escrow_select ON public.escrow_transactions FOR SELECT
  USING (payer_id = auth.uid() OR payee_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY escrow_insert ON public.escrow_transactions FOR INSERT
  WITH CHECK (payer_id = auth.uid() OR payee_id = auth.uid());
CREATE POLICY escrow_update ON public.escrow_transactions FOR UPDATE
  USING (payer_id = auth.uid() OR payee_id = auth.uid() OR public.is_admin(auth.uid()));

-- disputes
CREATE POLICY disputes_select ON public.escrow_disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.escrow_transactions e
      WHERE e.id = escrow_disputes.escrow_id AND (e.payer_id = auth.uid() OR e.payee_id = auth.uid())
    )
    OR public.is_admin(auth.uid())
  );
CREATE POLICY disputes_insert ON public.escrow_disputes FOR INSERT WITH CHECK (opened_by = auth.uid());
CREATE POLICY disputes_update_admin ON public.escrow_disputes FOR UPDATE USING (public.is_admin(auth.uid()));

-- support
CREATE POLICY tickets_select ON public.support_tickets FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY tickets_insert ON public.support_tickets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY tickets_update ON public.support_tickets FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- verification
CREATE POLICY ver_select ON public.verification_requests FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY ver_insert ON public.verification_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY ver_update ON public.verification_requests FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- notifications
CREATE POLICY notif_select ON public.app_notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notif_update ON public.app_notifications FOR UPDATE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime: enable these tables in Dashboard → Database → Replication,
-- or run (ignore errors if already added):
--   alter publication supabase_realtime add table public.messages;
--   alter publication supabase_realtime add table public.plans;
--   alter publication supabase_realtime add table public.plan_offers;
--   alter publication supabase_realtime add table public.escrow_transactions;
--   alter publication supabase_realtime add table public.app_notifications;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Storage buckets (private verification + chat; public avatars optional)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('verification', 'verification', false),
  ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "Avatar read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Verification uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "Verification own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "Chat media upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "Chat media read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media');
