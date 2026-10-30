-- Avisos Web Push. Inactivos por defecto; sin extensiones ni llamadas externas.
begin;

create table private.push_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into private.push_settings(singleton) values(true);

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  label text not null default 'Mi dispositivo' check (char_length(label) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,endpoint),
  constraint push_endpoint_allowed check (char_length(endpoint) <= 2000 and endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[A-Za-z0-9_~.%:@/-]+$'),
  constraint push_keys_format check (p256dh ~ '^[A-Za-z0-9_-]{87}$' and auth_secret ~ '^[A-Za-z0-9_-]{22}$')
);
create index push_devices_owner on public.push_devices(user_id) where active;

create table private.push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  device_id uuid not null references public.push_devices(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','sending','sent','skipped','failed')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  last_result text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(notification_id,device_id)
);
create index push_outbox_due on private.push_outbox(next_attempt_at) where status in ('pending','sending');
alter table private.push_settings enable row level security;
alter table private.push_outbox enable row level security;
alter table public.push_devices enable row level security;
revoke all on private.push_settings, private.push_outbox, public.push_devices from public, anon, authenticated;
grant select on public.push_devices to authenticated;
create policy push_devices_read_own on public.push_devices for select to authenticated
  using(user_id = (select auth.uid()) and (select auth.jwt()->>'aal') = 'aal2');

create function private.push_profile_eligible(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=p_user_id and u.email_confirmed_at is not null and
    (p.role in ('admin','superadmin') or (p.role='provider' and p.provider_status='approved' and p.plan_expires_at > now())));
$$;
create function private.push_notification_eligible(p_notification_id uuid, p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.push_profile_eligible(p_user_id) and exists (
    select 1 from public.notifications n join public.move_requests m on m.id=n.request_id join public.profiles p on p.id=n.user_id
    where n.id=p_notification_id and n.user_id=p_user_id and n.read_at is null
      and n.created_at > now()-interval '24 hours' and m.status not in ('cancelled','completed')
      and (p.role in ('admin','superadmin') or ((m.audience<>'family' or p.is_family) and exists(select 1 from public.request_recipients r where r.request_id=n.request_id and r.provider_id=p_user_id)))
  );
$$;
revoke all on function private.push_profile_eligible(uuid), private.push_notification_eligible(uuid,uuid) from public, anon, authenticated;

create function public.register_push_device(p_endpoint text, p_p256dh text, p_auth text, p_label text default 'Mi dispositivo', p_expected_user_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_verified_user(); v_id uuid;
begin
  if p_expected_user_id is null or p_expected_user_id<>v_user then
    raise exception 'La sesión cambió. Vuelve a iniciar la activación de avisos.' using errcode='42501';
  end if;
  if coalesce(auth.jwt()->>'aal','') <> 'aal2' or not private.push_profile_eligible(v_user) then
    raise exception 'Verifica tu segundo factor y el acceso de tu cuenta para activar avisos.' using errcode='42501';
  end if;
  if not exists(select 1 from private.push_settings where singleton and enabled) then
    raise exception 'Los avisos al teléfono todavía no están habilitados.' using errcode='55000';
  end if;
  if p_endpoint is null or char_length(p_endpoint)>2000 or p_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[A-Za-z0-9_~.%:@/-]+$'
    or p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$'
    or p_label is null or char_length(btrim(p_label)) not between 1 and 80 then
    raise exception 'Este dispositivo no proporciona una suscripción de avisos compatible.' using errcode='22023';
  end if;
  -- Serializar las altas por usuario evita superar el límite con solicitudes paralelas.
  perform 1 from public.profiles where id=v_user for update;
  if exists(select 1 from public.push_devices where endpoint=p_endpoint and user_id<>v_user) then
    raise exception 'Desactiva los avisos anteriores de este navegador y vuelve a intentarlo.' using errcode='42501';
  end if;
  if not exists(select 1 from public.push_devices where user_id=v_user and endpoint=p_endpoint and active)
    and (select count(*) from public.push_devices where user_id=v_user and active)>=5 then
    raise exception 'Puedes activar avisos en un máximo de cinco dispositivos.' using errcode='54000';
  end if;
  insert into public.push_devices(user_id,endpoint,p256dh,auth_secret,label)
  values(v_user,p_endpoint,p_p256dh,p_auth,btrim(p_label))
  on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_secret=excluded.auth_secret,label=excluded.label,active=true,updated_at=now()
    where public.push_devices.user_id=v_user
  returning id into v_id;
  if v_id is null then raise exception 'El dispositivo ya está vinculado a otra cuenta.' using errcode='42501'; end if;
  return v_id;
end;
$$;

create function public.revoke_push_device(p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Reducir permisos propios se permite también después de expirar el plan o AAL2.
  if auth.uid() is null then raise exception 'Inicia sesión para continuar.' using errcode='42501'; end if;
  update public.push_devices set active=false,updated_at=now() where user_id=auth.uid() and endpoint=p_endpoint;
  update private.push_outbox set status='skipped',last_result='device_revoked',lease_until=null,lease_token=null
    where device_id in (select id from public.push_devices where user_id=auth.uid() and endpoint=p_endpoint) and status in ('pending','sending');
end;
$$;
revoke all on function public.register_push_device(text,text,text,text,uuid), public.revoke_push_device(text) from public, anon, authenticated;
grant execute on function public.register_push_device(text,text,text,text,uuid), public.revoke_push_device(text) to authenticated;

create function private.enqueue_push_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from private.push_settings where singleton and enabled) and private.push_notification_eligible(new.id,new.user_id) then
    insert into private.push_outbox(notification_id,device_id)
      select new.id,id from public.push_devices where user_id=new.user_id and active
      on conflict(notification_id,device_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.enqueue_push_notification() from public, anon, authenticated;
create trigger enqueue_push_notification after insert on public.notifications for each row execute function private.enqueue_push_notification();

-- Solo el servicio de envío puede reclamar trabajo; ningún usuario puede leer la cola.
create function public.claim_push_jobs(p_limit integer default 10, p_notification_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_row record; result jsonb := '[]'::jsonb; v_token uuid;
begin
  if not exists(select 1 from private.push_settings where singleton and enabled) then return result; end if;
  update private.push_outbox set status='failed',last_result='attempts_exhausted',lease_until=null,lease_token=null
    where status='sending' and lease_until < now() and attempts>=5;
  for v_row in select o.id,o.notification_id,o.device_id,o.attempts,d.user_id,d.endpoint,d.p256dh,d.auth_secret,d.active
    from private.push_outbox o join public.push_devices d on d.id=o.device_id
    where (o.status='pending' or (o.status='sending' and o.lease_until<now())) and o.attempts<5 and o.next_attempt_at<=now()
      and (p_notification_id is null or o.notification_id=p_notification_id)
    order by o.created_at limit greatest(1,least(coalesce(p_limit,10),10)) for update of o skip locked
  loop
    if not v_row.active or not private.push_notification_eligible(v_row.notification_id,v_row.user_id) then
      update private.push_outbox set status='skipped',last_result='access_or_request_changed',lease_until=null,lease_token=null where id=v_row.id;
      continue;
    end if;
    v_token:=gen_random_uuid();
    update private.push_outbox set status='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes',lease_token=v_token where id=v_row.id;
    result:=result || jsonb_build_array(jsonb_build_object('id',v_row.id,'notification_id',v_row.notification_id,'device_id',v_row.device_id,'user_id',v_row.user_id,'endpoint',v_row.endpoint,'keys',jsonb_build_object('p256dh',v_row.p256dh,'auth',v_row.auth_secret),'lease_token',v_token));
  end loop;
  return result;
end;
$$;

create function public.push_job_is_current(p_id uuid,p_lease_token uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.push_outbox o join public.push_devices d on d.id=o.device_id
    where o.id=p_id and o.lease_token=p_lease_token and o.status='sending' and o.lease_until>now() and d.active
      and private.push_notification_eligible(o.notification_id,d.user_id)
      and exists(select 1 from private.push_settings where singleton and enabled));
$$;

create function public.finish_push_job(p_id uuid,p_lease_token uuid,p_result text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_job private.push_outbox%rowtype;
begin
  if p_result not in ('accepted','gone','retry','rejected','skipped') then raise exception 'Resultado de aviso inválido.' using errcode='22023'; end if;
  select * into v_job from private.push_outbox where id=p_id and lease_token=p_lease_token and status='sending' for update;
  if not found then return; end if;
  if p_result='gone' then update public.push_devices set active=false,updated_at=now() where id=v_job.device_id; end if;
  update private.push_outbox set
    status=case when p_result='accepted' then 'sent' when p_result in ('gone','skipped') then 'skipped' when p_result='retry' and attempts<5 then 'pending' else 'failed' end,
    next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)),
    sent_at=case when p_result='accepted' then now() else sent_at end,
    last_result=p_result,lease_until=null,lease_token=null where id=v_job.id;
end;
$$;
revoke all on function public.claim_push_jobs(integer,uuid),public.push_job_is_current(uuid,uuid),public.finish_push_job(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_push_jobs(integer,uuid),public.push_job_is_current(uuid,uuid),public.finish_push_job(uuid,uuid,text) to service_role;
commit;
