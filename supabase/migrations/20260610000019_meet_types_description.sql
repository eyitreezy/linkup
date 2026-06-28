/**
 * Meet types: optional description + Storage-backed cover URL for new catalog rows.
 * Upload placeholder once before/after applying:
 *   supabase storage cp ./supabase/seed/meet-type-images/placeholder-meet-type.png supabase://meet-type-images/placeholder-meet-type.png
 */

ALTER TABLE public.meet_types ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.meet_types ADD COLUMN IF NOT EXISTS meet_type_images TEXT;

COMMENT ON COLUMN public.meet_types.description IS 'Short picker subtitle; NULL for legacy catalog rows.';
COMMENT ON COLUMN public.meet_types.meet_type_images IS 'Public Storage URL for catalog tile cover; legacy rows use slug → bundled assets.';

-- ---------------------------------------------------------------------------
-- Storage: shared placeholder for new catalog meet types
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('meet-type-images', 'meet-type-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS public_read_meet_type_images ON storage.objects;
CREATE POLICY public_read_meet_type_images
  ON storage.objects FOR SELECT
  USING (bucket_id = 'meet-type-images');

DROP POLICY IF EXISTS service_role_writes_meet_type_images ON storage.objects;
CREATE POLICY service_role_writes_meet_type_images
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'meet-type-images' AND auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Seed 16 new catalog meet types (flat list; ON CONFLICT skips duplicates)
-- ---------------------------------------------------------------------------
DO $seed$
DECLARE
  placeholder_url text;
BEGIN
  placeholder_url := coalesce(
    nullif(trim(current_setting('app.settings.supabase_url', true)), ''),
    'https://othikifibhjpfgyxpzcu.supabase.co'
  ) || '/storage/v1/object/public/meet-type-images/placeholder-meet-type.png';

  INSERT INTO public.meet_types (
    name,
    slug,
    description,
    meet_type_images,
    default_duration_minutes,
    allows_escrow,
    allowed_patterns,
    default_pattern,
    is_restricted,
    supports_mood,
    icon,
    sort_order,
    is_active
  )
  VALUES
    (
      'Brunch Meet',
      'brunch-meet',
      'Daytime, lower-commitment alternative to dinner; good for first meetups',
      placeholder_url,
      90,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'sunny-outline',
      60,
      true
    ),
    (
      'Street Food',
      'street-food',
      'Casual, local, budget-tier culinary experience; strong Nigerian cultural anchor',
      placeholder_url,
      90,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'fast-food-outline',
      70,
      true
    ),
    (
      'Cook-Together Experience',
      'cook-together-experience',
      'Shared cooking session at home or a culinary studio',
      placeholder_url,
      120,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'restaurant-outline',
      80,
      true
    ),
    (
      'Lounge & Drinks',
      'lounge-drinks',
      'Quieter, conversation-first alternative to clubbing',
      placeholder_url,
      120,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'wine-outline',
      90,
      true
    ),
    (
      'Live Event / Concert Companion',
      'live-event-concert-companion',
      'Attending a concert, show, or festival together; shared-energy, higher-excitement format',
      placeholder_url,
      180,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'musical-notes-outline',
      100,
      true
    ),
    (
      'Game Night',
      'game-night',
      'Board games, video games, or card games; low-pressure social format',
      placeholder_url,
      120,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'game-controller-outline',
      110,
      true
    ),
    (
      'Run Club / Outdoor Fitness',
      'run-club-outdoor-fitness',
      'Jogging, cycling, hiking partnerships',
      placeholder_url,
      60,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'B',
      false,
      false,
      'fitness-outline',
      120,
      true
    ),
    (
      'Spa & Wellness Day',
      'spa-wellness-day',
      'Shared spa, massage, or wellness retreat experience',
      placeholder_url,
      180,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'leaf-outline',
      130,
      true
    ),
    (
      'Sports Companion',
      'sports-companion',
      'Playing or watching sports together — football, tennis, padel',
      placeholder_url,
      120,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'football-outline',
      140,
      true
    ),
    (
      'Travel Companion',
      'travel-companion',
      'Someone to share a trip with, locally or further afield; covers day trips up to longer journeys',
      placeholder_url,
      480,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'airplane-outline',
      150,
      true
    ),
    (
      'Weekend Getaway',
      'weekend-getaway',
      'A short overnight trip together, usually one to two nights; higher commitment than a single-day outing',
      placeholder_url,
      2880,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'bed-outline',
      160,
      true
    ),
    (
      'City Tour / Staycation',
      'city-tour-staycation',
      'Exploring a new city or local hidden gems together',
      placeholder_url,
      240,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'map-outline',
      170,
      true
    ),
    (
      'Road Trip Companion',
      'road-trip-companion',
      'Multi-city or intercity travel by road',
      placeholder_url,
      480,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'car-outline',
      180,
      true
    ),
    (
      'Companionship Arrangement',
      'companionship-arrangement',
      'An ongoing, mutually understood arrangement for ongoing company rather than a single outing',
      placeholder_url,
      120,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'heart-outline',
      190,
      true
    ),
    (
      'Plus-One / Event Date',
      'plus-one-event-date',
      'Accompanying someone to a wedding, owambe, corporate event, or family function',
      placeholder_url,
      180,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'people-outline',
      200,
      true
    ),
    (
      'Virtual Companion',
      'virtual-companion',
      'Video call or online hangout',
      placeholder_url,
      60,
      true,
      ARRAY['A', 'B', 'C']::TEXT[],
      'A',
      false,
      false,
      'videocam-outline',
      210,
      true
    )
  ON CONFLICT (slug) DO NOTHING;
END;
$seed$;

NOTIFY pgrst, 'reload schema';
