-- Otro inmueble solo en origen. Conserva validaciones y permisos previos.
-- Aplicar después de 001–004; no activa recepción ni crea cuentas.
begin;

create or replace function private.validate_request_payload(p_payload jsonb, p_audience text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  f jsonb; v_fields jsonb := '{}'::jsonb; v_rooms jsonb; v_inventory jsonb;
  k text; v jsonb; n numeric; total numeric := 0; endpoint text;
  allowed_fields text[] := array['origin','destination','routeType','foraneoMode','moveDate','dateFlexibility','distanceKm',
    'originProperty','originPropertyOther','originFloor','originAccess','originElevatorFloors','originCarryRange','originCarryMeters','originShuttle',
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
    if k = 'originPropertyOther' then
      -- Cambiar de opción elimina la descripción anterior, incluso si un cliente
      -- antiguo o manipulado intenta enviar ese campo oculto.
      if coalesce(f->>'originProperty','') <> 'other' then continue; end if;
      if jsonb_typeof(v) <> 'string' then
        raise exception 'Describe el otro tipo de inmueble de origen con texto.' using errcode='22023';
      end if;
      v := to_jsonb(btrim(regexp_replace(regexp_replace(v #>> '{}', E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g'), '[[:space:]]+', ' ', 'g')));
      if char_length(v #>> '{}') not between 1 and 120 then
        raise exception 'Describe el otro tipo de inmueble de origen en un máximo de 120 caracteres.' using errcode='22023';
      end if;
    elsif k in ('privacyConsent','networkConsent','packingAcknowledged') then
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
    if (coalesce(f->>(endpoint || 'Property'),'') not in ('house','apartment','storage','duplex','residential','residentialPlus','office')
        and not (endpoint='origin' and coalesce(f->>'originProperty','')='other'))
      or coalesce(f->>(endpoint || 'Access'),'') not in ('ground','stairs','elevator','combined')
      or coalesce(f->>(endpoint || 'CarryRange'),'') not in ('0-10','11-20','21-30','over30','unknown')
      or coalesce(f->>(endpoint || 'Shuttle'),'') not in ('yes','no','unknown') then raise exception 'Completa el acceso de %.', endpoint using errcode = '22023'; end if;
    if not f ? (endpoint || 'Floor') or not f ? (endpoint || 'ElevatorFloors') then raise exception 'Faltan los niveles de %.', endpoint using errcode = '22023'; end if;
    if (f->>(endpoint || 'ElevatorFloors'))::numeric > (f->>(endpoint || 'Floor'))::numeric then raise exception 'Los pisos con elevador exceden el nivel.' using errcode = '22023'; end if;
  end loop;
  if f->>'originProperty'='other' and char_length(coalesce(v_fields->>'originPropertyOther',''))=0 then
    raise exception 'Describe el otro tipo de inmueble de origen.' using errcode='22023';
  end if;
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

commit;
