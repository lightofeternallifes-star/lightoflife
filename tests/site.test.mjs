// Static regression tests for the Light of Life website. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const flat = (s) => s.replace(/\s+/g, ' ');
const index = read('index.html');
const terms = flat(read('legal/terms.html'));
const privacy = flat(read('legal/privacy.html'));

const STRIPE = {
  5: 'https://donate.stripe.com/fZu5kw5O5b536ZneEG9Zm04',
  10: 'https://donate.stripe.com/8x214ga4lb532J7bsu9Zm03',
  20: 'https://donate.stripe.com/00w9AM3FXa0ZfvTfIK9Zm05',
  50: 'https://donate.stripe.com/bJe14g6S97SRgzX0NQ9Zm06',
  custom: 'https://donate.stripe.com/bJe00c5O57SRcjHcwy9Zm00',
};

test('all five Stripe links are preserved exactly', () => {
  for (const [k, url] of Object.entries(STRIPE)) {
    assert.ok(index.includes(`${k}: "${url}"`), `missing Stripe link for ${k}`);
  }
  assert.equal((index.match(/https:\/\/donate\.stripe\.com\//g) || []).length, 5);
});

test('modal has an option for each Stripe link', () => {
  for (const v of ['5', '10', '20', '50', 'custom']) {
    assert.match(index, new RegExp(`name="amount" value="${v}"`));
  }
});

test('every translatable element has es and pt', () => {
  const tags = index.match(/<[a-z0-9]+\b(?:"[^"]*"|'[^']*'|[^>"'])*\bdata-es=(?:"[^"]*"|'[^']*'|[^>"'])*>/gi) || [];
  assert.ok(tags.length > 80);
  for (const t of tags) assert.match(t, /\bdata-pt=/, `no data-pt: ${t.slice(0, 80)}`);
  for (const t of index.match(/<img\b[^>]*data-img[^>]*>/g)) {
    assert.match(t, /data-alt-es=/); assert.match(t, /data-alt-pt=/); assert.match(t, /\balt="[^"]+"/);
  }
});

test('screenshots exist for every language', () => {
  const names = [...index.matchAll(/data-img="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(names.length >= 7);
  for (const n of new Set(names)) for (const l of ['en', 'es', 'pt']) {
    assert.ok(existsSync(join(root, `screenshots/${l}/${n}-${l}.png`)), `${l}/${n}`);
  }
});

test('internal links resolve to routes in vercel.json or anchors', () => {
  const v = JSON.parse(read('vercel.json'));
  const routes = v.rewrites.map((r) => r.source);
  for (const m of index.matchAll(/href="(\/[^"#?]*)(?:[#?][^"]*)?"/g)) {
    const p = m[1];
    if (p === '/') continue;
    assert.ok(routes.includes(p), `no route for ${p}`);
  }
  for (const m of index.matchAll(/href="#([^"]+)"/g)) {
    assert.match(index, new RegExp(`id="${m[1]}"`), `missing anchor #${m[1]}`);
  }
});

test('external links open safely', () => {
  for (const t of index.match(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(t, /rel="noopener"/, t);
});

test('legal pages exist for all three languages', () => {
  for (const f of [terms, privacy]) for (const l of ['en', 'es', 'pt']) assert.match(f, new RegExp(`id="lang-${l}"`));
});

test('terms distinguish Stripe (web) from Apple IAP (iOS) in every language', () => {
  const sections = terms.split(/<div class="lang-section/).slice(1);
  assert.equal(sections.length, 3);
  for (const s of sections) {
    assert.match(s, /Stripe/); assert.match(s, /In-App Purchase/); assert.match(s, /reportaproblem\.apple\.com/);
    assert.match(s, /NGO|ONG/);
  }
  const p = privacy.split(/<div class="lang-section/).slice(1);
  for (const s of p) { assert.match(s, /Stripe/); assert.match(s, /In-App Purchase/); }
});

test('site never presents Light of Life as an NGO/charity', () => {
  const all = [index, terms, privacy].join('\n');
  for (const m of all.matchAll(/[^.]*\b(NGO|ONG|charity|nonprofit|non-profit|sin fines de lucro|sem fins lucrativos|benéfica|caridade)\b[^.]*\./gi)) {
    assert.match(m[0], /\bnot\b|\bno\b|\bnão\b|\bNo\b|\bNão\b|Not|No es|Não é|no se|não se|presum|asum|should not|Questions|dedut|deduc/i, `affirmative claim: ${m[0].trim()}`);
  }
});

test('unreleased features are not announced as published', () => {
  assert.match(index, /class="status soon"/);
  assert.doesNotMatch(index, /class="status live"[^>]*>[^<]*(membership|membres|assinatura)/i);
  const road = index.slice(index.indexOf('id="roadmap"'), index.indexOf('<!-- YOUTUBE -->'));
  assert.match(road, /not active yet|Aún no está activa|Ainda não está ativa/);
});

test('modal states refund policy and is accessible', () => {
  assert.match(index, /<dialog id="donationModal"[^>]*aria-labelledby/);
  assert.match(index, /Refunds\./); assert.match(index, /Reembolsos\./);
  assert.doesNotMatch(index, /alert\(|console\.log|prompt\(/);
});

test('page accessibility basics', () => {
  assert.match(index, /<html lang="en">/);
  assert.match(index, /class="skip-link"/);
  assert.equal((index.match(/<h1\b/g) || []).length, 1);
  assert.match(index, /prefers-reduced-motion/);
  assert.match(index, /<meta name="viewport"/);
});
