const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'widget/widget.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'streamelements/loader.html'), 'utf8');
const bootstrap = loader.match(/<script>([\s\S]*?)<\/script>/)[1];
const fields = JSON.parse(fs.readFileSync(path.join(root, 'streamelements/fields.json'), 'utf8'));
const realCards = JSON.parse(fs.readFileSync(path.join(root, 'data/cardsData.json'), 'utf8'));
const cards = realCards.slice(0, 3);
const clone = value => JSON.parse(JSON.stringify(value));
async function settle() { for (let i = 0; i < 30; i++) await Promise.resolve(); }

function hub() {
  return {
    saved: null, writes: [], clients: [],
    api() {
      const self = this;
      return { store: {
        get: async key => { assert.equal(key, 'smashorpassv3'); return clone(self.saved); },
        set: (key, state) => {
          assert.equal(key, 'smashorpassv3');
          self.saved = clone(state);
          self.writes.push(clone(state));
          self.clients.forEach(client => client.event('kvstore:update', { data: { key: 'customWidget.' + key, value: clone(state) } }));
          return Promise.resolve();
        }
      } };
    }
  };
}

function runtime(t, options = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="sop-loader-status">Loading</div></body></html>', {
    url: 'https://streamelements.com/peachies-test', runScripts: 'outside-only'
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  const store = options.store || hub();
  const timers = new Map();
  let now = 1000000, timerId = 0;
  w.Date.now = () => now;
  w.setTimeout = (fn, delay = 0) => { timers.set(++timerId, { fn, at: now + delay }); return timerId; };
  w.clearTimeout = id => timers.delete(id);
  w.requestAnimationFrame = fn => w.setTimeout(fn, 0);
  w.AbortController = AbortController;
  w.CSS = { supports: (kind, value) => kind === 'color' && /^#[a-f\d]{6}$/i.test(value) };
  const calls = [];
  w.fetch = async (url, config) => {
    calls.push({ url, config });
    if (options.offline) throw new Error('Network unavailable');
    if (options.waitForFetch) return options.waitForFetch;
    return { ok: true, json: async () => clone(options.cards || cards) };
  };
  if (!options.noStore) w.SE_API = store.api();
  if (options.cache) w.localStorage.setItem('peachies-cards:https://gawiene.github.io/smash-or-pass-peachies/data/cardsData.json', JSON.stringify(options.cache));
  const api = {
    w, store, calls,
    text: id => w.document.getElementById(id).textContent,
    element: id => w.document.getElementById(id),
    event(listener, event) { w.dispatchEvent(new w.CustomEvent('onEventReceived', { detail: { listener, event } })); },
    load(values = {}) {
      const defaults = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value]));
      w.dispatchEvent(new w.CustomEvent('onWidgetLoad', { detail: { fieldData: { ...defaults, deckOrder: 'normal', ...values } } }));
    },
    chat(text, id = 'viewer-1', broadcaster = false) {
      api.event('message', { data: { text, userId: id, displayName: id, msgId: id + '-' + now, badges: broadcaster ? [{ type: 'broadcaster' }] : [] } });
    },
    button(field, listener = 'widget-button') { api.event(listener, { field, value: fields[field].value }); },
    execute() { w.eval(code); },
    async advance(duration) {
      const target = now + duration;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
        await settle();
      }
      now = target;
      await settle();
    }
  };
  store.clients.push(api);
  w.eval(bootstrap);
  if (!options.deferScript) api.execute();
  return api;
}

test('loader captures early load/chat events, injects HTML and uses hosted JSON instead of fieldData', async t => {
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  const r = runtime(t, { deferScript: true, waitForFetch: deferred });
  r.load({ cardsData: [{ name: 'Wrong', image: 'https://example.com/wrong.webp' }], widgetSmashColor: '#123456', showDebug: true });
  r.chat('smash');
  r.execute();
  await settle();
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].url, 'https://gawiene.github.io/smash-or-pass-peachies/data/cardsData.json');
  assert.equal(r.calls[0].config.credentials, 'omit');
  assert.equal(r.calls[0].config.referrerPolicy, 'no-referrer');
  release({ ok: true, json: async () => clone(cards) });
  await settle();
  assert.equal(r.text('characterName'), 'Joe');
  assert.equal(r.text('cardProgress'), '1 / 3');
  assert.equal(r.text('voteCount'), '1');
  assert.equal(r.w.document.querySelector('.sop-widget').style.getPropertyValue('--widget-smash'), '#123456');
  assert.equal(r.element('debugPanel').classList.contains('hidden'), false);
  assert.equal(r.w.document.getElementById('sop-loader-status'), null);
  r.execute();
  assert.equal(r.w.document.querySelectorAll('#sopPeachiesRoot').length, 1);
});

test('viewers use whole smash/pass messages with one changeable vote per viewer', async t => {
  const r = runtime(t); r.load(); await settle();
  ['smash please', 'passage', '!smash', '!pass'].forEach(message => r.chat(message));
  assert.equal(r.text('voteCount'), '0');
  r.chat('smash'); r.chat('smash');
  assert.equal(r.text('voteCount'), '1');
  assert.equal(r.text('smashPercent'), '100');
  r.chat('pass');
  assert.equal(r.text('voteCount'), '1');
  assert.equal(r.text('passPercent'), '100');
  r.chat('smash', 'viewer-2');
  assert.equal(r.text('voteCount'), '2');
  assert.equal(r.text('smashPercent'), '50');
  await r.advance(150);
  assert.deepEqual(r.store.saved.viewerVotes, { 'viewer-1': 'pass', 'viewer-2': 'smash' });
});

test('broadcaster decisions retain result, swipe timing, automatic next card and final recap', async t => {
  const r = runtime(t); r.load(); await settle();
  r.chat('smash');
  r.chat('!pass', 'streamer', true);
  assert.equal(r.text('resultStreamer'), '✕ PASS');
  assert.match(r.text('resultChat'), /100% SMASH/);
  r.chat('pass', 'late-viewer');
  assert.equal(r.text('voteCount'), '1');
  await r.advance(899);
  assert.equal(r.element('card').classList.contains('swipe-pass'), false);
  await r.advance(1);
  assert.equal(r.element('card').classList.contains('swipe-pass'), true);
  await r.advance(750);
  assert.equal(r.text('cardProgress'), '2 / 3');
  assert.equal(r.text('voteCount'), '0');
  r.chat('!smash', 'streamer', true); await r.advance(1650);
  assert.equal(r.text('cardProgress'), '3 / 3');
  r.chat('pass'); r.chat('!pass', 'streamer', true); await r.advance(1650);
  assert.equal(r.element('summaryScreen').classList.contains('visible'), true);
  assert.equal(r.text('streamerSmashCount'), '1');
  assert.equal(r.text('streamerPassCount'), '2');
  assert.equal(r.text('chatSmashCount'), '1');
  assert.equal(r.text('chatPassCount'), '1');
  assert.equal(r.text('chatNoVoteCount'), '1');
  assert.equal(r.store.saved.gameFinished, true);
});

test('existing test buttons, both SE event types, navigation and reset remain available', async t => {
  const r = runtime(t); r.load(); await settle();
  r.button('testViewer1Smash'); r.button('testViewer1Smash');
  r.button('testViewer1Pass', 'event:test'); r.button('testViewer2Smash'); r.button('testViewer3Pass');
  assert.equal(r.text('voteCount'), '3');
  assert.equal(r.text('passPercent'), '67');
  r.button('streamerSmash'); await r.advance(1650);
  assert.equal(r.text('cardProgress'), '2 / 3');
  r.button('nextCard'); assert.equal(r.text('cardProgress'), '3 / 3');
  r.button('resetDeck'); assert.equal(r.text('cardProgress'), '1 / 3');
  assert.equal(r.text('voteCount'), '0');
  assert.deepEqual(r.store.saved.gameResults, []);
  assert.equal(r.store.saved.seed, 2);
});

test('SE_API.store keeps version/key/payload and synchronizes editor, OBS and reload', async t => {
  const store = hub();
  const editor = runtime(t, { store }); editor.load(); await settle();
  const obs = runtime(t, { store }); obs.load(); await settle();
  assert.equal(obs.text('characterName'), 'Joe');
  editor.chat('smash'); await editor.advance(150);
  assert.equal(obs.text('voteCount'), '1');
  editor.button('streamerPass');
  assert.equal(obs.text('resultStreamer'), '✕ PASS');
  await editor.advance(1650); await obs.advance(1650);
  assert.equal(obs.text('characterName'), editor.text('characterName'));
  assert.equal(obs.text('cardProgress'), '2 / 3');
  const reload = runtime(t, { store }); reload.load(); await settle();
  assert.equal(reload.text('characterName'), 'Famous Kapands');
  assert.equal(store.saved.version, 3);
  assert.deepEqual(Object.keys(store.saved).sort(), ['version', 'deckSignature', 'deckOrder', 'seed', 'currentIndex', 'viewerVotes', 'gameResults', 'gameFinished', 'revision', 'action', 'updatedAt'].sort());
  assert.equal(store.saved.gameResults.length, 1);
  obs.event('kvstore:update', { data: { key: 'customWidget.another-widget', value: { ...store.saved, currentIndex: 2 } } });
  assert.equal(obs.text('cardProgress'), '2 / 3');
});

test('random order and reset on the first card stay identical between instances', async t => {
  const store = hub();
  const editor = runtime(t, { store, cards: realCards }); editor.load({ deckOrder: 'random' }); await settle();
  const obs = runtime(t, { store, cards: realCards }); obs.load({ deckOrder: 'random' }); await settle();
  const first = editor.text('characterName');
  assert.equal(obs.text('characterName'), first);
  editor.button('resetDeck');
  assert.equal(obs.text('characterName'), editor.text('characterName'));
  assert.notEqual(editor.text('characterName'), first);
  editor.button('nextCard');
  assert.equal(obs.text('characterName'), editor.text('characterName'));
  assert.equal(obs.text('cardProgress'), '2 / 64');
});

test('a failed JSON request uses a validated local cache and reports fallback', async t => {
  const r = runtime(t, { offline: true, cache: cards }); r.load(); await settle();
  assert.equal(r.text('characterName'), 'Joe');
  assert.match(r.text('sopLoadStatus'), /dernière version mémorisée/);
  assert.equal(r.element('sopLoadStatus').hidden, false);
});

test('reset during a decision cancels stale swipes and progression in both instances', async t => {
  const store = hub();
  const editor = runtime(t, { store }); editor.load(); await settle();
  const obs = runtime(t, { store }); obs.load(); await settle();
  editor.button('streamerSmash');
  editor.button('resetDeck');
  await editor.advance(2000); await obs.advance(2000);
  for (const r of [editor, obs]) {
    assert.equal(r.text('cardProgress'), '1 / 3');
    assert.equal(r.element('card').classList.contains('swipe-smash'), false);
    assert.equal(r.element('summaryScreen').classList.contains('visible'), false);
    assert.equal(r.element('result').classList.contains('visible'), false);
  }
  assert.deepEqual(store.saved.gameResults, []);
});

test('failed JSON without cache never writes a fake deck and offers a working retry', async t => {
  const r = runtime(t, { offline: true }); r.load(); await settle();
  assert.match(r.text('sopLoadStatus'), /Deck indisponible/);
  assert.equal(r.store.writes.length, 0);
  assert.equal(r.element('gameScreen').classList.contains('hidden'), true);
  r.w.fetch = async () => ({ ok: true, json: async () => clone(cards) });
  r.element('sopLoadStatus').querySelector('button').click(); await settle();
  assert.equal(r.text('characterName'), 'Joe');
  assert.equal(r.element('gameScreen').classList.contains('hidden'), false);
});

test('no store or cache access still allows the game to load without private tokens', async t => {
  const r = runtime(t, { noStore: true });
  Object.defineProperty(r.w, 'localStorage', { get() { throw new Error('Storage denied'); } });
  r.load(); await settle();
  assert.equal(r.text('characterName'), 'Joe');
  r.chat('smash'); await r.advance(150);
  assert.equal(r.text('voteCount'), '1');
});

test('Fields retain all controls and colors, external CSS has no SE placeholders', () => {
  ['cardsData', 'cardsSource', 'cardsJson', 'cardNames', 'cardImages'].forEach(key => assert.equal(fields[key], undefined));
  ['showDebug', 'deckOrder', 'streamerSmash', 'streamerPass', 'nextCard', 'resetDeck',
    'testViewer1Smash', 'testViewer1Pass', 'testViewer2Smash', 'testViewer2Pass', 'testViewer3Smash', 'testViewer3Pass'].forEach(key => assert.ok(fields[key], key));
  const css = fs.readFileSync(path.join(root, 'widget/widget.css'), 'utf8');
  assert.equal(css.includes('{{'), false);
  Object.entries(fields).filter(([, field]) => field.type === 'colorpicker').forEach(([name]) => assert.ok(code.includes('"' + name + '"'), name));
  assert.equal(code.includes('fieldData["cardsData"]'), false);
});
