-- PayPal Checkout preparation. This migration never enables payments.
begin;
create table private.paypal_purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  user_id uuid not null references public.profiles(id),
  request_id uuid not null,
  plan_code text not null references private.subscription_plans(code),
  amount_minor integer not null check (amount_minor in (14900,144000)),
  currency text not null check (currency='MXN'),
  months integer not null check (months in (1,12)),
  consent_version text not null check (consent_version='prepaid-v1'),
  status text not null default 'pending' check (status in ('pending','paid','revoked')),
  order_id text unique,
  capture_id text unique,
  merchant_id text,
  paid_from timestamptz,
  paid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,request_id),
  check ((plan_code='monthly_149' and amount_minor=14900 and months=1) or (plan_code='annual_1440' and amount_minor=144000 and months=12))
);
create index paypal_business_periods on private.paypal_purchases(business_id,paid_until) where status='paid';
create unique index paypal_one_pending_purchase on private.paypal_purchases(business_id) where status='pending';
alter table private.paypal_purchases enable row level security;
revoke all on private.paypal_purchases from public,anon,authenticated;

create function private.can_manage_business_billing(p_business uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(auth.jwt()->>'aal','')='aal2' and exists(
    select 1 from public.business_memberships m
    join public.businesses b on b.id=m.business_id
    join public.profiles p on p.id=m.user_id
    join auth.users u on u.id=p.id
    where m.business_id=p_business and m.user_id=auth.uid() and m.active and m.member_role='owner'
      and b.status='approved' and p.role='provider' and p.provider_status='approved'
      and u.email_confirmed_at is not null and (b.slug<>'d-curiel' or p.is_family));
$$;
revoke all on function private.can_manage_business_billing(uuid) from public,anon,authenticated;

create function public.get_my_billing_businesses() returns table(business_id uuid,name text,complimentary boolean,paid_until timestamptz)
language sql stable security definer set search_path='' as $$
  select b.id,b.name,
    exists(select 1 from private.provider_complimentary_access c where c.business_id=b.id and c.user_id=auth.uid() and c.enabled),
    (select max(p.paid_until) from private.paypal_purchases p where p.business_id=b.id and p.status='paid')
  from public.businesses b where private.can_manage_business_billing(b.id);
$$;
revoke all on function public.get_my_billing_businesses() from public,anon,authenticated;
grant execute on function public.get_my_billing_businesses() to authenticated;

create function public.prepare_paypal_purchase(p_business_id uuid,p_plan_code text,p_request_id uuid,p_consent_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v private.paypal_purchases; plan private.subscription_plans;
begin
  if p_request_id is null or p_consent_version is distinct from 'prepaid-v1' then raise exception 'Confirma las condiciones del periodo sin renovación automática.' using errcode='22023'; end if;
  perform 1 from public.businesses where id=p_business_id for update;
  if not private.can_manage_business_billing(p_business_id) then raise exception 'Se requiere empresa aprobada, permiso de propietario, correo verificado y segundo factor.' using errcode='42501'; end if;
  if exists(select 1 from private.provider_complimentary_access c where c.business_id=p_business_id and c.user_id=auth.uid() and c.enabled) then raise exception 'Tu acceso no requiere pago.' using errcode='22023'; end if;
  select * into plan from private.subscription_plans where code=p_plan_code and checkout_enabled;
  if not found then raise exception 'Los pagos de este plan aún no están habilitados.' using errcode='22023'; end if;
  select * into v from private.paypal_purchases where user_id=auth.uid() and request_id=p_request_id;
  if found then
    if v.business_id<>p_business_id or v.plan_code<>p_plan_code then raise exception 'La referencia ya corresponde a otra compra.' using errcode='22023'; end if;
    return to_jsonb(v);
  end if;
  -- A repeated click reuses the same pending order for this business and user.
  select * into v from private.paypal_purchases where business_id=p_business_id and status='pending';
  if found then
    if v.user_id<>auth.uid() then raise exception 'La empresa ya tiene una compra pendiente con otro propietario. Contacta a soporte.' using errcode='22023'; end if;
    if v.plan_code<>p_plan_code then raise exception 'Ya tienes una compra pendiente. Retómala antes de cambiar de plan.' using errcode='22023'; end if;
    return to_jsonb(v);
  end if;
  if (select count(*) from private.paypal_purchases where user_id=auth.uid() and created_at>now()-interval '1 day')>=5 then raise exception 'Se alcanzó el límite diario de intentos. Contacta a soporte.' using errcode='54000'; end if;
  insert into private.paypal_purchases(business_id,user_id,request_id,plan_code,amount_minor,currency,months,consent_version)
    values(p_business_id,auth.uid(),p_request_id,plan.code,plan.amount_minor,plan.currency,case plan.billing_interval when 'year' then 12 else 1 end,p_consent_version) returning * into v;
  return to_jsonb(v);
end;
$$;
revoke all on function public.prepare_paypal_purchase(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_paypal_purchase(uuid,text,uuid,text) to authenticated;

create function public.get_my_paypal_purchase(p_purchase_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v private.paypal_purchases;
begin
  select * into v from private.paypal_purchases where id=p_purchase_id and user_id=auth.uid();
  if not found or not private.can_manage_business_billing(v.business_id) then raise exception 'No tienes acceso a esta compra.' using errcode='42501'; end if;
  return to_jsonb(v);
end;
$$;
revoke all on function public.get_my_paypal_purchase(uuid) from public,anon,authenticated;
grant execute on function public.get_my_paypal_purchase(uuid) to authenticated;

-- These RPCs are server-only. A browser must never receive a service_role key.
create function public.bind_paypal_order(p_purchase_id uuid,p_order_id text,p_merchant_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v private.paypal_purchases;
begin
  if p_order_id is null or p_merchant_id is null or p_order_id !~ '^[A-Z0-9]{10,32}$' or p_merchant_id !~ '^[A-Z0-9]{8,32}$' then raise exception 'Invalid payment reference'; end if;
  select * into v from private.paypal_purchases where id=p_purchase_id for update;
  if not found or (v.order_id is not null and v.order_id<>p_order_id) or (v.merchant_id is not null and v.merchant_id<>p_merchant_id) then raise exception 'Payment binding mismatch'; end if;
  update private.paypal_purchases set order_id=p_order_id,merchant_id=p_merchant_id,updated_at=now() where id=v.id returning * into v;
  return to_jsonb(v);
end;
$$;
create function public.find_paypal_purchase(p_order_id text) returns jsonb
language sql stable security definer set search_path='' as $$ select to_jsonb(p) from private.paypal_purchases p where p.order_id=p_order_id $$;

create function public.settle_paypal_purchase(p_purchase_id uuid,p_order_id text,p_capture_id text,p_merchant_id text,p_amount_minor integer,p_currency text,p_revoked boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v private.paypal_purchases; b uuid; v_start timestamptz;
begin
  select business_id into b from private.paypal_purchases where id=p_purchase_id;
  perform 1 from public.businesses where id=b for update;
  select * into v from private.paypal_purchases where id=p_purchase_id for update;
  if not found or v.order_id is distinct from p_order_id or v.merchant_id is distinct from p_merchant_id or v.amount_minor is distinct from p_amount_minor or v.currency is distinct from p_currency
    or p_capture_id is null or p_capture_id !~ '^[A-Z0-9]{10,32}$' or (v.capture_id is not null and v.capture_id<>p_capture_id) then raise exception 'Payment verification mismatch'; end if;
  if p_revoked then
    update private.paypal_purchases set status='revoked',capture_id=p_capture_id,updated_at=now() where id=v.id returning * into v;
  elsif v.status='pending' then
    select greatest(now(),coalesce(max(p.paid_until),now())) into v_start from private.paypal_purchases p where p.business_id=v.business_id and p.status='paid';
    update private.paypal_purchases set status='paid',capture_id=p_capture_id,paid_from=v_start,paid_until=v_start+make_interval(months=>v.months),updated_at=now() where id=v.id returning * into v;
  end if;
  return jsonb_build_object('status',v.status,'paidUntil',v.paid_until);
end;
$$;
revoke all on function public.bind_paypal_order(uuid,text,text),public.find_paypal_purchase(text),public.settle_paypal_purchase(uuid,text,text,text,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.bind_paypal_order(uuid,text,text),public.find_paypal_purchase(text),public.settle_paypal_purchase(uuid,text,text,text,integer,text,boolean) to service_role;

create function public.paypal_checkout_available() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.platform_settings where accepting_requests)
    and (select count(*)=2 from private.subscription_plans where code in ('monthly_149','annual_1440') and checkout_enabled);
$$;
revoke all on function public.paypal_checkout_available() from public,anon,authenticated;
grant execute on function public.paypal_checkout_available() to service_role;

create function public.paypal_purchase_capture_allowed(p_purchase_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.paypal_purchases x
    join public.businesses b on b.id=x.business_id
    join public.business_memberships m on m.business_id=b.id and m.user_id=x.user_id
    join public.profiles p on p.id=x.user_id join auth.users u on u.id=p.id
    where x.id=p_purchase_id and x.status='pending' and b.status='approved' and m.active and m.member_role='owner'
      and p.role='provider' and p.provider_status='approved' and u.email_confirmed_at is not null
      and (b.slug<>'d-curiel' or p.is_family));
$$;
revoke all on function public.paypal_purchase_capture_allowed(uuid) from public,anon,authenticated;
grant execute on function public.paypal_purchase_capture_allowed(uuid) to service_role;

-- Payment never approves a company, creates a membership, or overrides suspension.
create or replace function private.provider_has_business_access(p_user_id uuid,p_business_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.business_memberships bm join public.businesses b on b.id=bm.business_id join public.profiles p on p.id=bm.user_id
    where bm.user_id=p_user_id and bm.business_id=p_business_id and bm.active and b.status='approved' and p.role='provider' and p.provider_status='approved'
      and (b.slug<>'d-curiel' or p.is_family)
      and (p.plan_expires_at>now() or (b.slug='d-curiel' and exists(select 1 from private.provider_complimentary_access c where c.user_id=p.id and c.business_id=b.id and c.enabled))
        or exists(select 1 from private.paypal_purchases x where x.business_id=b.id and x.status='paid' and x.paid_from<=now() and x.paid_until>now())));
$$;
revoke all on function private.provider_has_business_access(uuid,uuid) from public,anon,authenticated;
commit;
