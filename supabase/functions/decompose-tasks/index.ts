import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'npm:openai';

type TaskDraft = {
  title: string;
  description?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_at?: string | null;
};

type DecompositionRequest = {
  prompt: string;
  ownerId?: string;
  timezone?: string;
  desiredCount?: number;
};

type DecompositionResponse = {
  tasks: TaskDraft[];
  summary?: string;
};

const parseAllowedOrigins = (): string[] =>
  (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = parseAllowedOrigins();

const isOriginAllowed = (origin: string | null): boolean =>
  allowedOrigins.length === 0 || (!!origin && allowedOrigins.includes(origin));

const buildCorsHeaders = (origin: string | null) => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': isOriginAllowed(origin)
    ? origin ?? allowedOrigins[0] ?? '*'
    : 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
});

const normalizeTasks = (tasks: TaskDraft[] = []): TaskDraft[] =>
  tasks
    .map((task) => ({
      title: task.title.trim(),
      description: task.description ?? null,
      priority: task.priority ?? 'medium',
      due_at: task.due_at ?? null,
    }))
    .filter((task) => task.title.length > 0);

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

  let payload: DecompositionRequest | null = null;
  try {
    payload = await req.json();
  } catch (error) {
    console.error('Failed to parse request payload', error);
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
  }

  if (!payload?.prompt || payload.prompt.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'A prompt is required' }), {
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn('Unauthorized decompose-tasks request', { error: authError?.message });
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
  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Break the task into concise todo items. Return JSON matching the schema with tasks ordered from most urgent to least urgent.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `User task: ${payload.prompt}` },
            payload.desiredCount
              ? { type: 'text', text: `Aim for ${payload.desiredCount} items.` }
              : null,
            payload.timezone ? { type: 'text', text: `Timezone: ${payload.timezone}` } : null,
            payload.ownerId ? { type: 'text', text: `Owner: ${payload.ownerId}` } : null,
          ].filter(Boolean) as { type: 'text'; text: string }[],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'task_decomposition',
          schema: {
            type: 'object',
            properties: {
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: ['string', 'null'] },
                    priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                    due_at: { type: ['string', 'null'], description: 'ISO8601 due date if mentioned' },
                  },
                  required: ['title'],
                  additionalProperties: false,
                },
              },
              summary: { type: 'string' },
            },
            required: ['tasks'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const parsed = content ? JSON.parse(content) : { tasks: [] };
    const tasks = normalizeTasks(parsed.tasks);
    const response: DecompositionResponse = {
      tasks,
      summary: parsed.summary,
    };

    console.info('decompose-tasks success', {
      owner: payload.ownerId,
      requested: payload.desiredCount,
      generated: tasks.length,
    });

    return new Response(JSON.stringify(response), { headers: corsHeaders });
  } catch (error) {
    console.error('decompose-tasks failed', error);
    return new Response(JSON.stringify({ error: 'Failed to decompose tasks' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
