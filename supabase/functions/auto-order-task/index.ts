import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'npm:openai';

type TaskSummary = {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  position: number;
};

type AutoOrderRequest = {
  newTask: {
    title: string;
    description?: string | null;
    priority?: string;
  };
  existingTasks: TaskSummary[];
  ownerId?: string;
};

type AutoOrderResponse = {
  position: number;
  reasoning?: string;
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

  let payload: AutoOrderRequest | null = null;
  try {
    payload = await req.json();
  } catch (error) {
    console.error('Failed to parse request payload', error);
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
  }

  if (!payload?.newTask?.title || payload.newTask.title.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'New task title is required' }), {
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
  let user = null;

  if (authHeader) {
    const result = await supabase.auth.getUser();
    user = result.data.user;

    if (result.error) {
      console.warn('auto-order-task auth lookup failed', { error: result.error.message });
    }
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

  const existingTasks = payload.existingTasks ?? [];
  const maxPosition = existingTasks.length > 0
    ? Math.max(...existingTasks.map((t) => t.position))
    : 0;

  // If there are no existing tasks, position at 1
  if (existingTasks.length === 0) {
    const response: AutoOrderResponse = {
      position: 1,
      reasoning: 'First task in queue',
    };
    return new Response(JSON.stringify(response), { headers: corsHeaders });
  }

  try {
    const existingTasksSummary = existingTasks
      .sort((a, b) => a.position - b.position)
      .map((t) => `#${t.position}: "${t.title}" (${t.priority})${t.description ? ` - ${t.description}` : ''}`)
      .join('\n');

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a task prioritization assistant for a focus app called Sevn that shows exactly 7 tasks.

Your job is to decide where to insert a new task in the queue based on urgency, importance, and context.

Rules:
- Position 1 is the most important/urgent task
- Higher positions (2, 3, ...) are less urgent
- Consider the priority levels: urgent > high > medium > low
- Consider task content and implied urgency
- The queue has a maximum of 7 visible tasks

Return the position number (1 to ${maxPosition + 1}) where the new task should be inserted.`,
        },
        {
          role: 'user',
          content: `Current task queue:
${existingTasksSummary}

New task to insert:
Title: "${payload.newTask.title}"
${payload.newTask.description ? `Description: ${payload.newTask.description}` : ''}
Priority: ${payload.newTask.priority ?? 'medium'}

Where should this task be positioned?`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'task_position',
          schema: {
            type: 'object',
            properties: {
              position: {
                type: 'integer',
                description: 'The position where the new task should be inserted (1-based)',
              },
              reasoning: {
                type: 'string',
                description: 'Brief explanation for the position choice',
              },
            },
            required: ['position', 'reasoning'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const parsed = content ? JSON.parse(content) : { position: maxPosition + 1 };

    // Clamp position to valid range
    const position = Math.max(1, Math.min(parsed.position, maxPosition + 1));

    const response: AutoOrderResponse = {
      position,
      reasoning: parsed.reasoning,
    };

    console.info('auto-order-task success', {
      owner: user?.id ?? payload.ownerId,
      newTaskTitle: payload.newTask.title,
      existingCount: existingTasks.length,
      assignedPosition: position,
    });

    return new Response(JSON.stringify(response), { headers: corsHeaders });
  } catch (error) {
    console.error('auto-order-task failed', error);
    return new Response(JSON.stringify({ error: 'Failed to determine task position' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
