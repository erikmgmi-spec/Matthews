import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const assistant = await readFile(new URL('../netlify/functions/assistant.mjs', import.meta.url), 'utf8');

test('dashboard requires the approved verified owner identity', () => {
  assert.match(html, /firebase-auth-compat\.js/);
  assert.match(html, /user\.emailVerified/);
  assert.match(html, /user\.email\.toLowerCase\(\) === AUTHORIZED_OWNER_EMAIL/);
  assert.match(html, /const AUTHORIZED_OWNER_EMAIL = 'erikmgmi@gmail\.com'/);
  assert.match(html, /new firebase\.auth\.GoogleAuthProvider\(\)/);
  assert.match(html, /auth\.signInWithPopup\(provider\)/);
  assert.doesNotMatch(html, /sendSignInLinkToEmail|signInWithEmailLink/);
  assert.match(html, /id="app-shell" hidden/);
  assert.doesNotMatch(html, /entries added by anyone with the link are visible to everyone/);
});

test('Firestore grants only the verified owner access to household records', () => {
  assert.match(rules, /request\.auth != null/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /request\.auth\.token\.email == 'erikmgmi@gmail\.com'/);
  assert.match(rules, /match \/household-ops\/\{recordId\}/);
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false/);
});

test('assistant remains disabled before any provider call', () => {
  assert.match(assistant, /status|410/);
  assert.doesNotMatch(assistant, /OPENAI_API_KEY|fetch\(/);
});
