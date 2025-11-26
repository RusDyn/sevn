import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const parseAllowedOrigins = (): string[] =>
  (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = parseAllowedOrigins();

const isOriginAllowed = (origin: string | null): boolean =>
  allowedOrigins.length === 0 || origin === null || allowedOrigins.includes(origin);

const buildCorsHeaders = (origin: string | null, contentType = 'application/json') => ({
  'Content-Type': contentType,
  'Access-Control-Allow-Origin': isOriginAllowed(origin)
    ? origin ?? allowedOrigins[0] ?? '*'
    : 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

// Session configuration for transcription-only mode
const sessionConfig = {
  type: 'transcription',
  model: 'gpt-4o-transcribe',
  audio: {
    input: {
      format: { type: 'audio/pcm', rate: 24000 },
      noise_reduction: { type: 'near_field' },
      transcription: {
        model: 'gpt-4o-transcribe',
        language: 'en',
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
    },
  },
};

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (!isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase env vars missing for the edge function');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const authResult = await supabase.auth.getUser();
  const user = authResult.data.user;

  if (authResult.error || !user) {
    console.warn('realtime-session auth lookup failed', { error: authResult.error?.message });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not configured for the edge function');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  try {
    // Get the SDP offer from the client
    const offerSdp = await req.text();

    if (!offerSdp || !offerSdp.trim()) {
      return new Response(JSON.stringify({ error: 'Missing SDP offer' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Create multipart form with SDP and session config
    const formData = new FormData();
    formData.set('sdp', offerSdp);
    formData.set('session', JSON.stringify(sessionConfig));

    // Call OpenAI Realtime API unified interface
    const response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Realtime call creation failed', {
        status: response.status,
        error: errorText,
      });
      return new Response(JSON.stringify({ error: 'Failed to create realtime session' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Return the answer SDP to the client
    const answerSdp = await response.text();

    console.info('realtime-session created via WebRTC', { owner: user?.id });

    return new Response(answerSdp, {
      headers: buildCorsHeaders(origin, 'application/sdp'),
    });
  } catch (error) {
    console.error('realtime-session failed', error);
    return new Response(JSON.stringify({ error: 'Failed to create session' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
