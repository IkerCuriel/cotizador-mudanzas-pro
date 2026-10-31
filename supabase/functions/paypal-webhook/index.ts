import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { configuration } from '../paypal-checkout/core.js';
import { webhookHandler } from './handler.js';
const env=Deno.env.toObject();
Deno.serve(async request=>{
  if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return new Response('Unavailable',{status:503});
  return webhookHandler({config:configuration(env),service:createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})})(request);
});
