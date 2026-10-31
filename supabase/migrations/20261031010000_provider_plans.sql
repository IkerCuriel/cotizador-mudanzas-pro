-- Billing preparation only. No payment processor, new accounts or intake activation.
-- A courtesy is an administrative grant for a specific member of D’Curiel.
begin;

create table private.subscription_plans (
  code text primary key,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (currency = 'MXN'),
  billing_interval text not null check (billing_interval = 'month'),
  checkout_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
insert into private.subscription_plans(code,amount_minor,currency,billing_interval)
values('monthly_149',14900,'MXN','month');
comment on table private.subscription_plans is 'Prepared commercial catalog. No checkout or subscription activation is implemented by this migration.';

create table private.provider_complimentary_access (
  business_id uuid not null,
  user_id uuid not null,
  enabled boolean not null default false,
  granted_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (business_id,user_id),
  foreign key (business_id,user_id) references public.business_memberships(business_id,user_id) on delete cascade
);
alter table private.subscription_plans enable row level security;
alter table private.provider_complimentary_access enable row level security;
revoke all on private.subscription_plans,private.provider_complimentary_access from public,anon,authenticated;

-- Rejoining a removed team does not silently revive an earlier courtesy.
create function private.retire_member_complimentary_access() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.active and not new.active then
    update private.provider_complimentary_access set enabled=false,updated_at=now()
      where business_id=new.business_id and user_id=new.user_id and enabled;
    if found then
      insert into private.audit_events(actor_id,action,subject_id,details)
        values(auth.uid(),'provider_complimentary_access_retired',new.user_id,jsonb_build_object('business_id',new.business_id,'reason','membership_inactive'));
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.retire_member_complimentary_access() from public,anon,authenticated;
create trigger retire_member_complimentary_access after update of active on public.business_memberships
  for each row execute function private.retire_member_complimentary_access();

-- Billing is checked in the context of one business, not just one user.
-- Expiring pilot permissions continue working. A courtesy cannot apply to any
-- other business, create membership or bypass administrative approval.
create function private.provider_has_business_access(p_user_id uuid,p_business_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.business_memberships bm
    join public.businesses b on b.id=bm.business_id
    join public.profiles p on p.id=bm.user_id
    where bm.user_id=p_user_id and bm.business_id=p_business_id and bm.active
      and b.status='approved' and p.role='provider' and p.provider_status='approved'
      and (b.slug<>'d-curiel' or p.is_family)
      and (p.plan_expires_at>now() or (b.slug='d-curiel' and exists(
        select 1 from private.provider_complimentary_access c
        where c.user_id=p.id and c.business_id=b.id and c.enabled)))
  );
$$;
revoke all on function private.provider_has_business_access(uuid,uuid) from public,anon,authenticated;

create or replace function private.active_business_assignment(p_request_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.request_recipients r join public.move_requests m on m.id=r.request_id
    where r.request_id=p_request_id and r.provider_id=p_user_id and m.status<>'cancelled'
      and private.provider_has_business_access(p_user_id,m.business_id)
  );
$$;

create or replace function private.is_business_member(p_business_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(auth.jwt()->>'aal','')='aal2'
    and private.provider_has_business_access(auth.uid(),p_business_id);
$$;

create or replace function private.push_profile_eligible(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=p_user_id and u.email_confirmed_at is not null and
      (p.role in ('admin','superadmin') or exists(
        select 1 from public.business_memberships bm where bm.user_id=p.id and bm.active
          and private.provider_has_business_access(p.id,bm.business_id))));
$$;

-- Only the current user's eligibility is exposed; no prices, grant reasons or
-- other beneficiaries. AAL1 returns false so an owner can still configure MFA.
create function public.get_my_access_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_active boolean;
begin
  if v_user is null or not exists(select 1 from auth.users where id=v_user and email_confirmed_at is not null) then
    raise exception 'Verifica tu correo e inicia sesión para continuar.' using errcode='42501';
  end if;
  select coalesce(auth.jwt()->>'aal','')='aal2' and exists(
    select 1 from public.business_memberships bm where bm.user_id=v_user and bm.active
      and private.provider_has_business_access(v_user,bm.business_id)) into v_active;
  return jsonb_build_object('access_version',1,'provider_access_active',v_active);
end;
$$;
revoke all on function public.get_my_access_status() from public,anon,authenticated;
grant execute on function public.get_my_access_status() to authenticated;

create function public.set_provider_complimentary_access(p_user_id uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_verified_user(); v_business uuid;
begin
  if not private.is_superadmin() then raise exception 'Solo el superusuario puede administrar este acceso.' using errcode='42501'; end if;
  if p_user_id is null or p_enabled is null then raise exception 'Selecciona una cuenta y un estado válidos.' using errcode='22023'; end if;
  select b.id into v_business from public.businesses b where b.slug='d-curiel' for update;
  if v_business is null then raise exception 'No existe el negocio configurado.' using errcode='22023'; end if;
  -- Revocation must remain possible after suspension or membership removal.
  if p_enabled and not exists(
    select 1 from public.business_memberships bm join public.profiles p on p.id=bm.user_id
      join auth.users u on u.id=p.id join public.businesses b on b.id=bm.business_id
    where bm.business_id=v_business and bm.user_id=p_user_id and bm.active and b.status='approved'
      and p.role='provider' and p.provider_status='approved' and p.is_family and u.email_confirmed_at is not null
  ) then raise exception 'La cuenta debe estar verificada y aprobada como integrante activo del negocio.' using errcode='22023'; end if;
  if p_enabled then
    insert into private.provider_complimentary_access(business_id,user_id,enabled,granted_by)
      values(v_business,p_user_id,true,v_actor)
      on conflict(business_id,user_id) do update set enabled=true,granted_by=v_actor,updated_at=now();
  else
    update private.provider_complimentary_access set enabled=false,granted_by=v_actor,updated_at=now()
      where business_id=v_business and user_id=p_user_id;
  end if;
  insert into private.audit_events(actor_id,action,subject_id,details)
    values(v_actor,'provider_complimentary_access_changed',p_user_id,jsonb_build_object('business_id',v_business,'enabled',p_enabled));
end;
$$;
revoke all on function public.set_provider_complimentary_access(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_provider_complimentary_access(uuid,boolean) to authenticated;

create or replace function public.submit_business_request(p_reference text,p_payload jsonb,p_business_slug text default 'd-curiel',p_privacy_version text default '2026-10-30') returns public.move_requests
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
    where bm.business_id=b.id and bm.active and private.provider_has_business_access(p.id,b.id)
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

commit;
