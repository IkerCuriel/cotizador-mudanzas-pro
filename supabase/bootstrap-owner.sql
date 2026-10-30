-- Ejecutar UNA VEZ en SQL Editor como postgres, después de registrarte y confirmar el correo.
-- 1. En Authentication > Users, comprueba tu cuenta y copia su UUID.
-- 2. Sustituye SOLO el UUID de abajo. El correo nunca concede permisos automáticamente.
-- 3. Esta operación deliberadamente no puede llamarse desde la web.
begin;
do $$
declare owner_uuid uuid := '00000000-0000-0000-0000-000000000000';
begin
  if owner_uuid = '00000000-0000-0000-0000-000000000000' then raise exception 'Sustituye el UUID por el de tu cuenta verificada.'; end if;
  if exists(select 1 from public.profiles where role = 'superadmin') then raise exception 'Ya existe un superusuario. Revisa la operación manualmente.'; end if;
  if not exists(select 1 from auth.users where id = owner_uuid and email_confirmed_at is not null) then raise exception 'La cuenta debe existir y tener el correo confirmado.'; end if;
  update public.profiles set role = 'superadmin', is_family = false, provider_status = 'pending', plan_expires_at = null where id = owner_uuid;
  if not found then raise exception 'No existe el perfil de esa cuenta.'; end if;
  insert into private.audit_events(actor_id,action,subject_id) values(owner_uuid,'superadmin_bootstrapped',owner_uuid);
end;
$$;
commit;
