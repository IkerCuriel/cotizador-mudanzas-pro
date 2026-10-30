-- Varios asesores del mismo negocio familiar y segundo factor para el equipo.
-- Aplicar después de 202610300001; no recrea cuentas ni cambia las asignaciones previas.
begin;

drop index public.one_family_provider;
alter table private.platform_settings drop column family_provider_id;
comment on column public.profiles.is_family is 'Miembro autorizado del negocio familiar; puede haber varios asesores. Solo superadministración modifica esta pertenencia.';

create function private.has_required_assurance() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'applicant' or coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
    from public.profiles where id = auth.uid()), false);
$$;
revoke all on function private.has_required_assurance() from public, anon, authenticated;
grant execute on function private.has_required_assurance() to authenticated;

create or replace function private.is_operator() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
    and exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','superadmin'));
$$;
create or replace function private.is_superadmin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
    and exists(select 1 from public.profiles where id = auth.uid() and role = 'superadmin');
$$;
create or replace function private.require_verified_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not exists(select 1 from auth.users where id = v_user and email_confirmed_at is not null) then
    raise exception 'Verifica tu correo e inicia sesión para continuar.' using errcode = '42501';
  end if;
  if not private.has_required_assurance() then
    raise exception 'Confirma tu segundo factor de seguridad para continuar.' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

create or replace function private.can_read_assigned_request(p_request_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.request_recipients r
    join public.profiles p on p.id = r.provider_id
    join public.move_requests m on m.id = r.request_id
    where r.request_id = p_request_id and p.id = auth.uid()
      and p.role = 'provider' and p.provider_status = 'approved' and p.plan_expires_at > now()
      and m.status <> 'cancelled' and (m.audience <> 'family' or p.is_family)
  );
$$;

-- La comprobación es del servidor: esconder botones nunca concede ni revoca permisos.
-- Se permite leer el propio perfil para configurar MFA; el resto se protege por RLS.
create policy requests_require_assurance on public.move_requests as restrictive for select to authenticated using (private.has_required_assurance());
create policy recipients_require_assurance on public.request_recipients as restrictive for select to authenticated using (private.has_required_assurance());
create policy notifications_require_assurance on public.notifications as restrictive for select to authenticated using (private.has_required_assurance());
create policy profile_changes_require_assurance on public.profiles as restrictive for update to authenticated using (private.has_required_assurance()) with check (private.has_required_assurance());

create or replace function public.submit_request(p_reference text, p_payload jsonb, p_audience text default 'family', p_privacy_version text default '2026-10-30') returns public.move_requests
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
      and ((p_audience = 'family' and p.is_family) or (p_audience = 'network'));
  get diagnostics recipient_count = row_count;
  if recipient_count = 0 then raise exception 'No hay una empresa habilitada para recibir la solicitud. Contacta al negocio por WhatsApp.' using errcode = '55000'; end if;
  insert into public.notifications(user_id,request_id) select provider_id,result.id from public.request_recipients where request_id = result.id;
  insert into private.audit_events(actor_id,action,subject_id,details) values(v_user,'request_submitted',result.id,jsonb_build_object('audience',p_audience,'privacy_version',p_privacy_version,'recipient_count',recipient_count));
  return result;
end;
$$;

create or replace function public.set_provider_access(p_user_id uuid, p_status text, p_expires_at timestamptz, p_is_family boolean default false) returns public.profiles
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
  if p_is_family <> result.is_family and not private.is_superadmin() then raise exception 'Solo el superusuario puede cambiar el equipo familiar.' using errcode = '42501'; end if;
  update public.profiles set provider_status = p_status, plan_expires_at = p_expires_at, is_family = p_is_family where id = p_user_id returning * into result;
  insert into private.audit_events(actor_id,action,subject_id,details) values(auth.uid(),'provider_access_changed',p_user_id,jsonb_build_object('status',p_status,'expires_at',p_expires_at,'is_family',p_is_family));
  return result;
end;
$$;

create or replace function public.set_user_role(p_user_id uuid, p_role text) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare result public.profiles%rowtype;
begin
  perform private.require_verified_user();
  if not private.is_superadmin() then raise exception 'Solo el superusuario puede cambiar roles.' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('applicant','provider','admin') or p_user_id = auth.uid() then raise exception 'Cambio de rol no permitido.' using errcode = '22023'; end if;
  select * into result from public.profiles where id = p_user_id for update;
  if not found or result.role = 'superadmin' then raise exception 'Esta cuenta no admite cambios desde el panel.' using errcode = '42501'; end if;
  if result.role = p_role then return result; end if;
  update public.profiles set role = p_role, provider_status = 'pending', plan_expires_at = null, is_family = false where id = p_user_id returning * into result;
  insert into private.audit_events(actor_id,action,subject_id,details) values(auth.uid(),'user_role_changed',p_user_id,jsonb_build_object('role',p_role));
  return result;
end;
$$;

-- La invitación no presupone consentimiento. Se registra cuando su titular lo acepta.
create function public.accept_account_privacy(p_privacy_version text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_verified_user();
begin
  if p_privacy_version is null or not exists(select 1 from private.platform_settings where singleton and privacy_version = p_privacy_version) then
    raise exception 'El aviso de privacidad cambió. Revísalo y autoriza de nuevo.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  if not exists(select 1 from private.audit_events where actor_id=v_user and action='account_privacy_accepted' and details->>'privacy_version'=p_privacy_version) then
    insert into private.audit_events(actor_id,action,subject_id,details)
    values(v_user,'account_privacy_accepted',v_user,jsonb_build_object('privacy_version',p_privacy_version,'source','invitation'));
  end if;
end;
$$;
revoke all on function public.accept_account_privacy(text) from public, anon, authenticated;
grant execute on function public.accept_account_privacy(text) to authenticated;

commit;
