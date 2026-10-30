-- Ejecutar solo en proyecto local/de pruebas con la migración aplicada.
-- psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/authorization.sql
-- Todas las inserciones y cambios se revierten al terminar, incluso sin pgTAP.
begin;

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
values
  ('a0000000-0000-4000-8000-000000000001','rls-a@example.test',now(),'{"role":"superadmin"}'),
  ('a0000000-0000-4000-8000-000000000002','rls-b@example.test',now(),'{}'),
  ('a0000000-0000-4000-8000-000000000003','rls-provider@example.test',now(),'{}');
update public.profiles set role='provider',provider_status='approved',plan_expires_at=now()+interval '1 day' where id='a0000000-0000-4000-8000-000000000003';

insert into public.move_requests(id,reference,owner_id,payload,audience,privacy_version) values
('b0000000-0000-4000-8000-000000000001','MF-RLS-TEST','a0000000-0000-4000-8000-000000000001','{"fields":{"phone":"5512345678"},"rooms":{},"inventory":{}}','family','2026-10-30');
insert into public.request_recipients(request_id,provider_id) values('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000003');
insert into public.notifications(user_id,request_id) values('a0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
begin
  if (select role from public.profiles where id=auth.uid()) <> 'applicant' then raise exception 'FAIL: metadata concedió permisos'; end if;
  if (select count(*) from public.move_requests where id='b0000000-0000-4000-8000-000000000001') <> 1 then raise exception 'FAIL: dueño no puede leer su solicitud'; end if;
  begin
    update public.profiles set role='superadmin' where id=auth.uid();
    raise exception 'FAIL: usuario cambió su propio rol';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_provider_access('a0000000-0000-4000-8000-000000000003','approved',now()+interval '30 days',false);
    raise exception 'FAIL: cliente concedió acceso';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$
begin
  if exists(select 1 from public.move_requests where id='b0000000-0000-4000-8000-000000000001') then raise exception 'FAIL: cliente vio solicitud ajena'; end if;
  if exists(select 1 from public.notifications where request_id='b0000000-0000-4000-8000-000000000001') then raise exception 'FAIL: notificación ajena visible'; end if;
  begin
    perform public.cancel_request('b0000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: cliente canceló solicitud ajena';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$
begin
  if not exists(select 1 from public.move_requests where id='b0000000-0000-4000-8000-000000000001') then raise exception 'FAIL: empresa asignada y activa no ve solicitud'; end if;
  if not exists(select 1 from public.notifications where request_id='b0000000-0000-4000-8000-000000000001') then raise exception 'FAIL: falta notificación privada'; end if;
end;
$$;
reset role;
update public.profiles set plan_expires_at=now()-interval '1 second' where id='a0000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$
begin
  if exists(select 1 from public.move_requests where id='b0000000-0000-4000-8000-000000000001') then raise exception 'FAIL: plan vencido conserva contacto'; end if;
end;
$$;
reset role;

set local role anon;
do $$
begin
  perform public.public_site_config();
  begin
    perform 1 from public.move_requests;
    raise exception 'FAIL: visitante puede leer solicitudes';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;
select 'PASS: RLS, metadatos, vencimiento y aislamiento; sin cambios persistidos.' as result;
