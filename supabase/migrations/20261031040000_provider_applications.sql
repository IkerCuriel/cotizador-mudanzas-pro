-- Formal provider intake, closed until the operator completes the launch review.
-- This is an application, never payment evidence or permission to read customer data.
begin;

alter table private.platform_settings
  add column accepting_provider_applications boolean not null default false;

create table public.provider_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=12000),
  privacy_version text not null,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index provider_applications_pending on public.provider_applications(created_at,id) where status='pending';
alter table public.provider_applications enable row level security;
revoke all on public.provider_applications from public,anon,authenticated;
grant select on public.provider_applications to authenticated;

create function private.can_read_provider_application(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.has_required_assurance()
    and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
    and (p_user_id=auth.uid() or private.is_operator());
$$;
revoke all on function private.can_read_provider_application(uuid) from public,anon,authenticated;
grant execute on function private.can_read_provider_application(uuid) to authenticated;
create policy provider_applications_read on public.provider_applications for select to authenticated
  using (private.can_read_provider_application(user_id));

create function public.submit_provider_application(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=private.require_verified_user();
  v_profile public.profiles%rowtype;
  v_existing public.provider_applications%rowtype;
  v_settings private.platform_settings%rowtype;
  v_clean jsonb:='{}'::jsonb;
  v_place jsonb;
  v_text text;
  v_key text;
  v_max integer;
  v_id uuid;
  v_now timestamptz:=clock_timestamp();
begin
  select * into v_settings from private.platform_settings where singleton;
  if v_settings.accepting_provider_applications is distinct from true then
    raise exception 'El alta de empresas todavía no está habilitada.' using errcode='55000';
  end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then
    raise exception 'La solicitud de empresa tiene un formato o tamaño inválido.' using errcode='22023';
  end if;
  if p_payload->'consent' is distinct from 'true'::jsonb
    or jsonb_typeof(p_payload->'privacy_version') is distinct from 'string'
    or p_payload->>'privacy_version' is distinct from v_settings.privacy_version then
    raise exception 'Acepta el aviso de privacidad vigente para solicitar el alta.' using errcode='22023';
  end if;

  -- Allowlist: client-supplied owner, role, status, price and billing rights are ignored.
  for v_key,v_max in select key,value::integer from jsonb_each_text(
    '{"company":120,"contact":100,"email":254,"phone":40,"businessLocation":500,"coverage":180,"notes":400}'::jsonb)
  loop
    if not p_payload ? v_key and v_key in ('coverage','notes') then
      v_text:='';
    else
      if jsonb_typeof(p_payload->v_key) is distinct from 'string' then
        raise exception 'El campo % debe ser texto.',v_key using errcode='22023';
      end if;
      if char_length(p_payload->>v_key)>v_max then
        raise exception 'El campo % supera la longitud permitida.',v_key using errcode='22023';
      end if;
      v_text:=btrim(regexp_replace(p_payload->>v_key,'[[:cntrl:]]',' ','g'));
    end if;
    if v_key not in ('coverage','notes') and v_text='' then
      raise exception 'Completa el campo %.',v_key using errcode='22023';
    end if;
    if (v_key in ('company','contact') and char_length(v_text)<2)
      or (v_key='businessLocation' and char_length(v_text)<3)
      or (v_key='coverage' and char_length(v_text)=1) then
      raise exception 'Revisa el campo %.',v_key using errcode='22023';
    end if;
    v_clean:=v_clean||jsonb_build_object(v_key,v_text);
  end loop;
  if v_clean->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Escribe un correo de contacto válido.' using errcode='22023';
  end if;
  if v_clean->>'phone' !~ '^\+?[0-9 ().-]+$'
    or regexp_replace(v_clean->>'phone','[^0-9]','','g') !~ '^[0-9]{10,15}$' then
    raise exception 'Escribe un teléfono de contacto válido.' using errcode='22023';
  end if;
  if coalesce(p_payload->>'services','') not in ('local','nationwide','both')
    or coalesce(p_payload->>'plan','') not in ('monthly_149','annual_1440') then
    raise exception 'Selecciona los servicios y un plan válido.' using errcode='22023';
  end if;
  v_clean:=v_clean||jsonb_build_object('services',p_payload->>'services','plan',p_payload->>'plan');
  if p_payload ? 'businessLocationPlace' then
    v_place:=p_payload->'businessLocationPlace';
    if jsonb_typeof(v_place) is distinct from 'object'
      or jsonb_typeof(v_place->'placeId') is distinct from 'string'
      or char_length(coalesce(v_place->>'placeId','')) not between 1 and 300
      or coalesce(v_place->>'placeId','') !~ '^[A-Za-z0-9_-]+$'
      or jsonb_typeof(v_place->'label') is distinct from 'string'
      or v_place->>'label' is distinct from v_clean->>'businessLocation' then
      raise exception 'La ubicación seleccionada ya no coincide con la dirección. Busca de nuevo o escribe la dirección sin selección.' using errcode='22023';
    end if;
    -- Validate the transient label, then persist only Google's reusable place ID.
    -- Never copy a Places formatted address into the durable business directory.
    v_clean:=(v_clean-'businessLocation')||jsonb_build_object(
      'businessLocationSource','google',
      'businessLocationPlace',jsonb_build_object('placeId',v_place->>'placeId'));
  else
    -- Provenance is set by the server; a client-supplied source is never trusted.
    v_clean:=v_clean||jsonb_build_object('businessLocationSource','user');
  end if;

  -- A profile lock serializes concurrent submits; one record per user also bounds storage.
  select * into v_profile from public.profiles where id=v_user for update;
  if not found or v_profile.role not in ('applicant','provider') then
    raise exception 'Esta cuenta no puede solicitar un perfil de empresa.' using errcode='42501';
  end if;
  if v_profile.provider_status<>'pending' then
    raise exception 'Tu perfil ya fue revisado. Gestiona los cambios desde tu cuenta o contacta con soporte.' using errcode='42501';
  end if;
  select * into v_existing from public.provider_applications where user_id=v_user for update;
  if found then
    if v_existing.status<>'pending' then
      raise exception 'Esta solicitud ya fue revisada. Contacta con soporte para continuar.' using errcode='55000';
    end if;
    if v_existing.payload=v_clean and v_existing.privacy_version=v_settings.privacy_version then
      return jsonb_build_object('status','pending','applicationId',v_existing.id);
    end if;
    if v_existing.updated_at>v_now-interval '1 minute' then
      raise exception 'Espera un minuto antes de cambiar tu solicitud.' using errcode='54000';
    end if;
    v_id:=v_existing.id;
    update public.provider_applications set payload=v_clean,privacy_version=v_settings.privacy_version,
      consented_at=v_now,updated_at=v_now where id=v_id;
  else
    insert into public.provider_applications(user_id,payload,privacy_version,consented_at,created_at,updated_at)
      values(v_user,v_clean,v_settings.privacy_version,v_now,v_now,v_now) returning id into v_id;
  end if;

  -- Reuse the established account transition; it cannot approve a business.
  perform public.join_provider(v_clean->>'company');
  update public.profiles set display_name=v_clean->>'contact',phone=v_clean->>'phone',
    provider_status='pending',plan_expires_at=null,is_family=false where id=v_user;
  insert into private.audit_events(actor_id,action,subject_id,details)
    values(v_user,'provider_application_submitted',v_id,jsonb_build_object('privacy_version',v_settings.privacy_version,'plan',v_clean->>'plan'));
  return jsonb_build_object('status','pending','applicationId',v_id);
end;
$$;
revoke all on function public.submit_provider_application(jsonb) from public,anon,authenticated;
grant execute on function public.submit_provider_application(jsonb) to authenticated;

create or replace function public.public_site_config() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('accepting_requests',s.accepting_requests,'network_enabled',false,
    'privacy_version',s.privacy_version,'default_business_slug','d-curiel','business_routing_version',1,
    'route_destinations_version',1,'provider_applications_version',1,
    'accepting_provider_applications',s.accepting_provider_applications)
  from private.platform_settings s where singleton;
$$;

commit;
