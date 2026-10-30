-- MoveFlow: cuentas, solicitudes privadas y acceso piloto. Ejecutar con el rol postgres.
-- Nunca utilizar service_role en el navegador. Los permisos no se leen de user_metadata.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'applicant' check (role in ('applicant','provider','admin','superadmin')),
  display_name text not null default '' check (char_length(display_name) <= 100),
  phone text not null default '' check (char_length(phone) <= 40),
  company_name text not null default '' check (char_length(company_name) <= 120),
  provider_status text not null default 'pending' check (provider_status in ('pending','approved','suspended')),
  plan_code text not null default 'pilot' check (plan_code = 'pilot'),
  plan_expires_at timestamptz,
  is_family boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_requires_provider check (not is_family or role = 'provider')
);
create unique index one_family_provider on public.profiles (is_family) where is_family;

create table private.platform_settings (
  singleton boolean primary key default true check (singleton),
  accepting_requests boolean not null default false,
  network_enabled boolean not null default false,
  privacy_version text not null default '2026-10-30',
  family_provider_id uuid references public.profiles(id) on delete set null
);
insert into private.platform_settings(singleton) values (true);

create table public.move_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null check (reference ~ '^MF-[A-Za-z0-9-]{3,80}$'),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 40000),
  audience text not null check (audience in ('family','network')),
  status text not null default 'submitted' check (status in ('submitted','contacted','negotiating','completed','cancelled')),
  privacy_version text not null,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, reference)
);
create index move_requests_owner_created on public.move_requests(owner_id, created_at desc);

create table public.request_recipients (
  request_id uuid not null references public.move_requests(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, provider_id)
);
create index request_recipients_provider on public.request_recipients(provider_id, request_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null references public.move_requests(id) on delete cascade,
  title text not null default 'Tienes una nueva solicitud de mudanza',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, request_id)
);
create index notifications_user_created on public.notifications(user_id, created_at desc);

create table private.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  subject_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.move_requests enable row level security;
alter table public.request_recipients enable row level security;
alter table public.notifications enable row level security;
alter table private.platform_settings enable row level security;
alter table private.audit_events enable row level security;
revoke all on public.profiles, public.move_requests, public.request_recipients, public.notifications from public, anon, authenticated;
revoke all on private.platform_settings, private.audit_events from public, anon, authenticated;
grant select on public.profiles, public.move_requests, public.request_recipients, public.notifications to authenticated;
grant update (display_name, phone, company_name) on public.profiles to authenticated;

create function private.is_operator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin'));
$$;
create function private.is_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'superadmin');
$$;
create function private.can_read_assigned_request(p_request_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.request_recipients r
    join public.profiles p on p.id = r.provider_id
    join public.move_requests m on m.id = r.request_id
    where r.request_id = p_request_id and p.id = auth.uid()
      and p.role = 'provider' and p.provider_status = 'approved' and p.plan_expires_at > now()
      and m.status <> 'cancelled'
  );
$$;
revoke all on function private.is_operator(), private.is_superadmin(), private.can_read_assigned_request(uuid) from public, anon, authenticated;
grant execute on function private.is_operator(), private.can_read_assigned_request(uuid) to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or private.is_operator());
create policy profiles_edit_own_contact on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy requests_read on public.move_requests for select to authenticated using (
  owner_id = (select auth.uid()) or private.is_operator() or private.can_read_assigned_request(id)
);
create policy recipients_read on public.request_recipients for select to authenticated using (
  private.is_operator() or (provider_id = (select auth.uid()) and private.can_read_assigned_request(request_id))
);
create policy notifications_read_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));

create function private.touch_profile() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger touch_profile before update on public.profiles for each row execute function private.touch_profile();

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Estos metadatos son texto de contacto sin privilegios; jamás se copian roles ni consentimientos.
  insert into public.profiles(id,display_name,phone,company_name) values (
    new.id,
    case when jsonb_typeof(new.raw_user_meta_data->'display_name') = 'string'
      then left(btrim(regexp_replace(new.raw_user_meta_data->>'display_name','[[:cntrl:]]','','g')),100) else '' end,
    case when jsonb_typeof(new.raw_user_meta_data->'phone') = 'string'
      then left(btrim(regexp_replace(new.raw_user_meta_data->>'phone','[[:cntrl:]]','','g')),40) else '' end,
    case when jsonb_typeof(new.raw_user_meta_data->'company_name') = 'string'
      then left(btrim(regexp_replace(new.raw_user_meta_data->>'company_name','[[:cntrl:]]','','g')),120) else '' end
  ) on conflict (id) do nothing;
  -- Evidencia del aviso aceptado al registrarse: captura del servidor, no fecha del cliente.
  -- Ausencia, versión obsoleta o metadatos de una invitación no inventan consentimiento.
  if new.raw_user_meta_data->'privacy_accepted' = 'true'::jsonb
    and jsonb_typeof(new.raw_user_meta_data->'privacy_version') = 'string'
    and exists (
      select 1 from private.platform_settings
      where singleton and privacy_version = new.raw_user_meta_data->>'privacy_version'
    ) then
    insert into private.audit_events(actor_id,action,subject_id,details)
    values(new.id,'account_privacy_accepted',new.id,
      jsonb_build_object('privacy_version',new.raw_user_meta_data->>'privacy_version','source','registration'));
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.create_profile();
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;
revoke all on function private.create_profile(), private.touch_profile() from public, anon, authenticated;

create function public.public_site_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('accepting_requests', s.accepting_requests,
    'network_enabled', s.network_enabled, 'privacy_version', s.privacy_version)
  from private.platform_settings s where singleton;
$$;

create function private.require_verified_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not exists(select 1 from auth.users where id = v_user and email_confirmed_at is not null) then
    raise exception 'Verifica tu correo e inicia sesión para continuar.' using errcode = '42501';
  end if;
  return v_user;
end;
$$;
revoke all on function private.require_verified_user() from public, anon, authenticated;

create function private.validate_request_payload(p_payload jsonb, p_audience text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  f jsonb; v_fields jsonb := '{}'::jsonb; v_rooms jsonb; v_inventory jsonb;
  k text; v jsonb; n numeric; total numeric := 0; endpoint text;
  allowed_fields text[] := array['origin','destination','routeType','foraneoMode','moveDate','dateFlexibility','distanceKm',
    'originProperty','originFloor','originAccess','originElevatorFloors','originCarryRange','originCarryMeters','originShuttle',
    'destinationProperty','destinationFloor','destinationAccess','destinationElevatorFloors','destinationCarryRange','destinationCarryMeters','destinationShuttle',
    'packingType','boxCount','packingAcknowledged','hoistService','hoistUpFloors','hoistDownFloors','shuttleService','assemblyCount','storageDays','extraLoaders',
    'specialNotes','customItems','notes','customerName','phone','email','contactMethod','contactWindow','privacyConsent','networkConsent'];
  room_keys text[] := array['living','dining','bedroom','storage','sitting','study','kitchen','laundry','service','dressing','terrace'];
  item_keys text[] := array['sofa-two','sofa-three','sofa-sectional','armchair-single','armchair-recliner','table-four','table-six','table-eight','chair-dining','chair-office','chair-folding','bed-single','bed-double','bed-queen','bed-king','wardrobe-small','wardrobe-large','dresser-standard','nightstand','refrigerator-mini','refrigerator-standard','refrigerator-duplex','refrigerator-french-door','washer-standard','dryer-standard','laundry-center','tv-small','tv-medium','tv-large','desk-standard','desk-large','bookcase-small','bookcase-large','appliance-stove','appliance-microwave','appliance-oven','appliance-dishwasher','boxes-medium','boxes-large','boxes-kitchen','decor-frames','decor-coffee-table','outdoor-table','outdoor-lounger','piano-upright','piano-grand','bar-standard','safe-small','safe-large','shed-modular'];
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 40000 then
    raise exception 'La solicitud supera el tamaño permitido o tiene un formato inválido.' using errcode = '22023';
  end if;
  f := p_payload->'fields'; v_rooms := p_payload->'rooms'; v_inventory := p_payload->'inventory';
  if coalesce(jsonb_typeof(f),'') <> 'object' or coalesce(jsonb_typeof(v_rooms),'') <> 'object' or coalesce(jsonb_typeof(v_inventory),'') <> 'object' then
    raise exception 'Faltan los datos, las habitaciones o el inventario.' using errcode = '22023';
  end if;
  -- Se guardan solamente campos conocidos; los controles de dueño, precio, rol y estado nunca se aceptan.
  for k, v in select key,value from jsonb_each(f) loop
    if not k = any(allowed_fields) then continue; end if;
    if k in ('privacyConsent','networkConsent','packingAcknowledged') then
      if jsonb_typeof(v) <> 'boolean' then raise exception 'Consentimiento inválido: %', k using errcode = '22023'; end if;
    elsif k in ('originFloor','originElevatorFloors','destinationFloor','destinationElevatorFloors','boxCount','hoistUpFloors','hoistDownFloors','assemblyCount','storageDays','extraLoaders') then
      if jsonb_typeof(v) <> 'number' then raise exception 'Cantidad inválida: %', k using errcode = '22023'; end if;
      n := (v #>> '{}')::numeric;
      if n < 0 or n <> trunc(n) or n > (case when k = 'boxCount' then 5000 when k = 'storageDays' then 365 when k = 'assemblyCount' then 99 when k = 'extraLoaders' then 20 else 50 end) then
        raise exception 'Cantidad fuera de rango: %', k using errcode = '22023';
      end if;
    elsif k in ('distanceKm','originCarryMeters','destinationCarryMeters') then
      if v <> '""'::jsonb then
        if jsonb_typeof(v) <> 'number' then raise exception 'Distancia inválida: %', k using errcode = '22023'; end if;
        n := (v #>> '{}')::numeric;
        if n < 1 or n > (case when k = 'distanceKm' then 10000 else 2000 end) then raise exception 'Distancia fuera de rango.' using errcode = '22023'; end if;
      end if;
    else
      if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > (case
        when k in ('notes','customItems','specialNotes') then 3000 when k in ('origin','destination') then 500
        when k = 'customerName' then 100 when k = 'email' then 254 else 40 end) then
        raise exception 'Texto inválido o demasiado largo: %', k using errcode = '22023';
      end if;
    end if;
    v_fields := v_fields || jsonb_build_object(k,v);
  end loop;
  if coalesce(f->'privacyConsent','null'::jsonb) <> 'true'::jsonb or (p_audience = 'network' and coalesce(f->'networkConsent','null'::jsonb) <> 'true'::jsonb) then
    raise exception 'Hace falta la autorización correspondiente para compartir la solicitud.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(f->>'origin',''))) < 3 or char_length(btrim(coalesce(f->>'destination',''))) < 3 or char_length(btrim(coalesce(f->>'customerName',''))) < 2 or char_length(regexp_replace(coalesce(f->>'phone',''),'[^0-9]','','g')) not between 10 and 15 then
    raise exception 'Completa origen, destino, nombre y teléfono válido.' using errcode = '22023';
  end if;
  if coalesce(f->>'routeType','') not in ('local','outOfTown') or (f->>'routeType' = 'outOfTown' and coalesce(f->>'foraneoMode','') not in ('direct','shared','undecided')) then raise exception 'Selecciona un tipo de mudanza válido.' using errcode = '22023'; end if;
  if coalesce(f->>'dateFlexibility','') not in ('exact','flexible') then raise exception 'Selecciona la flexibilidad de fecha.' using errcode = '22023'; end if;
  if coalesce(f->>'moveDate','') <> '' then
    if f->>'moveDate' !~ '^\d{4}-\d{2}-\d{2}$' or to_char((f->>'moveDate')::date,'YYYY-MM-DD') <> f->>'moveDate' then raise exception 'Fecha inválida.' using errcode = '22023'; end if;
  elsif f->>'dateFlexibility' = 'exact' then raise exception 'Selecciona la fecha de la mudanza.' using errcode = '22023'; end if;
  if coalesce(f->>'email','') <> '' and f->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Correo de contacto inválido.' using errcode = '22023'; end if;
  foreach endpoint in array array['origin','destination'] loop
    if coalesce(f->>(endpoint || 'Property'),'') not in ('house','apartment','storage','duplex','residential','residentialPlus','office')
      or coalesce(f->>(endpoint || 'Access'),'') not in ('ground','stairs','elevator','combined')
      or coalesce(f->>(endpoint || 'CarryRange'),'') not in ('0-10','11-20','21-30','over30','unknown')
      or coalesce(f->>(endpoint || 'Shuttle'),'') not in ('yes','no','unknown') then raise exception 'Completa el acceso de %.', endpoint using errcode = '22023'; end if;
    if not f ? (endpoint || 'Floor') or not f ? (endpoint || 'ElevatorFloors') then raise exception 'Faltan los niveles de %.', endpoint using errcode = '22023'; end if;
    if (f->>(endpoint || 'ElevatorFloors'))::numeric > (f->>(endpoint || 'Floor'))::numeric then raise exception 'Los pisos con elevador exceden el nivel.' using errcode = '22023'; end if;
  end loop;
  if coalesce(f->>'packingType','') not in ('none','partial','full','boxes','undecided') or coalesce(f->>'hoistService','') not in ('yes','no','unknown') or coalesce(f->>'shuttleService','') not in ('yes','no','unknown')
    or coalesce(f->>'contactMethod','') not in ('whatsapp','call','either') or coalesce(f->>'contactWindow','') not in ('morning','afternoon','evening','anytime') then raise exception 'Selecciona servicios y preferencias válidos.' using errcode = '22023'; end if;
  if f->>'packingType' = 'none' and coalesce(f->'packingAcknowledged','null'::jsonb) <> 'true'::jsonb then raise exception 'Confirma las instrucciones de empaque.' using errcode = '22023'; end if;
  for k,v in select key,value from jsonb_each(v_rooms) loop
    if not k = any(room_keys) or jsonb_typeof(v) <> 'number' then raise exception 'Habitación inválida.' using errcode = '22023'; end if;
    n := (v #>> '{}')::numeric;
    if n < 0 or n > 20 or n <> trunc(n) then raise exception 'Número de habitaciones inválido.' using errcode = '22023'; end if;
  end loop;
  for k,v in select key,value from jsonb_each(v_inventory) loop
    if not k = any(item_keys) or jsonb_typeof(v) <> 'number' then raise exception 'Artículo inválido.' using errcode = '22023'; end if;
    n := (v #>> '{}')::numeric;
    if n < 0 or n > 99 or n <> trunc(n) then raise exception 'Cantidad de artículos inválida.' using errcode = '22023'; end if;
    total := total + n;
  end loop;
  if total = 0 and char_length(btrim(coalesce(f->>'customItems',''))) < 3 then raise exception 'Agrega artículos o describe tu inventario.' using errcode = '22023'; end if;
  return jsonb_build_object('fields',v_fields,'rooms',v_rooms,'inventory',v_inventory);
end;
$$;
revoke all on function private.validate_request_payload(jsonb,text) from public, anon, authenticated;

create function public.submit_request(p_reference text, p_payload jsonb, p_audience text default 'family', p_privacy_version text default '2026-10-30') returns public.move_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.require_verified_user(); s private.platform_settings%rowtype;
  v_payload jsonb; result public.move_requests%rowtype; recipient_count integer;
begin
  if p_audience is null or p_audience not in ('family','network') or p_reference is null or p_reference !~ '^MF-[A-Za-z0-9-]{3,80}$' then raise exception 'Referencia o destinatario inválido.' using errcode = '22023'; end if;
  v_payload := private.validate_request_payload(p_payload,p_audience);
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  select * into result from public.move_requests where owner_id = v_user and reference = p_reference;
  if found then
    if result.payload <> v_payload or result.audience <> p_audience or result.privacy_version <> p_privacy_version then raise exception 'Esta referencia ya existe con otros datos. Prepara una solicitud nueva.' using errcode = '23505'; end if;
    return result;
  end if;
  select * into s from private.platform_settings where singleton;
  if not coalesce(s.accepting_requests,false) then raise exception 'El registro de solicitudes aún no está habilitado.' using errcode = '55000'; end if;
  if p_privacy_version is null or p_privacy_version <> s.privacy_version then raise exception 'El aviso de privacidad cambió. Revísalo y autoriza de nuevo.' using errcode = '22023'; end if;
  if p_audience = 'network' and not s.network_enabled then raise exception 'La red de empresas todavía no está habilitada.' using errcode = '55000'; end if;
  if (select count(*) from public.move_requests where owner_id = v_user and created_at > now() - interval '10 minutes') >= 5 or (select count(*) from public.move_requests where owner_id = v_user and created_at > now() - interval '1 day') >= 20 then raise exception 'Llegaste al límite temporal de solicitudes. Inténtalo más tarde.' using errcode = '54000'; end if;
  insert into public.move_requests(reference,owner_id,payload,audience,privacy_version) values(p_reference,v_user,v_payload,p_audience,p_privacy_version) returning * into result;
  insert into public.request_recipients(request_id,provider_id)
    select result.id, p.id from public.profiles p where p.role = 'provider' and p.provider_status = 'approved' and p.plan_expires_at > now()
      and ((p_audience = 'family' and p.id = s.family_provider_id and p.is_family) or (p_audience = 'network'));
  get diagnostics recipient_count = row_count;
  if recipient_count = 0 then raise exception 'No hay una empresa habilitada para recibir la solicitud. Contacta al negocio por WhatsApp.' using errcode = '55000'; end if;
  insert into public.notifications(user_id,request_id) select provider_id,result.id from public.request_recipients where request_id = result.id;
  insert into private.audit_events(actor_id,action,subject_id,details) values(v_user,'request_submitted',result.id,jsonb_build_object('audience',p_audience,'privacy_version',p_privacy_version,'recipient_count',recipient_count));
  return result;
end;
$$;

create function public.join_provider(p_company_name text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_verified_user(); result public.profiles%rowtype;
begin
  if p_company_name is null or char_length(btrim(p_company_name)) not between 2 and 120 then raise exception 'Escribe el nombre de la empresa (2 a 120 caracteres).' using errcode = '22023'; end if;
  select * into result from public.profiles where id = v_user for update;
  if result.role not in ('applicant','provider') then raise exception 'Esta cuenta ya tiene un rol de operación.' using errcode = '42501'; end if;
  update public.profiles set role = 'provider', company_name = btrim(p_company_name) where id = v_user returning * into result;
  insert into private.audit_events(actor_id,action,subject_id) values(v_user,'provider_requested',v_user);
  return result;
end;
$$;

create function public.set_provider_access(p_user_id uuid, p_status text, p_expires_at timestamptz, p_is_family boolean default false) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare result public.profiles%rowtype;
begin
  perform private.require_verified_user();
  if not private.is_operator() then raise exception 'Solo la administración puede autorizar empresas.' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('pending','approved','suspended') or p_is_family is null then raise exception 'Estado inválido.' using errcode = '22023'; end if;
  if p_status = 'approved' and (p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '366 days') then raise exception 'La vigencia debe estar entre hoy y un año.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('moveflow-family-provider'));
  select * into result from public.profiles where id = p_user_id and role = 'provider' for update;
  if not found then raise exception 'La cuenta no es una empresa registrada.' using errcode = '22023'; end if;
  if p_is_family <> result.is_family and not private.is_superadmin() then raise exception 'Solo el superusuario puede cambiar el negocio familiar.' using errcode = '42501'; end if;
  if p_is_family then
    update public.profiles set is_family = false where is_family and id <> p_user_id;
    update private.platform_settings set family_provider_id = p_user_id where singleton;
  elsif result.is_family then
    update private.platform_settings set family_provider_id = null where singleton;
  end if;
  update public.profiles set provider_status = p_status, plan_expires_at = p_expires_at, is_family = p_is_family where id = p_user_id returning * into result;
  insert into private.audit_events(actor_id,action,subject_id,details) values(auth.uid(),'provider_access_changed',p_user_id,jsonb_build_object('status',p_status,'expires_at',p_expires_at,'is_family',p_is_family));
  return result;
end;
$$;

create function public.set_user_role(p_user_id uuid, p_role text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare result public.profiles%rowtype;
begin
  perform private.require_verified_user();
  if not private.is_superadmin() then raise exception 'Solo el superusuario puede cambiar roles.' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('applicant','provider','admin') or p_user_id = auth.uid() then raise exception 'Cambio de rol no permitido.' using errcode = '22023'; end if;
  select * into result from public.profiles where id = p_user_id for update;
  if not found or result.role = 'superadmin' then raise exception 'Esta cuenta no admite cambios desde el panel.' using errcode = '42501'; end if;
  if result.role = p_role then return result; end if;
  if result.is_family then update private.platform_settings set family_provider_id = null where singleton; end if;
  update public.profiles set role = p_role, provider_status = 'pending', plan_expires_at = null, is_family = false where id = p_user_id returning * into result;
  insert into private.audit_events(actor_id,action,subject_id,details) values(auth.uid(),'user_role_changed',p_user_id,jsonb_build_object('role',p_role));
  return result;
end;
$$;

create function public.cancel_request(p_request_id uuid) returns public.move_requests
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_verified_user(); result public.move_requests%rowtype;
begin
  select * into result from public.move_requests where id = p_request_id and owner_id = v_user for update;
  if not found then raise exception 'No se encontró tu solicitud.' using errcode = '42501'; end if;
  if result.status = 'completed' then raise exception 'La solicitud ya está finalizada; contacta al administrador.' using errcode = '22023'; end if;
  update public.move_requests set status = 'cancelled', updated_at = now() where id = p_request_id returning * into result;
  insert into private.audit_events(actor_id,action,subject_id) values(v_user,'request_cancelled',p_request_id);
  return result;
end;
$$;

create function public.set_request_status(p_request_id uuid, p_status text) returns public.move_requests
language plpgsql security definer set search_path = '' as $$
declare result public.move_requests%rowtype;
begin
  perform private.require_verified_user();
  if not private.is_operator() then raise exception 'Solo la administración puede gestionar solicitudes.' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('contacted','negotiating','completed','cancelled') then raise exception 'Estado inválido.' using errcode = '22023'; end if;
  select * into result from public.move_requests where id = p_request_id for update;
  if not found then raise exception 'No se encontró la solicitud.' using errcode = '22023'; end if;
  if result.status in ('completed','cancelled') and result.status <> p_status then raise exception 'Una solicitud cerrada no se puede reabrir; el cliente debe autorizar una nueva.' using errcode = '22023'; end if;
  update public.move_requests set status = p_status, updated_at = now() where id = p_request_id returning * into result;
  insert into private.audit_events(actor_id,action,subject_id,details) values(auth.uid(),'request_status_changed',p_request_id,jsonb_build_object('status',p_status));
  return result;
end;
$$;

create function public.mark_notification_read(p_notification_id uuid) returns public.notifications
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_verified_user(); result public.notifications%rowtype;
begin
  update public.notifications set read_at = coalesce(read_at,now()) where id = p_notification_id and user_id = v_user returning * into result;
  if not found then raise exception 'No se encontró tu notificación.' using errcode = '42501'; end if;
  return result;
end;
$$;

revoke all on function public.public_site_config(), public.submit_request(text,jsonb,text,text), public.join_provider(text), public.set_provider_access(uuid,text,timestamptz,boolean), public.set_user_role(uuid,text), public.cancel_request(uuid), public.set_request_status(uuid,text), public.mark_notification_read(uuid) from public, anon, authenticated;
grant execute on function public.public_site_config() to anon, authenticated;
grant execute on function public.submit_request(text,jsonb,text,text), public.join_provider(text), public.set_provider_access(uuid,text,timestamptz,boolean), public.set_user_role(uuid,text), public.cancel_request(uuid), public.set_request_status(uuid,text), public.mark_notification_read(uuid) to authenticated;

commit;
