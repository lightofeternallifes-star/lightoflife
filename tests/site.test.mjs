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
    assert.ok(routes.includes(p) || existsSync(join(root, p)) || /^\/[a-z]+-\d+-\d+$/.test(p), `no route for ${p}`);
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

test('brand: no version numbers shown as part of the name', () => {
  for (const f of [index, terms, privacy]) assert.doesNotMatch(f, /Light of Life\s*(V|v)\d|\bV[34]\b/);
});

test('Open Graph image exists and is referenced', () => {
  assert.match(index, /og:image" content="https:\/\/www\.lightoflife\.app\/og-image\.png"/);
  assert.ok(existsSync(join(root, 'og-image.png')));
  assert.ok(existsSync(join(root, 'favicon.svg')));
  assert.doesNotMatch(index, /lightoflife\.app\/icon\.png/);
});

test("Today's verse links to a deep-link slug, not the dead /verse/ path", () => {
  assert.doesNotMatch(index, /\/verse\/john/);
  assert.equal((index.match(/href="\/john-3-16"/g) || []).length, 2);
});

test('deep-link handler is invoked for non-root paths and only redirects on mobile', () => {
  assert.match(index, /pathname !== "\/"\) \{ openApp\(\); \}/);
  assert.match(index, /iPhone\|iPad\|iPod\|Android/);
});

test('Coming soon: evidence-backed items only, no dates/prices/version numbers, 3 languages', () => {
  const road = index.slice(index.indexOf('id="roadmap"'), index.indexOf('<!-- YOUTUBE -->'));
  assert.equal((road.match(/<article class="card">/g) || []).length, 3);
  assert.equal((road.match(/class="status soon"/g) || []).length, 3);
  assert.doesNotMatch(road, /\$\s?\d|USD|€|\b(20\d\d|Q[1-4])\b|\b(January|February|March|April|June|July|August|September|October|November|December|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|janeiro|fevereiro|março|maio|junho|julho|setembro|outubro|novembro|dezembro)\b/i);
  assert.doesNotMatch(road, /\bV[0-9]\b|build\s*\d|\b220\b|\b330\b/i);
  assert.doesNotMatch(road, /already available|ya está disponible|já está disponível|now available/i);
  assert.match(road, /no release dates or prices|no hay fechas de lanzamiento ni precios|não há datas de lançamento nem preços/i);
  // items already shipped must not be presented as upcoming
  assert.doesNotMatch(road, /Biblical Reflection|Reflexión Bíblica|Bible navigation|navegación bíblica/i);
});

test('legal URLs cited by the iOS app (/legal/terms, /legal/privacy) resolve to real pages', () => {
  const v = JSON.parse(read('vercel.json'));
  const map = Object.fromEntries(v.rewrites.map((r) => [r.source, r.destination]));
  for (const n of ['privacy', 'terms', 'delete-account']) {
    for (const src of [`/${n}`, `/legal/${n}`]) {
      assert.equal(map[src], `/legal/${n}.html`, src);
      assert.ok(existsSync(join(root, `legal/${n}.html`)));
    }
  }
  // specific legal rewrites must come before the /legal/:path* passthrough and the catch-all
  const order = v.rewrites.map((r) => r.source);
  assert.ok(order.indexOf('/legal/terms') < order.indexOf('/legal/:path*'));
  assert.equal(order.at(-1), '/(.*)');
});

test('official name is exactly "Light of Life" (no "Light of Life App" / versions in user-facing strings)', () => {
  assert.doesNotMatch(index, /Light of Life App|Aplicación Light of Life|App Light of Life/);
  assert.doesNotMatch(index, /Light of Life\s+(V|v)\d/);
});

test('anchor targets clear the sticky header (scroll-padding + measured header height)', () => {
  assert.match(index, /scroll-padding-top:\s*var\(--header-h\)/);
  assert.match(index, /--header-h", header\.offsetHeight/);
});
