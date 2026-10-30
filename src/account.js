import './styles.css';
import './account.css';
import { supabase, isCloudConfigured, getSession, getProfile, safeReturnUrl, cloudErrorMessage } from './cloud.js';
import { BUSINESS, buildWhatsAppUrl } from './config.js';
import { LEGAL, LEGAL_READY } from './legal-config.js';

const params = new URLSearchParams(location.search);
const returnUrl = safeReturnUrl(params.get('next'));
const recoveryFromUrl = params.get('mode') === 'recovery' || new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
const intentKey = 'moveflow-account-interest';
const providerLanding = location.hash === '#proveedor';
let recoveryMode = recoveryFromUrl;
let session = null;
let profile = null;
let busy = false;
let navigating = false;
let accountGeneration = 0;
let activeUserId = null;

const byId = (id) => document.getElementById(id);
function show(id, visible) { byId(id).hidden = !visible; }
function notify(message = '', error = false) {
  const element = byId('account-feedback');
  element.textContent = message;
  element.classList.toggle('cloud-feedback--error', error);
  element.hidden = !message;
}
function setBusy(form, value) {
  busy = value;
  form.querySelectorAll('button').forEach((button) => { button.disabled = value; });
  form.setAttribute('aria-busy', String(value));
}
function saveIntent(interest, company = '') {
  try { sessionStorage.setItem(intentKey, JSON.stringify({ interest, company })); } catch { /* Preference can be entered again. */ }
}
function getIntent() {
  try { return JSON.parse(sessionStorage.getItem(intentKey) || '{}'); } catch { return {}; }
}
function clearIntent() { try { sessionStorage.removeItem(intentKey); } catch { /* No state to clear. */ } }
function setView(view, clearFeedback = true) {
  if (!['login', 'register', 'recover'].includes(view)) view = 'login';
  if (clearFeedback) notify();
  show('account-auth', true);
  show('account-session', false);
  show('provider-onboarding', false);
  show('update-password-form', false);
  for (const name of ['login', 'register', 'recover']) show(`${name}-form`, name === view);
  byId('account-title').textContent = view === 'register' ? 'Haz espacio para lo que viene.' : view === 'recover' ? 'Recupera tu acceso.' : 'Qué gusto verte por aquí.';
  byId('account-intro').textContent = view === 'register' ? 'Crea tu cuenta y confirma tu correo para empezar.' : view === 'recover' ? 'Volver a entrar empieza con tu correo.' : 'Entra para consultar tus solicitudes.';
  document.querySelectorAll('.account-tabs button').forEach((button) => {
    const active = button.dataset.accountView === view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function hideAccountSections() {
  ['account-auth', 'account-session', 'provider-onboarding', 'update-password-form'].forEach((id) => show(id, false));
}
function showPasswordForm() {
  hideAccountSections();
  show('update-password-form', true);
}
function renderSession() {
  hideAccountSections();
  if (recoveryMode) { showPasswordForm(); return; }
  const intent = getIntent();
  const providerInterest = intent.interest === 'provider' || session?.user.user_metadata?.interest === 'provider';
  if (profile?.role === 'applicant' && providerInterest) {
    show('provider-onboarding', true);
    byId('provider-onboarding').elements.company_name.value = intent.company || profile.company_name || session.user.user_metadata?.company_name || '';
    return;
  }
  show('account-session', true);
  byId('session-name').textContent = `Hola, ${profile?.display_name || 'bienvenido'}.`;
  byId('session-email').textContent = session?.user.email || '';
  byId('continue-account').href = returnUrl;
}
async function loadSession(redirect = false) {
  const generation = ++accountGeneration;
  const currentSession = await getSession();
  if (generation !== accountGeneration) return;
  if (activeUserId && currentSession && activeUserId !== currentSession.user.id) {
    accountGeneration += 1;
    session = null; profile = null;
    setTimeout(() => loadSession(false).catch((error) => notify(cloudErrorMessage(error), true)), 0);
    return;
  }
  session = currentSession;
  activeUserId = session?.user.id || null;
  show('account-loading', false);
  if (!session) {
    recoveryMode = false;
    setView(params.get('mode') === 'register' || providerLanding ? 'register' : 'login', false);
    return;
  }
  const currentProfile = await getProfile(session);
  if (generation !== accountGeneration) return;
  profile = currentProfile;
  // Registration metadata is only a convenience for editable contact fields.
  // Roles and provider access always come from the protected profile row.
  if (!profile.display_name && session.user.user_metadata?.display_name) {
    const metadata = session.user.user_metadata;
    const { error } = await supabase.from('profiles').update({
      display_name: String(metadata.display_name).trim().slice(0, 100),
      phone: String(metadata.phone || '').trim().slice(0, 40),
      company_name: String(metadata.company_name || '').trim().slice(0, 120),
    }).eq('id', session.user.id).select('id').single();
    if (error) throw error;
    if (generation !== accountGeneration) return;
    const updatedProfile = await getProfile(session);
    if (generation !== accountGeneration) return;
    profile = updatedProfile;
  }
  renderSession();
  const needsProviderOnboarding = !byId('provider-onboarding').hidden;
  if (redirect && !recoveryMode && !needsProviderOnboarding && !navigating) {
    navigating = true;
    location.assign(returnUrl);
  }
}
async function submit(form, action) {
  if (busy || !form.reportValidity()) return;
  notify();
  setBusy(form, true);
  try { await action(new FormData(form)); }
  catch (error) { notify(cloudErrorMessage(error), true); }
  finally { setBusy(form, false); }
}
function matchingPasswords(data) {
  const password = String(data.get('password') || '');
  if (password !== data.get('password_repeat')) throw new Error('Las contraseñas no coinciden. Revisa ambos campos.');
  if (password.length < 12 || password.length > 128) throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
  return password;
}
function localRedirect(mode) {
  const url = new URL('cuenta.html', new URL('./', location.href));
  url.searchParams.set('mode', mode);
  url.searchParams.set('next', returnUrl);
  return url.href;
}

document.querySelectorAll('[data-account-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.accountView)));
byId('account-interest').addEventListener('change', (event) => {
  const provider = event.target.value === 'provider';
  show('signup-company-field', provider);
  show('provider-signup-note', provider);
  byId('signup-company').required = provider;
});

byId('login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  submit(event.target, async (data) => {
    const { error } = await supabase.auth.signInWithPassword({ email: String(data.get('email')).trim(), password: String(data.get('password')) });
    if (error) throw error;
    await loadSession(true);
  });
});

byId('register-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!LEGAL_READY) { notify('El registro abrirá cuando esté lista la información de privacidad.', true); return; }
  submit(event.target, async (data) => {
    const password = matchingPasswords(data);
    const interest = data.get('interest') === 'provider' ? 'provider' : 'applicant';
    const company = String(data.get('company_name') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    if (!/^\+?[\d\s()-]{10,40}$/.test(phone) || phone.replace(/\D/g, '').length < 10) throw new Error('Escribe un teléfono de contacto válido, con lada.');
    if (!String(data.get('display_name')).trim()) throw new Error('Escribe tu nombre para crear la cuenta.');
    if (interest === 'provider' && company.length < 2) throw new Error('Escribe el nombre de tu negocio para solicitar acceso.');
    saveIntent(interest, company);
    const { data: result, error } = await supabase.auth.signUp({
      email: String(data.get('email')).trim(), password,
      options: { emailRedirectTo: localRedirect('confirmed'), data: {
        display_name: String(data.get('display_name')).trim(), phone,
        interest, company_name: company, privacy_accepted: data.get('accountConsent') === 'on', privacy_version: LEGAL.version,
      } },
    });
    if (error) throw error;
    event.target.elements.password.value = '';
    event.target.elements.password_repeat.value = '';
    if (result.session) { await loadSession(false); notify('Cuenta creada. Continúa para revisar tu acceso.'); }
    else {
      setView('login', false);
      byId('login-form').elements.email.value = String(data.get('email')).trim();
      notify('Revisa tu correo para confirmar el registro. Si ya tenías una cuenta, puedes entrar o recuperar tu contraseña. El enlace puede tardar unos minutos.');
    }
  });
});

byId('recover-form').addEventListener('submit', (event) => {
  event.preventDefault();
  submit(event.target, async (data) => {
    const { error } = await supabase.auth.resetPasswordForEmail(String(data.get('email')).trim(), { redirectTo: localRedirect('recovery') });
    if (error) throw error;
    notify('Si ese correo tiene una cuenta, recibirás un enlace para cambiar la contraseña. Revisa también el correo no deseado.');
  });
});

byId('update-password-form').addEventListener('submit', (event) => {
  event.preventDefault();
  submit(event.target, async (data) => {
    const password = matchingPasswords(data);
    if (!await getSession()) throw new Error('Tu sesión terminó. Solicita otro enlace para recuperar el acceso.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    recoveryMode = false;
    event.target.reset();
    history.replaceState(null, '', new URL('cuenta.html', location.href).pathname);
    await loadSession(false);
    notify('Contraseña actualizada. Ya puedes continuar a tu cuenta.');
  });
});

byId('provider-onboarding').addEventListener('submit', (event) => {
  event.preventDefault();
  submit(event.target, async (data) => {
    const { error } = await supabase.rpc('join_provider', { p_company_name: String(data.get('company_name')).trim() });
    if (error) throw error;
    clearIntent();
    profile = await getProfile(session);
    renderSession();
    notify('Solicitud de acceso registrada. Podrás recibir mudanzas cuando el negocio sea aprobado y tenga un plan vigente.');
  });
});

byId('account-signout').addEventListener('click', async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    session = null;
    profile = null;
    recoveryMode = false;
    setView('login');
    notify('Sesión cerrada.');
  } catch (error) { notify(cloudErrorMessage(error), true); }
});

byId('unavailable-whatsapp').href = buildWhatsAppUrl('Hola, quisiera información sobre el servicio de mudanzas.', BUSINESS.whatsapp);
byId('register-fields').disabled = !LEGAL_READY;
show('registration-pending', !LEGAL_READY);
if (providerLanding) {
  byId('account-interest').value = 'provider';
  byId('account-interest').dispatchEvent(new Event('change'));
  saveIntent('provider');
}

if (!isCloudConfigured) {
  show('account-loading', false);
  show('cloud-unavailable', true);
} else {
  supabase.auth.onAuthStateChange((event, nextSession) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryMode = true;
      setTimeout(() => loadSession(false).catch((error) => notify(cloudErrorMessage(error), true)), 0);
    }
    if (event === 'SIGNED_OUT') { accountGeneration += 1; activeUserId = null; session = null; profile = null; recoveryMode = false; byId('session-name').textContent = ''; byId('session-email').textContent = ''; setView('login', false); }
    if (event === 'SIGNED_IN' && nextSession?.user.id) {
      if (activeUserId && nextSession.user.id !== activeUserId) {
        accountGeneration += 1; activeUserId = nextSession.user.id; session = null; profile = null; recoveryMode = false;
        byId('session-name').textContent = ''; byId('session-email').textContent = '';
        hideAccountSections(); show('account-loading', true);
        setTimeout(() => loadSession(false).catch((error) => notify(cloudErrorMessage(error), true)), 0);
      } else activeUserId = nextSession.user.id;
    }
  });
  loadSession(false).catch((error) => {
    show('account-loading', false);
    setView('login', false);
    notify(cloudErrorMessage(error, 'No pudimos cargar tu cuenta. Vuelve a entrar o inténtalo más tarde.'), true);
  });
}
