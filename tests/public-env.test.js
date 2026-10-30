import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicEnvironment } from '../scripts/public-env.mjs';

test('credentials mistakenly prefixed VITE cannot become public build configuration', () => {
  for (const name of ['VITE_SERVICE_ROLE_KEY', 'VITE_STRIPE_SECRET_KEY', 'VITE_DATABASE_PASSWORD', 'VITE_SMTP_PASSWORD', 'VITE_NEW_UNREVIEWED_KEY']) {
    assert.throws(() => assertPublicEnvironment({ [name]: 'sensitive-canary-value' }), (error) => {
      assert.ok(!error.message.includes('sensitive-canary-value'));
      return /variables públicas/.test(error.message);
    });
  }
});

test('public configuration and server-only environment names coexist without exposure', () => {
  assert.doesNotThrow(() => assertPublicEnvironment({
    VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_example',
    VITE_PRIVACY_READY: 'false', VITE_SITE_URL: 'https://example.com',
    GITHUB_TOKEN: 'server-only-canary', CF_PAGES_URL: 'https://example.pages.dev',
  }));
});
