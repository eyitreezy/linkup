/**
 * Multipart: video (file), plan_id, reported_user_id, gps_lat?, gps_lng?
 * Header: Authorization: Bearer <user access token>
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'private_disputes';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const auth = req.headers.get('Authorization');
  if (!auth) {
    return new Response(JSON.stringify({ error: 'missing_authorization' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !serviceKey) {
    return new Response('Server misconfigured', { status: 500, headers: cors });
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const formData = await req.formData();
  const videoFile = formData.get('video');
  const planId = formData.get('plan_id') as string | null;
  const reportedUserId = formData.get('reported_user_id') as string | null;
  const gpsLatRaw = formData.get('gps_lat');
  const gpsLngRaw = formData.get('gps_lng');
  const gpsLat = gpsLatRaw ? parseFloat(String(gpsLatRaw)) : null;
  const gpsLng = gpsLngRaw ? parseFloat(String(gpsLngRaw)) : null;

  if (!(videoFile instanceof File) || !planId || !reportedUserId) {
    return new Response(
      JSON.stringify({ error: 'video, plan_id, and reported_user_id are required' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  if (reportedUserId === user.id) {
    return new Response(JSON.stringify({ error: 'invalid_reported_user' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const serviceClient = createClient(url, serviceKey);

  const { data: plan } = await serviceClient
    .from('plans')
    .select('id, creator_id')
    .eq('id', planId)
    .maybeSingle();

  const { data: guestOffer } = await serviceClient
    .from('plan_offers')
    .select('id')
    .eq('plan_id', planId)
    .eq('bidder_id', user.id)
    .eq('status', 'accepted')
    .maybeSingle();

  const isHost = plan?.creator_id === user.id;
  if (!isHost && !guestOffer) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const serverTimestamp = new Date().toISOString();
  const safeTs = serverTimestamp.replace(/[:.]/g, '-');
  const storagePath = `dispute-videos/${user.id}/${planId}/${safeTs}.webm`;

  const { error: uploadError } = await serviceClient.storage
    .from(BUCKET)
    .upload(storagePath, videoFile, {
      contentType: videoFile.type || 'video/webm',
      upsert: false,
    });

  if (uploadError) {
    return new Response(
      JSON.stringify({ error: 'Video upload failed. Please try again.' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  const { data: nudge } = await serviceClient
    .from('plan_arrival_nudges')
    .select('nudged_at')
    .eq('plan_id', planId)
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: existingDispute } = await serviceClient
    .from('disputes')
    .select('id')
    .eq('plan_id', planId)
    .eq('reporter_id', user.id)
    .in('status', ['pending', 'reviewing'])
    .maybeSingle();

  let disputeId = existingDispute?.id as string | undefined;

  if (!disputeId) {
    const { data: created, error: disputeError } = await serviceClient
      .from('disputes')
      .insert({
        plan_id: planId,
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        category: 'no_show',
        status: 'pending',
        reporter_note: 'No-show reported with live video evidence.',
        video_storage_path: storagePath,
        video_uploaded_at: serverTimestamp,
        video_gps_lat: gpsLat,
        video_gps_lng: gpsLng,
        nudge_timestamp: nudge?.nudged_at ?? null,
      })
      .select('id')
      .single();

    if (disputeError || !created) {
      return new Response(
        JSON.stringify({ error: 'Could not create dispute record.' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
    disputeId = created.id as string;
  } else {
    await serviceClient
      .from('disputes')
      .update({
        video_storage_path: storagePath,
        video_uploaded_at: serverTimestamp,
        video_gps_lat: gpsLat,
        video_gps_lng: gpsLng,
        nudge_timestamp: nudge?.nudged_at ?? null,
        updated_at: serverTimestamp,
      })
      .eq('id', disputeId);
  }

  await serviceClient.from('dispute_evidence').insert({
    dispute_id: disputeId,
    type: 'video',
    file_path: storagePath,
    metadata: {
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      server_timestamp: serverTimestamp,
      uploader_id: user.id,
    },
  });

  return new Response(
    JSON.stringify({
      dispute_id: disputeId,
      video_path: storagePath,
      server_timestamp: serverTimestamp,
    }),
    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
  );
});
