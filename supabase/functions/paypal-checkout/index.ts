import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { configuration } from './core.js';
import { checkoutHandler } from './handler.js';

// JWT is checked with Auth and again in each user RPC. Deploy --no-verify-jwt
// only because the gateway does not validate newer asymmetric Supabase tokens.
const env=Deno.env.toObject();
const config=configuration(env);
Deno.serve(async request=>{
  if(!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY)return Response.json({error:'Cuentas pendientes de conexión.'},{status:503,headers:{'Cache-Control':'no-store'}});
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  return checkoutHandler({config,
    authenticatedClient:(authorization:string)=>createClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,{...options,global:{headers:{Authorization:authorization}}}),
    service:createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options),
  })(request);
});
