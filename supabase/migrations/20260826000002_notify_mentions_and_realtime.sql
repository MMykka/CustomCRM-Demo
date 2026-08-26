-- Note @mention notifications, plus a realtime publication fix: the
-- notification bell already subscribes to postgres_changes on
-- public.notifications (src/components/notifications/notification-bell.tsx),
-- but that table was never added to the supabase_realtime publication, so
-- the subscription has been silently inert since it was built. Fixed here
-- alongside adding notes so both new/existing panels get live updates.

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.notes;

-- Notifies each newly-mentioned user when a note mentions them (insert, or
-- an update that adds new ids to mentioned_user_ids). Mirrors
-- notify_task_assigned()'s shape. Self-mentions don't notify.
create or replace function public.notify_note_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_mentions uuid[];
  v_user_id uuid;
begin
  if TG_OP = 'INSERT' then
    v_new_mentions := new.mentioned_user_ids;
  else
    select array_agg(x) into v_new_mentions
    from unnest(new.mentioned_user_ids) x
    where x <> all (coalesce(old.mentioned_user_ids, '{}'::uuid[]));
  end if;

  if v_new_mentions is null then
    return new;
  end if;

  foreach v_user_id in array v_new_mentions loop
    if v_user_id is distinct from new.author_id then
      insert into public.notifications (organization_id, user_id, type, title, body, link_url, related_table, related_id)
      values (
        new.organization_id,
        v_user_id,
        'mention',
        'You were mentioned in a note',
        left(new.body, 140),
        case when new.contact_id is not null then '/contacts/' || new.contact_id::text else null end,
        'notes',
        new.id
      );
    end if;
  end loop;

  return new;
end;
$$;

create trigger notes_notify_mentions
  after insert or update of mentioned_user_ids on public.notes
  for each row execute function public.notify_note_mentions();
