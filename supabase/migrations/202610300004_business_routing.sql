-- Una solicitud, un negocio destinatario y un equipo pequeño: nunca difusión global.
-- Preparación local. Aplicar con postgres después de 001–003; no crea cuentas Auth.
begin;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  whatsapp text not null check (whatsapp ~ '^[1-9][0-9]{9,14}$'),
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  plan_code text not null default 'pilot' check (plan_code = 'pilot'),
  monthly_request_limit integer not null default 300 check (monthly_request_limit between 1 and 100000),
  created_at timestamptz not null default now()
);
comment on column public.businesses.monthly_request_limit is 'Límite operativo por mes UTC, no un plan de pago. Cambios solo por administración de servidor. El piloto propone 300; ajustar tras medir.';
create index businesses_created_cursor on public.businesses(created_at,id);

create table public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','member')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (business_id,user_id)
);
create index business_memberships_user on public.business_memberships(user_id,business_id) where active;
create index business_memberships_active_team on public.business_memberships(business_id,user_id) where active;

create table private.business_monthly_usage (
  business_id uuid not null references public.businesses(id) on delete cascade,
  month_start date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (business_id,month_start)
);
alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table private.business_monthly_usage enable row level security;
revoke all on public.businesses, public.business_memberships, private.business_monthly_usage from public,anon,authenticated;
grant select on public.businesses, public.business_memberships to authenticated;

-- Este registro identifica el negocio; no activa recepción ni cuentas del piloto.
insert into public.businesses(slug,name,whatsapp,status)
values('d-curiel','Mudanzas D’Curiel','525529061098','approved');

-- El bloqueo de la fila del negocio serializa altas de equipo y recepción.
create function private.limit_business_team() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.businesses where id=new.business_id for update;
  if new.active and (select count(*) from public.business_memberships
      where business_id=new.business_id and active
        and not (business_id=new.business_id and user_id=new.user_id)) >= 10 then
    raise exception 'Un negocio admite un máximo de diez integrantes activos. Desactiva una cuenta antes de agregar otra.' using errcode='54000';
  end if;
  if new.active and not exists(select 1 from public.profiles where id=new.user_id and role='provider') then
    raise exception 'El integrante debe tener una cuenta de proveedor.' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_business_team() from public,anon,authenticated;
create trigger limit_business_team before insert or update on public.business_memberships
  for each row execute function private.limit_business_team();

insert into public.business_memberships(business_id,user_id)
select b.id,p.id from public.businesses b cross join public.profiles p
where b.slug='d-curiel' and p.role='provider' and p.is_family;

-- Compatibilidad con el panel actual: el indicador familiar administra SOLO D’Curiel.
-- Otros negocios nunca se deducen de company_name ni de metadatos del registro.
create function private.sync_family_business_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_business uuid;
begin
  select id into v_business from public.businesses where slug='d-curiel';
  if new.role='provider' and new.is_family then
    if tg_op='INSERT' or not old.is_family or old.role<>'provider' then
      insert into public.business_memberships(business_id,user_id,active)
      values(v_business,new.id,true)
      on conflict(business_id,user_id) do update set active=true;
    end if;
  else
    update public.business_memberships set active=false where business_id=v_business and user_id=new.id and active;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_family_business_member() from public,anon,authenticated;
create trigger sync_family_business_member after insert or update of is_family,role on public.profiles
  for each row execute function private.sync_family_business_member();

alter table public.move_requests add column business_id uuid references public.businesses(id) on delete restrict;
update public.move_requests set business_id=(select id from public.businesses where slug='d-curiel') where audience='family';
-- Las solicitudes históricas de red no se reasignan a D’Curiel. Se conservan para
-- cliente y administración, pero no se siguen distribuyendo entre proveedores.
alter table public.move_requests drop constraint move_requests_audience_check;
alter table public.move_requests add constraint move_requests_audience_check check(audience in ('family','network','business'));
alter table public.move_requests add constraint direct_request_requires_business check(audience='network' or business_id is not null);
create function private.default_legacy_business() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.audience='family' and new.business_id is null then
    select id into new.business_id from public.businesses where slug='d-curiel';
  end if;
  return new;
end;
$$;
revoke all on function private.default_legacy_business() from public,anon,authenticated;
create trigger default_legacy_business before insert on public.move_requests
  for each row execute function private.default_legacy_business();

create index move_requests_created_cursor on public.move_requests(created_at desc,id desc);
create index move_requests_owner_cursor on public.move_requests(owner_id,created_at desc,id desc);
create index move_requests_business_cursor on public.move_requests(business_id,created_at desc,id desc);
create index notifications_user_cursor on public.notifications(user_id,created_at desc,id desc);

-- Backfill exacto del consumo: cancelaciones no liberan cuota (evita abuso por reenvío).
insert into private.business_monthly_usage(business_id,month_start,request_count)
select business_id,date_trunc('month',created_at at time zone 'UTC')::date,count(*)::integer
from public.move_requests where business_id is not null group by 1,2;

create function private.active_business_assignment(p_request_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.request_recipients r
    join public.move_requests m on m.id=r.request_id
    join public.profiles p on p.id=r.provider_id
    join public.business_memberships bm on bm.business_id=m.business_id and bm.user_id=p.id
    join public.businesses b on b.id=bm.business_id
    where r.request_id=p_request_id and r.provider_id=p_user_id
      and p.role='provider' and p.provider_status='approved' and p.plan_expires_at>now()
      and bm.active and b.status='approved' and m.status<>'cancelled'
      and (b.slug<>'d-curiel' or p.is_family)
  );
$$;
revoke all on function private.active_business_assignment(uuid,uuid) from public,anon,authenticated;
create or replace function private.can_read_assigned_request(p_request_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.active_business_assignment(p_request_id,auth.uid());
$$;

create function private.is_business_member(p_business_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal','')='aal2' and exists(
    select 1 from public.business_memberships bm join public.profiles p on p.id=bm.user_id
    join public.businesses b on b.id=bm.business_id
    where bm.business_id=p_business_id and bm.user_id=auth.uid() and bm.active
      and p.role='provider' and p.provider_status='approved' and p.plan_expires_at>now()
      and (b.slug<>'d-curiel' or p.is_family));
$$;
revoke all on function private.is_business_member(uuid) from public,anon,authenticated;
grant execute on function private.is_business_member(uuid) to authenticated;
create policy business_read on public.businesses for select to authenticated
  using (private.is_operator() or private.is_business_member(id));
create policy business_membership_read_own on public.business_memberships for select to authenticated
  using (private.is_operator() or (user_id=(select auth.uid()) and private.is_business_member(business_id)));
create policy notification_current_business_access on public.notifications as restrictive for select to authenticated
  using (private.is_operator() or private.can_read_assigned_request(request_id));

create or replace function private.push_notification_eligible(p_notification_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.push_profile_eligible(p_user_id) and exists(
    select 1 from public.notifications n join public.move_requests m on m.id=n.request_id join public.profiles p on p.id=n.user_id
    where n.id=p_notification_id and n.user_id=p_user_id and n.read_at is null
      and n.created_at>now()-interval '24 hours' and m.status not in ('cancelled','completed')
      and (p.role in ('admin','superadmin') or private.active_business_assignment(m.id,p_user_id)));
$$;

create or replace function public.mark_notification_read(p_notification_id uuid) returns public.notifications
language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=private.require_verified_user(); result public.notifications%rowtype;
begin
  update public.notifications set read_at=coalesce(read_at,now())
    where id=p_notification_id and user_id=v_user
      and (private.is_operator() or private.can_read_assigned_request(request_id)) returning * into result;
  if not found then raise exception 'No se encontró tu notificación.' using errcode='42501'; end if;
  return result;
end;
$$;

create function public.get_my_businesses()
returns table(id uuid,slug text,name text,whatsapp text,status text,plan_code text,monthly_request_limit integer,member_role text)
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid:=private.require_verified_user();
begin
  if private.is_operator() then
    return query select b.id,b.slug,b.name,b.whatsapp,b.status,b.plan_code,b.monthly_request_limit,'operator'::text
      from public.businesses b order by b.created_at,b.id limit 20;
  else
    -- Empezar por las membresías del usuario evita recorrer todos los negocios.
    return query select b.id,b.slug,b.name,b.whatsapp,b.status,b.plan_code,b.monthly_request_limit,bm.member_role
      from public.business_memberships bm join public.businesses b on b.id=bm.business_id
      where bm.user_id=v_user and bm.active and private.is_business_member(b.id)
      order by b.created_at,b.id limit 20;
  end if;
end;
$$;
revoke all on function public.get_my_businesses() from public,anon,authenticated;
grant execute on function public.get_my_businesses() to authenticated;

create function public.submit_business_request(p_reference text,p_payload jsonb,p_business_slug text default 'd-curiel',p_privacy_version text default '2026-10-30') returns public.move_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid:=private.require_verified_user(); s private.platform_settings%rowtype;
  b public.businesses%rowtype; v_payload jsonb; result public.move_requests%rowtype;
  recipient_count integer; v_month date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
  if p_reference is null or p_reference !~ '^MF-[A-Za-z0-9-]{3,80}$' or p_business_slug is null
    or p_business_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_business_slug) not between 3 and 80 then
    raise exception 'Referencia o negocio destinatario inválido.' using errcode='22023';
  end if;
  v_payload:=private.validate_request_payload(p_payload,'family');
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  select * into b from public.businesses where slug=p_business_slug;
  if not found then raise exception 'El negocio no está disponible para recibir solicitudes.' using errcode='55000'; end if;
  select * into result from public.move_requests where owner_id=v_user and reference=p_reference;
  if found then
    if result.payload<>v_payload or result.business_id is distinct from b.id or result.privacy_version is distinct from p_privacy_version then
      raise exception 'Esta referencia ya existe con otros datos o negocio. Prepara una solicitud nueva.' using errcode='23505';
    end if;
    return result;
  end if;
  select * into s from private.platform_settings where singleton;
  if not coalesce(s.accepting_requests,false) then raise exception 'El registro de solicitudes aún no está habilitado.' using errcode='55000'; end if;
  if p_privacy_version is null or p_privacy_version<>s.privacy_version then raise exception 'El aviso de privacidad cambió. Revísalo y autoriza de nuevo.' using errcode='22023'; end if;
  if (select count(*) from public.move_requests where owner_id=v_user and created_at>now()-interval '10 minutes')>=5
    or (select count(*) from public.move_requests where owner_id=v_user and created_at>now()-interval '1 day')>=20 then
    raise exception 'Llegaste al límite temporal de solicitudes. Inténtalo más tarde.' using errcode='54000';
  end if;
  -- Una fila por negocio serializa la comprobación de cuota y el equipo actual.
  select * into b from public.businesses where id=b.id for update;
  if b.status<>'approved' then raise exception 'El negocio no está disponible para recibir solicitudes.' using errcode='55000'; end if;
  insert into private.business_monthly_usage(business_id,month_start) values(b.id,v_month) on conflict do nothing;
  update private.business_monthly_usage set request_count=request_count+1
    where business_id=b.id and month_start=v_month and request_count<b.monthly_request_limit;
  if not found then raise exception 'El negocio alcanzó su límite mensual de solicitudes en el panel. Puedes contactarlo directamente por WhatsApp.' using errcode='54000'; end if;
  insert into public.move_requests(reference,owner_id,payload,audience,privacy_version,business_id)
    values(p_reference,v_user,v_payload,case when b.slug='d-curiel' then 'family' else 'business' end,p_privacy_version,b.id) returning * into result;
  insert into public.request_recipients(request_id,provider_id)
    select result.id,p.id from public.business_memberships bm join public.profiles p on p.id=bm.user_id
    where bm.business_id=b.id and bm.active and p.role='provider' and p.provider_status='approved' and p.plan_expires_at>now()
      and (b.slug<>'d-curiel' or p.is_family);
  get diagnostics recipient_count=row_count;
  if recipient_count=0 then raise exception 'No hay una empresa habilitada para recibir la solicitud. Contacta al negocio por WhatsApp.' using errcode='55000'; end if;
  if recipient_count>10 then raise exception 'El equipo supera el límite operativo. Contacta a la administración.' using errcode='54000'; end if;
  insert into public.notifications(user_id,request_id) select provider_id,result.id from public.request_recipients where request_id=result.id;
  insert into private.audit_events(actor_id,action,subject_id,details)
    values(v_user,'business_request_submitted',result.id,jsonb_build_object('business_id',b.id,'privacy_version',p_privacy_version,'recipient_count',recipient_count));
  return result;
end;
$$;
revoke all on function public.submit_business_request(text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.submit_business_request(text,jsonb,text,text) to authenticated;

-- El contrato anterior se mantiene solo para el negocio piloto. No existe difusión
-- masiva aunque alguien modifique network_enabled o invoque la API directamente.
create or replace function public.submit_request(p_reference text,p_payload jsonb,p_audience text default 'family',p_privacy_version text default '2026-10-30') returns public.move_requests
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_verified_user();
  if p_audience is distinct from 'family' then
    raise exception 'La red de empresas todavía no está habilitada: selecciona un negocio destinatario.' using errcode='55000';
  end if;
  return public.submit_business_request(p_reference,p_payload,'d-curiel',p_privacy_version);
end;
$$;
create or replace function public.public_site_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('accepting_requests',s.accepting_requests,'network_enabled',false,
    'privacy_version',s.privacy_version,'default_business_slug','d-curiel','business_routing_version',1)
  from private.platform_settings s where singleton;
$$;

commit;
