-- Ejecutar como administrador en TU proyecto Supabase de producción.
-- Cierra nuevas solicitudes incluso para visitantes con una copia antigua de la web.
-- No elimina cuentas, fichas, contratos ni datos existentes.
begin;
update private.platform_settings set accepting_requests = false where singleton;
commit;
select accepting_requests, network_enabled from private.platform_settings where singleton;
