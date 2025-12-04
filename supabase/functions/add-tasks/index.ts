import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type NewTask = {
  title: string;
  description?: string | null;
};

type ExistingTask = {
  id: string;
  title: string;
  description: string | null;
  position: number;
};

type AddTasksRequest = {
  newTasks: NewTask[];
  position: 'auto' | 'top' | 'bottom';
};

type TaskResult = {
  id: string;
  title: string;
  description?: string | null;
  position: number;
};

type AddTasksResponse = {
  tasks: TaskResult[];
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

/**
 * Heuristic-based positioning that skips OpenAI for obvious cases.
 * Returns null if AI is needed for complex positioning decisions.
 */
const tryHeuristicPosition = (
  newTasks: NewTask[],
  existingTasks: ExistingTask[]
): { positions: number[]; updates: { id: string; position: number }[] } | null => {
  // Empty queue: assign sequential positions, no updates needed
  if (existingTasks.length === 0) {
    return {
      positions: newTasks.map((_, i) => i + 1),
      updates: [],
    };
  }

  // Single task with keyword-based urgency detection
  if (newTasks.length === 1) {
    const title = newTasks[0].title.toLowerCase();

    // Urgent keywords → position 1, shift all existing tasks
    if (/\b(urgent|asap|now|critical|emergency|immediately)\b/.test(title)) {
      return {
        positions: [1],
        updates: existingTasks.map((t) => ({ id: t.id, position: t.position + 1 })),
      };
    }

    // Low priority keywords → append at bottom, no updates needed
    if (/\b(someday|later|eventually|maybe|when i have time)\b/.test(title)) {
      const maxPosition = Math.max(...existingTasks.map((t) => t.position));
      return {
        positions: [maxPosition + 1],
        updates: [],
      };
    }
  }

  // Cannot determine heuristically, need AI
  return null;
};

/**
 * Call OpenAI Chat Completions API with gpt-4o-mini for fast task positioning.
 * No reasoning overhead, optimized for speed.
 */
const callOpenAI = async (
  apiKey: string,
  existingTasks: ExistingTask[],
  newTasks: NewTask[],
  totalTaskCount: number
): Promise<number[]> => {
  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-nano';

  // Minimal prompt
  const queue = existingTasks.map((t, i) => `${i + 1}.${t.title.slice(0, 30)}`).join(',');
  const tasks = newTasks.map((t) => t.title.slice(0, 30)).join(',');

  const startTime = Date.now();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: `Queue:[${queue}] Add:[${tasks}] Return positions 1-${totalTaskCount} as JSON array. Position 1=urgent.`,
        },
      ],
      max_tokens: 30,
      temperature: 0,
    }),
  });

  const endTime = Date.now();
  console.log('OpenAI API call time', endTime - startTime);
  if (!response.ok) {
    console.error('OpenAI error', response.status);
    return newTasks.map((_, i) => existingTasks.length + i + 1);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  try {
    const match = content.match(/\[[\d,\s]+\]/);
    if (!match) {
      return newTasks.map((_, i) => existingTasks.length + i + 1);
    }
    const positions = JSON.parse(match[0]);
    return newTasks.map((_, index) => {
      const pos = positions[index];
      return typeof pos === 'number' ? Math.max(1, Math.min(pos, totalTaskCount)) : existingTasks.length + index + 1;
    });
  } catch {
    return newTasks.map((_, i) => existingTasks.length + i + 1);
  }
};

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

  let payload: AddTasksRequest | null = null;
  try {
    payload = await req.json();
  } catch (error) {
    console.error('Failed to parse request payload', error);
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
  }

  if (!payload?.newTasks || payload.newTasks.length === 0) {
    return new Response(JSON.stringify({ error: 'At least one new task is required' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (!payload.position || !['auto', 'top', 'bottom'].includes(payload.position)) {
    return new Response(JSON.stringify({ error: 'position must be auto, top, or bottom' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Validate all tasks have titles
  const invalidTask = payload.newTasks.find((t) => !t.title || t.title.trim().length === 0);
  if (invalidTask) {
    return new Response(JSON.stringify({ error: 'All tasks must have a title' }), {
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

  // Use auth from request for RLS
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const newTasks = payload.newTasks;
  const position = payload.position;

  try {
    // Parallel: fetch auth and existing tasks simultaneously
    // RLS ensures we only get tasks for the authenticated user
    const [authResult, tasksResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('tasks').select('id, title, description, position').order('position', { ascending: true }),
    ]);

    const { data: { user }, error: authError } = authResult;
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { data: existingTasksData, error: fetchError } = tasksResult;
    if (fetchError) {
      console.error('Failed to fetch existing tasks', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch tasks' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const ownerId = user.id;
    const existingTasks: ExistingTask[] = existingTasksData ?? [];

    // Determine positions for new tasks based on mode
    let newTaskPositions: number[];
    let existingUpdates: { id: string; position: number }[] = [];

    if (position === 'bottom') {
      // Add at bottom: find max position and append after
      const maxPosition = existingTasks.length > 0
        ? Math.max(...existingTasks.map((t) => t.position))
        : 0;
      newTaskPositions = newTasks.map((_, i) => maxPosition + i + 1);
    } else if (position === 'top') {
      // Add at top: new tasks get positions 1, 2, 3...
      // Existing tasks shift up by the number of new tasks
      newTaskPositions = newTasks.map((_, i) => i + 1);

      if (existingTasks.length > 0) {
        const shiftAmount = newTasks.length;
        existingUpdates = existingTasks.map((t) => ({ id: t.id, position: t.position + shiftAmount }));
      }
    } else {
      // 'auto' mode: try heuristics first, fall back to AI
      const heuristicResult = tryHeuristicPosition(newTasks, existingTasks);

      if (heuristicResult) {
        // Heuristics succeeded, skip AI
        newTaskPositions = heuristicResult.positions;
        existingUpdates = heuristicResult.updates;
        console.info('add-tasks: used heuristic positioning');
      } else {
        // Fall back to AI positioning
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) {
          // No API key: default to bottom positioning
          const maxPosition = existingTasks.length > 0
            ? Math.max(...existingTasks.map((t) => t.position))
            : 0;
          newTaskPositions = newTasks.map((_, i) => maxPosition + i + 1);
          console.warn('add-tasks: OPENAI_API_KEY not set, using bottom positioning');
        } else if (existingTasks.length === 0) {
          // No existing tasks, assign sequential positions
          newTaskPositions = newTasks.map((_, i) => i + 1);
        } else {
          // Ask AI where to place new tasks
          const totalTaskCount = existingTasks.length + newTasks.length;
          const aiPositions = await callOpenAI(apiKey, existingTasks, newTasks, totalTaskCount);

          // Build merged order: interleave existing and new based on AI positions
          type MergedItem = { type: 'existing'; task: ExistingTask } | { type: 'new'; index: number; aiPos: number };

          const finalOrder: MergedItem[] = [];
          const newByPos = aiPositions.map((aiPos, idx) => ({ aiPos, idx })).sort((a, b) => a.aiPos - b.aiPos);

          let existingIdx = 0;
          let newIdx = 0;

          for (let pos = 1; pos <= totalTaskCount; pos++) {
            if (newIdx < newByPos.length && newByPos[newIdx].aiPos === pos) {
              finalOrder.push({ type: 'new', index: newByPos[newIdx].idx, aiPos: pos });
              newIdx++;
            } else if (existingIdx < existingTasks.length) {
              finalOrder.push({ type: 'existing', task: existingTasks[existingIdx] });
              existingIdx++;
            }
          }

          // Add any remaining (handle duplicate AI positions)
          while (newIdx < newByPos.length) {
            finalOrder.push({ type: 'new', index: newByPos[newIdx].idx, aiPos: newByPos[newIdx].aiPos });
            newIdx++;
          }
          while (existingIdx < existingTasks.length) {
            finalOrder.push({ type: 'existing', task: existingTasks[existingIdx] });
            existingIdx++;
          }

          // Assign final positions (1, 2, 3, ...)
          newTaskPositions = new Array(newTasks.length);

          finalOrder.forEach((item, idx) => {
            const finalPos = idx + 1;
            if (item.type === 'new') {
              newTaskPositions[item.index] = finalPos;
            } else {
              existingUpdates.push({ id: item.task.id, position: finalPos });
            }
          });
        }
      }
    }

    // Batch update existing task positions with single RPC call
    if (existingUpdates.length > 0) {
      const { error: batchError } = await supabase.rpc('batch_update_task_positions', {
        p_owner: ownerId,
        p_updates: existingUpdates.map((u) => ({ id: u.id, position: u.position })),
      });

      if (batchError) {
        console.error('Failed to batch update positions', batchError);
        return new Response(JSON.stringify({ error: 'Failed to reposition tasks' }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // Insert new tasks with their positions
    const inserts = newTasks.map((task, i) => ({
      title: task.title.trim(),
      description: task.description?.trim() || null,
      position: newTaskPositions[i],
      owner_id: ownerId,
    }));

    const { data: insertedTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(inserts)
      .select();

    if (insertError) {
      console.error('Failed to insert tasks', insertError);
      return new Response(JSON.stringify({ error: 'Failed to add tasks' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const response: AddTasksResponse = {
      tasks: (insertedTasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        position: t.position,
      })),
    };

    console.info('add-tasks success', {
      owner: ownerId,
      count: newTasks.length,
      position,
      tasks: response.tasks.map((t) => ({ id: t.id, position: t.position })),
    });

    return new Response(JSON.stringify(response), { headers: corsHeaders });
  } catch (error) {
    console.error('add-tasks failed', error);
    return new Response(JSON.stringify({ error: 'Failed to add tasks' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
