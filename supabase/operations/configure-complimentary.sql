-- Ejecutar únicamente en SQL Editor como propietario del proyecto (rol postgres).
-- La cuenta del propietario de Supabase debe tener segundo factor activado.
-- Aplicar primero todas las migraciones. No crea cuentas ni aprueba integrantes.
-- Sustituir SOLO en una copia local privada los UUID verificados de Tere y Marco.
-- No versionar esa copia completada. Los valores vacíos fallan sin cambios.
begin;
do $$
declare
  v_tere_id uuid := null;
  v_marco_id uuid := null;
  v_business uuid;
  v_user uuid;
begin
  if current_user <> 'postgres' then
    raise exception 'Esta operación requiere al propietario de la base de datos.' using errcode='42501';
  end if;
  if v_tere_id is null or v_marco_id is null or v_tere_id=v_marco_id then
    raise exception 'Completa los dos UUID distintos de las cuentas verificadas. No se realizó ningún cambio.';
  end if;
  select id into v_business from public.businesses where slug='d-curiel' and status='approved' for update;
  if v_business is null then raise exception 'El negocio no está aprobado.'; end if;
  foreach v_user in array array[v_tere_id,v_marco_id] loop
    if not exists(select 1 from public.business_memberships bm
      join public.profiles p on p.id=bm.user_id join auth.users u on u.id=p.id
      where bm.business_id=v_business and bm.user_id=v_user and bm.active
        and p.role='provider' and p.provider_status='approved' and p.is_family
        and u.email_confirmed_at is not null) then
      raise exception 'Ambas cuentas deben estar verificadas y aprobadas como integrantes activos de D’Curiel.';
    end if;
  end loop;
  -- Dejar constancia del superusuario responsable, sin simular sesión ni MFA JWT.
  -- Debe existir un único superusuario, creado por el procedimiento de despliegue.
  if (select count(*) from public.profiles p join auth.users u on u.id=p.id
      where p.role='superadmin' and u.email_confirmed_at is not null)<>1 then
    raise exception 'Se requiere un superusuario verificado e inequívoco para registrar la operación.';
  end if;
  foreach v_user in array array[v_tere_id,v_marco_id] loop
    insert into private.provider_complimentary_access(business_id,user_id,enabled,granted_by)
      select v_business,v_user,true,p.id from public.profiles p where p.role='superadmin'
      on conflict(business_id,user_id) do update set enabled=true,granted_by=excluded.granted_by,updated_at=now();
    insert into private.audit_events(action,subject_id,details)
      values('provider_complimentary_access_configured',v_user,jsonb_build_object('business_id',v_business,'enabled',true,'source','owner_sql'));
  end loop;
end;
$$;
commit;

-- No cambia roles, fechas de vigencia, aprobación, cuotas, recepción ni pagos.
-- Para revocar desde una sesión real del superusuario con MFA, usar la RPC
-- set_provider_complimentary_access(p_user_id: UUID, p_enabled: false).
