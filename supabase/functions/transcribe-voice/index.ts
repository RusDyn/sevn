import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI, { toFile } from 'npm:openai';

type TranscriptionResponse = {
  text: string;
  language?: string;
  duration?: number;
};

const parseAllowedOrigins = (): string[] =>
  (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = parseAllowedOrigins();

const isOriginAllowed = (origin: string | null): boolean =>
  allowedOrigins.length === 0 || origin === null || allowedOrigins.includes(origin);

const buildCorsHeaders = (origin: string | null) => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': isOriginAllowed(origin)
    ? origin ?? allowedOrigins[0] ?? '*'
    : 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (!isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: corsHeaders });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });
  }

  const contentType = req.headers.get('Content-Type') ?? '';

  // Expect multipart/form-data with audio file
  if (!contentType.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'Expected multipart/form-data with audio file' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (error) {
    console.error('Failed to parse form data', error);
    return new Response(JSON.stringify({ error: 'Invalid form data' }), { status: 400, headers: corsHeaders });
  }

  const audioFile = formData.get('audio');
  if (!audioFile || !(audioFile instanceof File)) {
    return new Response(JSON.stringify({ error: 'No audio file provided' }), {
      status: 400,
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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const authResult = await supabase.auth.getUser();
  const user = authResult.data.user;

  if (authResult.error || !user) {
    console.warn('transcribe-voice auth lookup failed', { error: authResult.error?.message });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not configured for the edge function');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const client = new OpenAI({ apiKey });

  try {
    // Get language hint from form data if provided
    const languageHint = formData.get('language');
    const language = typeof languageHint === 'string' ? languageHint : undefined;

    // Convert File to the format OpenAI expects
    const audioBuffer = await audioFile.arrayBuffer();
    const fileForOpenAI = await toFile(
      new Uint8Array(audioBuffer),
      audioFile.name || 'audio.m4a',
      { type: audioFile.type || 'audio/m4a' }
    );

    const transcription = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: fileForOpenAI,
      language,
      response_format: 'verbose_json',
    });

    const response: TranscriptionResponse = {
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
    };

    console.info('transcribe-voice success', {
      owner: user?.id,
      language: transcription.language,
      duration: transcription.duration,
      textLength: transcription.text.length,
    });

    return new Response(JSON.stringify(response), { headers: corsHeaders });
  } catch (error) {
    console.error('transcribe-voice failed', error);
    return new Response(JSON.stringify({ error: 'Failed to transcribe audio' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
