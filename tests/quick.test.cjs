const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(invoke = async () => 1) {
  const elements = new Map();
  const events = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {value: '', textContent: '', style: {}, className: '', disabled: false,
      children: [], classList: {add() {}, remove() {}}, focus() {}, setAttribute() {}, appendChild(child) {this.children.push(child);} });
    return elements.get(id);
  };
  let hides = 0;
  const timers = new Map();
  let timerId = 0;
  const context = vm.createContext({console,
    document: { createElement: () => ({setAttribute() {}}), getElementById: element, querySelector: element, hasFocus: () => true },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    window: { addEventListener: (name, fn) => events.set(name, fn),
      __TAURI__: { core: {invoke: (cmd, args) => cmd === 'get_quick_target' ? Promise.resolve(null) : invoke(cmd, args)},
        window: {getCurrentWindow: () => ({hide: () => {hides++;}, setFocus: async () => {}})},
        event: {listen: (name, fn) => events.set(name, fn)} }}
  });
  const source = fs.readFileSync('src/quick.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(source, context);
  return { element, events, run: code => vm.runInContext(code, context),
    open(id) { events.get('quick-open')({payload: {id, name: id}}); },
    flushTimers() { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn()); },
    hides: () => hides };
}

test('reopening and switching bots preserves each draft', () => {
  const app = setup();
  app.open('a'); app.element('input').value = 'first draft';
  app.open('a'); assert.equal(app.element('input').value, 'first draft');
  app.open('b'); assert.equal(app.element('input').value, '');
  app.element('input').value = 'second draft';
  app.open('a'); assert.equal(app.element('input').value, 'first draft');
});

test('retry after a partial file failure saves only remaining files', async () => {
  const calls = []; let fail = true;
  const app = setup(async (cmd, args) => {
    calls.push([cmd, args]);
    if (args.paths?.[0] === '/b' && fail) { fail = false; throw Error('disk full'); }
    return 1;
  });
  app.open('a'); app.element('input').value = 'note';
  app.run("addPending(['/a', '/b'])");
  await app.run('save()');
  assert.equal(app.element('input').value, '');
  assert.equal(app.run('pendingFiles.length'), 1);
  await app.run('save()');
  assert.deepEqual(calls.map(([cmd, args]) => [cmd, args.paths?.[0]]),
    [['append_note', undefined], ['save_files', '/a'], ['save_files', '/b'], ['save_files', '/b']]);
});

test('in-flight save keeps its original bot and blocks duplicate submission', async () => {
  let finish; const calls = [];
  const app = setup((cmd, args) => { calls.push([cmd, args.id]); return new Promise(resolve => { finish = resolve; }); });
  app.open('a'); app.element('input').value = 'note';
  const pending = app.run('save()');
  app.open('b'); await app.run('save()');
  app.events.get('keydown')({key: 'Escape', preventDefault() {}});
  assert.equal(app.element('input').value, 'note');
  assert.equal(app.element('input').disabled, true);
  finish(); await pending;
  assert.deepEqual(calls, [['append_note', 'a']]);
  assert.equal(app.element('input').disabled, false);
});

test('typing after success prevents the old hide timer dismissing new work', async () => {
  const app = setup(); app.open('a'); app.element('input').value = 'saved';
  await app.run('save()');
  app.element('input').value = 'new draft'; app.flushTimers();
  assert.equal(app.hides(), 0);
});


test('removing one queued attachment preserves the note and remaining files', () => {
  const app = setup(); app.open('a'); app.element('input').value = 'keep this';
  app.run("addPending(['/first.txt', '/second.txt'])");
  app.element('pending').children[0].onclick();
  assert.equal(app.run('pendingFiles.length'), 1);
  assert.equal(app.run('pendingFiles[0].path'), '/second.txt');
  assert.equal(app.element('input').value, 'keep this');
});

test('capture requested during a save opens afterward instead of disappearing', async () => {
  let finish;
  const app = setup(() => new Promise(resolve => {finish = resolve;}));
  app.open('a'); app.element('input').value = 'first';
  const pending = app.run('save()'); app.open('b');
  finish(); await pending;
  assert.equal(app.element('target').textContent, 'b');
  app.flushTimers(); assert.equal(app.hides(), 0);
});

test('switching after a failed save preserves the failed draft for retry', async () => {
  let fail;
  const app = setup(() => new Promise((resolve,reject) => {fail = reject;}));
  app.open('a'); app.element('input').value = 'keep me';
  const pending = app.run('save()'); app.open('b');
  fail(Error('disk full')); await pending;
  app.open('a'); assert.equal(app.element('input').value, 'keep me');
});
