-- Batch update task positions in a single atomic operation
-- Used by add-tasks edge function to update all existing task positions in one call

CREATE OR REPLACE FUNCTION public.batch_update_task_positions(
  p_owner uuid,
  p_updates jsonb  -- Array of {id: uuid, position: int}
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tasks t
  SET
    position = (u->>'position')::int,
    updated_at = now()
  FROM jsonb_array_elements(p_updates) AS u
  WHERE t.id = (u->>'id')::uuid
    AND t.owner_id = p_owner;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.batch_update_task_positions(uuid, jsonb) TO authenticated;
