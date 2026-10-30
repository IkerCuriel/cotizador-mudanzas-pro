-- Plantilla para el propietario, en SQL Editor con rol postgres.
-- No es una pantalla pública, no crea usuarios Auth y no habilita recepción.
-- Aplicar migraciones 001–004 antes. Revisar identidad y consentimiento del negocio.
-- Para D’Curiel basta el panel actual: aprobar cuentas y marcar equipo familiar.
-- Para otro negocio, completar las cuatro variables VACÍAS y el correo de una
-- cuenta real ya invitada, aprobada y con vigencia. Ejecutar una vez por integrante.
-- Nunca incorporar correos privados o secretos al archivo versionado.
begin;
do $$
declare
  v_slug text := '';
  v_name text := '';
  v_whatsapp text := ''; -- Lada de país + número, solo dígitos.
  v_member_email text := '';
  v_business uuid;
  v_member uuid;
begin
  if v_slug='' or v_name='' or v_whatsapp='' or v_member_email='' then
    raise exception 'Completa negocio, contacto y correo del integrante antes de ejecutar. No se realizó ningún cambio.';
  end if;
  if v_slug='d-curiel' then
    raise exception 'D’Curiel ya existe. Administra sus integrantes con la opción equipo familiar del panel.';
  end if;
  select p.id into v_member from public.profiles p join auth.users u on u.id=p.id
    where lower(u.email)=lower(v_member_email) and u.email_confirmed_at is not null
      and p.role='provider' and p.provider_status='approved' and p.plan_expires_at>now();
  if v_member is null then
    raise exception 'La cuenta no existe, no confirmó correo o no tiene acceso de proveedor vigente.';
  end if;
  insert into public.businesses(slug,name,whatsapp,status)
    values(v_slug,v_name,v_whatsapp,'approved') on conflict(slug) do nothing;
  select id into v_business from public.businesses where slug=v_slug;
  -- Un slug existente no cambia su identidad/contacto silenciosamente.
  if not exists(select 1 from public.businesses where id=v_business and name=v_name and whatsapp=v_whatsapp and status='approved') then
    raise exception 'El negocio existente tiene otros datos o estado. Revísalo antes de asignar integrantes.';
  end if;
  insert into public.business_memberships(business_id,user_id,member_role,active)
    values(v_business,v_member,'member',true)
    on conflict(business_id,user_id) do update set active=true;
  insert into private.audit_events(action,subject_id,details)
    values('business_member_configured',v_member,jsonb_build_object('business_id',v_business,'source','owner_sql'));
end;
$$;
commit;

-- Revisar por separado los límites de costo y la recepción global; este archivo
-- no toca private.platform_settings.accepting_requests ni activa canales de pago.
