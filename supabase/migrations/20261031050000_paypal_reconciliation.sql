-- Reconciliation is server-only and does not enable checkout or schedule jobs.
begin;
alter table private.paypal_purchases drop constraint paypal_purchases_status_check;
alter table private.paypal_purchases add constraint paypal_purchases_status_check check(status in ('pending','paid','revoked','voided'));

create table private.paypal_reconciliation_queue (
  purchase_id uuid primary key references private.paypal_purchases(id) on delete cascade,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  last_checked_at timestamptz,
  last_outcome text
);
create index paypal_reconciliation_due on private.paypal_reconciliation_queue(next_attempt_at,purchase_id);
create table private.paypal_operational_issues (
  purchase_id uuid primary key references private.paypal_purchases(id),
  code text not null check(code in ('provider_retry','unbound_order','capture_blocked','awaiting_approval')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrences integer not null default 1,
  resolved_at timestamptz
);
alter table private.paypal_reconciliation_queue enable row level security;
alter table private.paypal_operational_issues enable row level security;
revoke all on private.paypal_reconciliation_queue,private.paypal_operational_issues from public,anon,authenticated;

create function private.enqueue_paypal_reconciliation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into private.paypal_reconciliation_queue(purchase_id) values(new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.enqueue_paypal_reconciliation() from public,anon,authenticated;
create trigger enqueue_paypal_reconciliation after insert on private.paypal_purchases for each row execute function private.enqueue_paypal_reconciliation();
insert into private.paypal_reconciliation_queue(purchase_id) select id from private.paypal_purchases;

create function public.claim_paypal_reconciliation(p_limit integer default 10) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  with picked as (
    select q.purchase_id from private.paypal_reconciliation_queue q
    where q.next_attempt_at<=now() and (q.lease_until is null or q.lease_until<=now())
    order by q.next_attempt_at,q.purchase_id for update skip locked limit least(greatest(coalesce(p_limit,10),1),10)
  ), claimed as (
    update private.paypal_reconciliation_queue q set lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=q.attempts+1
    from picked where q.purchase_id=picked.purchase_id returning q.purchase_id,q.lease_token
  ) select coalesce(jsonb_agg(jsonb_build_object('purchase',to_jsonb(p),'leaseToken',c.lease_token)),'[]'::jsonb) into result
    from claimed c join private.paypal_purchases p on p.id=c.purchase_id;
  return result;
end;
$$;

create function public.finish_paypal_reconciliation(p_purchase_id uuid,p_lease_token uuid,p_outcome text,p_issue_code text default null) returns void
language plpgsql security definer set search_path='' as $$
declare v private.paypal_purchases; resolved boolean;
begin
  if p_outcome is null or p_outcome not in ('paid','pending','revoked','voided','retry') or (p_issue_code is not null and p_issue_code not in ('provider_retry','unbound_order','capture_blocked','awaiting_approval')) then raise exception 'Invalid reconciliation result'; end if;
  select * into v from private.paypal_purchases where id=p_purchase_id;
  update private.paypal_reconciliation_queue set lease_token=null,lease_until=null,last_checked_at=now(),last_outcome=p_outcome,
    next_attempt_at=case when v.status in ('voided','revoked') then 'infinity'::timestamptz
      when p_outcome='retry' then now()+interval '15 minutes'
      when v.status='paid' then now()+interval '1 day'
      else now()+interval '1 hour' end
    where purchase_id=p_purchase_id and lease_token=p_lease_token and lease_until>now();
  if not found then raise exception 'Reconciliation lease expired'; end if;
  if p_issue_code is not null then
    select exists(select 1 from private.paypal_operational_issues where purchase_id=p_purchase_id and code=p_issue_code and resolved_at is null) into resolved;
    insert into private.paypal_operational_issues(purchase_id,code) values(p_purchase_id,p_issue_code)
    on conflict(purchase_id) do update set code=excluded.code,last_seen_at=now(),occurrences=private.paypal_operational_issues.occurrences+1,resolved_at=null;
    -- Audit contains only internal reference and a finite error code, no payload.
    if not resolved then
      insert into private.audit_events(actor_id,action,subject_id,details)
        values(null,'paypal_reconciliation_issue',v.user_id,jsonb_build_object('purchase_id',p_purchase_id,'code',p_issue_code));
    end if;
  else
    update private.paypal_operational_issues set resolved_at=now() where purchase_id=p_purchase_id and resolved_at is null;
  end if;
end;
$$;

create function public.retire_paypal_order(p_purchase_id uuid,p_order_id text,p_verified_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v private.paypal_purchases;
begin
  select * into v from private.paypal_purchases where id=p_purchase_id for update;
  if not found or p_verified_status is distinct from 'VOIDED' or v.order_id is distinct from p_order_id or p_order_id is null
    or v.capture_id is not null or v.status not in ('pending','voided') then raise exception 'Order cannot be retired'; end if;
  update private.paypal_purchases set status='voided',updated_at=now() where id=v.id;
  insert into private.audit_events(actor_id,action,subject_id,details)
    values(null,'paypal_order_voided',v.user_id,jsonb_build_object('purchase_id',v.id,'order_id',v.order_id));
  return jsonb_build_object('status','voided','paidUntil',null);
end;
$$;
revoke all on function public.claim_paypal_reconciliation(integer),public.finish_paypal_reconciliation(uuid,uuid,text,text),public.retire_paypal_order(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_paypal_reconciliation(integer),public.finish_paypal_reconciliation(uuid,uuid,text,text),public.retire_paypal_order(uuid,text,text) to service_role;

-- Operational counts are visible only to operators with verified email and MFA.
create function public.get_paypal_operational_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_verified_user();
  if not private.is_operator() then raise exception 'Acceso de administración requerido.' using errcode='42501'; end if;
  return jsonb_build_object('openIssues',(select count(*) from private.paypal_operational_issues where resolved_at is null),
    'pendingPurchases',(select count(*) from private.paypal_purchases where status='pending'),
    'lastCheck',(select max(last_checked_at) from private.paypal_reconciliation_queue));
end;
$$;
revoke all on function public.get_paypal_operational_summary() from public,anon,authenticated;
grant execute on function public.get_paypal_operational_summary() to authenticated;
commit;
