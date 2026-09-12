import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const assistant = await readFile(new URL('../netlify/functions/assistant.mjs', import.meta.url), 'utf8');

test('dashboard requires the approved verified owner identity', () => {
  assert.match(html, /firebase-auth-compat\.js/);
  assert.match(html, /user\.emailVerified/);
  assert.match(html, /AUTHORIZED_OWNER_EMAILS\.includes\(user\.email\.toLowerCase\(\)\)/);
  assert.match(html, /'erikmgmi@gmail\.com'/);
  assert.match(html, /'info@handgraafestates\.com'/);
  assert.match(html, /'brianucsd@gmail\.com'/);
  assert.match(html, /new firebase\.auth\.GoogleAuthProvider\(\)/);
  assert.match(html, /auth\.signInWithPopup\(provider\)/);
  assert.doesNotMatch(html, /sendSignInLinkToEmail|signInWithEmailLink/);
  assert.match(html, /id="app-shell" hidden/);
  assert.doesNotMatch(html, /entries added by anyone with the link are visible to everyone/);
});

test('Firestore grants only the verified owner access to household records', () => {
  assert.match(rules, /request\.auth != null/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /request\.auth\.token\.email in \[/);
  assert.match(rules, /'erikmgmi@gmail\.com'/);
  assert.match(rules, /'info@handgraafestates\.com'/);
  assert.match(rules, /'brianucsd@gmail\.com'/);
  assert.match(rules, /match \/household-ops\/\{recordId\}/);
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false/);
});

test('assistant remains disabled before any provider call', () => {
  assert.match(assistant, /status|410/);
  assert.doesNotMatch(assistant, /OPENAI_API_KEY|fetch\(/);
});

test('dollar amounts use finNum, not raw Number()/parseFloat() on comma-formatted strings', () => {
  // A price/cost/estimate like "1,180" silently breaks under plain
  // Number()/parseFloat() (Number -> NaN, parseFloat -> 1) since neither
  // strips the thousands comma. finNum() does. Every one of these display
  // sites must go through it, or a value >= $1,000 renders wrong again.
  assert.match(html, /function finNum\(/);
  assert.doesNotMatch(html, /Number\(e\.estimate\)/);
  assert.doesNotMatch(html, /Number\(e\.cost\)/);
  assert.doesNotMatch(html, /Number\(r\.price/);
  assert.doesNotMatch(html, /parseFloat\(r\.price\)/);
  assert.match(html, /finNum\(e\.estimate\)/);
  assert.match(html, /finNum\(e\.cost\)/);
  assert.match(html, /finNum\(r\.price\)/);
});
