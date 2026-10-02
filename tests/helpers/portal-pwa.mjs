// Offline-only service-worker and bootstrap fixtures. Exercise the installed
// cache and exact application URLs instead of pinning historical release labels.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const origin = 'https://portal.example.invalid/';
export const readPortal = path => readFileSync(new URL(path, root), 'utf8');

export function serviceWorkerHarness({ cacheMatch = async () => undefined, fetcher = async () => { throw Error('offline'); }, keys = [] } = {}) {
  const listeners = {}, opened = [], deleted = [], puts = [], precache = [];
  let claims = 0;
  const context = vm.createContext({
    URL, Response, console, fetch: fetcher,
    self: { location: { origin: new URL(origin).origin }, addEventListener: (name, fn) => { listeners[name] = fn; },
      skipWaiting() {}, clients: { claim() { claims++; } } },
    caches: {
      match: cacheMatch, keys: async () => keys,
      delete: async key => { deleted.push(key); return true; },
      open: async name => {
        opened.push(name);
        return { put: async (...args) => { puts.push({ name, args }); }, addAll: async urls => { precache.push(...urls); } };
      }
    }
  });
  vm.runInContext(readPortal('serviceworker.js'), context, { filename: 'serviceworker.js' });
  const { CACHE_VERSION: cacheVersion, CACHE_NAME: cacheName } = vm.runInContext('({ CACHE_VERSION, CACHE_NAME })', context);
  const worker = { listeners, opened, deleted, puts, precache, cacheVersion, cacheName, get claims() { return claims; } };
  return worker;
}

export async function installedPwa() {
  const worker = serviceWorkerHarness();
  assert.match(worker.cacheVersion, /^v\d+(?:-[a-z0-9-]+)?$/);
  assert.equal(worker.cacheName, `bircicek-portal-${worker.cacheVersion}`);
  let pending;
  worker.listeners.install({ waitUntil(promise) { pending = promise; } });
  assert.ok(pending, 'install must await precaching');
  await pending;
  assert.deepEqual(worker.opened, [worker.cacheName]);
  assert.ok(worker.precache.length > 0, 'install must cache the application assets');
  assert.ok(worker.precache.includes('./index.html'), 'install must retain the offline app shell');
  return worker;
}

// Run the actual inline registration and controllerchange handler with browser
// APIs stubbed. The cache generation, registration URL and reload guard agree.
export async function assertPwaBootstrap(worker, html = readPortal('index.html')) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).filter(code => /navigator\.serviceWorker\.register\(/.test(code));
  assert.equal(scripts.length, 1, 'one live PWA registration script');
  const events = {}, registered = [], stored = new Map();
  let updates = 0, reloads = 0;
  vm.runInNewContext(scripts[0], {
    console: { warn(error) { throw error; } },
    window: { addEventListener(name, fn) { events[name] = fn; } },
    navigator: { serviceWorker: {
      async register(url) { registered.push(url); return { async update() { updates++; } }; },
      addEventListener(name, fn) { events[name] = fn; }
    } },
    sessionStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) },
    location: { reload() { reloads++; } }
  });
  await events.load();
  assert.equal(registered.length, 1);
  const url = new URL(registered[0], origin), generation = worker.cacheVersion.match(/^v(\d+)/)[1];
  assert.equal(url.pathname, '/serviceworker.js');
  assert.equal(url.searchParams.get('v'), generation, 'registration must request this cache generation');
  assert.equal(updates, 1);
  events.controllerchange();
  events.controllerchange();
  assert.deepEqual([...stored], [[`portalSwReload_v${generation}`, '1']]);
  assert.equal(reloads, 1, 'one reload per controller generation');
}

function resolveImport(specifier, source, importer) {
  const expanded = specifier.replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (_, name) => {
    const declaration = new RegExp(`\\bconst\\s+${name}\\s*=\\s*(['\"])([^'\"]*)\\1`).exec(source);
    assert.ok(declaration, `literal version constant ${name} in ${importer}`);
    return declaration[2];
  });
  return new URL(expanded, new URL(importer, origin));
}

export function assertPrecachedImport(worker, importer, target) {
  const source = readPortal(importer);
  const specifiers = [
    ...[...source.matchAll(/(?:^|\n)[ \t]*import\s+(?:[\w$*{},\s]+\s+from\s+)?(['"])([^'"\r\n]+)\1/g)].map(match => match[2]),
    ...[...source.matchAll(/\bimport\(\s*(['"`])([^'"`\r\n]+)\1\s*\)/g)].map(match => match[2]),
    ...[...source.matchAll(/<script\b[^>]*\bsrc\s*=\s*(['"])([^'"\r\n]+)\1[^>]*>/gi)].map(match => match[2])
  ];
  const pathname = new URL(target, origin).pathname;
  const matches = specifiers.filter(specifier => /^(?:\.\/|\.\.\/)/.test(specifier))
    .filter(specifier => new URL(specifier.split('?')[0], new URL(importer, origin)).pathname === pathname)
    .map(specifier => resolveImport(specifier, source, importer));
  assert.ok(matches.length > 0, `${importer} must import ${target}`);
  const cacheUrls = worker.precache.map(path => new URL(path, origin));
  assert.equal(cacheUrls.filter(url => url.pathname === pathname).length, 1, `${target} has one current precache entry`);
  const precached = new Set(cacheUrls.map(url => url.href));
  for (const url of matches) {
    assert.match(url.search, /^\?v(?:=)?\d+$/, `${target} must be versioned`);
    assert.ok(precached.has(url.href), `install must precache exact import ${url.pathname}${url.search} from ${importer}`);
    assert.ok(readPortal(url.pathname.slice(1)).length > 0, `${target} exists locally`);
  }
  return matches[0];
}
