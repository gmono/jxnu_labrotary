const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Window } = require('happy-dom');

const root = path.resolve(__dirname, '..');
test('message hub routes, filters and unregisters clients without stale ids', () => {
  const window = new Window({ url: 'http://localhost/' });
  const script = fs.readFileSync(path.join(root, 'public/MessageCore.js'), 'utf8');
  const result = window.eval(`${script}\n;(() => {
    const hub = new MessageHub();
    const a = new MessageClient(hub, 'a', 'panel', 'left');
    const b = new MessageClient(hub, 'b', 'panel', 'right');
    const c = new MessageClient(hub, 'c', 'button', 'left');
    const seen = [];
    b.Source.register(message => seen.push(message.data));
    c.Source.register(message => seen.push(message.data));
    hub.register(a); hub.register(b); hub.register(c);
    const duplicate = new MessageClient(hub, 'b', 'duplicate');
    const duplicateAccepted = hub.register(duplicate);
    a.component('panel').send('panel');
    a.group('left').exceptSelf().send('left');
    hub.unregister('b');
    const idsAfterRemoval = hub.id_lst.slice();
    a.send('after removal');
    return { seen, duplicateAccepted, idsAfterRemoval, hasB: hub.getClient('b') !== null };
  })()`);
  assert.deepEqual(Array.from(result.seen), ['panel', 'left', 'after removal']);
  assert.equal(result.duplicateAccepted, false);
  assert.deepEqual(Array.from(result.idsAfterRemoval), ['a', 'c']);
  assert.equal(result.hasB, false);
  window.happyDOM.abort();
});

test('watcher reports nested sets, array insertion and deletion with paths', () => {
  const window = new Window({ url: 'http://localhost/' });
  const script = fs.readFileSync(path.join(root, 'public/Watcher.js'), 'utf8');
  const result = window.eval(`${script}\n;(() => {
    const changes = [];
    const watcher = new Watcher.Watcher(change => changes.push(change));
    const data = watcher.toProxiedData({ user: { name: 'old' }, rows: [1] });
    data.user.name = 'new';
    data.rows.push(2);
    delete data.user.name;
    return changes.map(change => ({ path: change.targetPath, old: change.target.old, value: change.target.new }));
  })()`);
  const paths = Array.from(result, change => change.path);
  assert.ok(paths.includes('/user/name'));
  assert.ok(paths.includes('/rows/1'));
  assert.equal(result.find(change => change.path === '/name').old, 'old');
  assert.equal(result.find(change => change.path === '/name').value, 'new');
  assert.ok(result.some(change => change.path === '/user/name' && change.value === undefined));
  window.happyDOM.abort();
});

test('watcher preserves circular references and can pause notifications', () => {
  const window = new Window({ url: 'http://localhost/' });
  const script = fs.readFileSync(path.join(root, 'public/Watcher.js'), 'utf8');
  const result = window.eval(`${script}\n;(() => {
    const changes=[];
    const source={value:1}; source.self=source;
    const watcher=new Watcher.Watcher(change=>changes.push(change));
    const data=watcher.toProxiedData(source);
    watcher.isListen=false;
    data.value=2;
    watcher.isListen=true;
    data.value=3;
    return {same:data.self===data, changes:changes.length};
  })()`);
  assert.equal(result.same, true);
  assert.equal(result.changes, 1);
  window.happyDOM.abort();
});

test('pack scopes CSS selectors and extracts scripts in document order', async () => {
  const window = new Window({ url: 'http://localhost/' });
  const loader = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  const result = await window.eval(`(async()=>{
    ${loader}
    return await window.pack('<div class="card"><span>ok</span></div><style>.card:hover, .card span::before { color:red }</style><script>window.__first=(window.__first||0)+1</script><script>window.__second=2</script>');
  })()`);
  assert.match(result.html, /\.card\[data-sign="?[^"]+"?\]:hover/);
  assert.match(result.html, /\.card span\[data-sign="?[^"]+"?\]::before/);
  assert.ok(result.html.includes('data-sign='));
  assert.ok(result.script.indexOf('__first') < result.script.indexOf('__second'));
  window.happyDOM.abort();
});

test('concurrent packs keep traversal state isolated and recover after CSS errors', async () => {
  const window = new Window({ url: 'http://localhost/' });
  window.fetch = async url => ({ ok: true, text: async () => url.endsWith('a.css') ? '.alpha:is(.x, .y)::before{color:red}' : '.beta:hover{color:blue}' });
  const loader = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  const results = await window.eval(`(async()=>{
    ${loader}
    return Promise.all([
      window.pack('<link rel="stylesheet" href="a.css"><div class="alpha"></div>'),
      window.pack('<link rel="stylesheet" href="b.css"><div class="beta"></div>')
    ]);
  })()`);
  assert.match(results[0].html, /\.alpha\[data-sign=/);
  assert.match(results[1].html, /\.beta\[data-sign=.*\]:hover/);
  assert.doesNotMatch(results[0].html, /\.beta/);
  assert.doesNotMatch(results[1].html, /\.alpha/);
  await assert.rejects(window.eval(`window.pack('<style>broken{</style>')`));
  const recovered = await window.eval(`window.pack('<style>.recovered:hover{color:green}</style>')`);
  assert.match(recovered.html, /\.recovered\[data-sign=/);
  window.happyDOM.abort();
});

test('component URLs resolve against the containing component and root containers are reused', async () => {
  const window = new Window({ url: 'http://localhost/app/index.html' });
  const core = fs.readFileSync(path.join(root, 'public/MessageCore.js'), 'utf8');
  const loader = fs.readFileSync(path.join(root, 'public/comp_loader.js'), 'utf8');
  const values = await window.eval(`(() => {
    ${core}
    ${loader}
    return { resolved: window.componentLoader.resolveComponentUrl('../parts/card.html', 'http://localhost/app/pages/home.html'), rootCount: 0 };
  })()`);
  assert.equal(values.resolved, 'http://localhost/app/parts/card.html');
  window.happyDOM.abort();
});

test('loadFile fetches and mounts a component into a reusable root container', async () => {
  const window = new Window({ url: 'http://localhost/app/index.html' });
  window.__requested = [];
  window.fetch = async url => {
    window.__requested.push(String(url));
    if (String(url).endsWith('/style.css')) return { ok: true, text: async () => '.component { color:red }' };
    if (String(url).endsWith('/behavior.js')) return { ok: true, text: async () => 'props.back += 1;' };
    return { ok: true, text: async () => '<link rel="stylesheet" href="./style.css"><main class="component">mounted</main><script src="./behavior.js"></script><script>props.root.querySelector("main").textContent=String(props.back)</script>' };
  };
  window.$ = () => ({ find: () => [] });
  window.d3 = { select: () => ({ selectAll: () => ({}) }), selectAll: () => ({}) };
  const core = fs.readFileSync(path.join(root, 'public/MessageCore.js'), 'utf8');
  const componentLoader = fs.readFileSync(path.join(root, 'public/comp_loader.js'), 'utf8');
  const packLoader = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  const result = await window.eval(`(async()=>{
    ${core}
    ${packLoader}
    ${componentLoader}
    const root=document.createElement('section');
    document.body.append(root);
    window.__errors=[];
    window.addEventListener('error',event=>window.__errors.push(event.message));
    const props={back:1};
    const sign=await window.loadFile(root,'http://localhost/app/card.html',props);
    await new Promise(resolve=>setTimeout(resolve,50));
    return {sign, props, text:root.querySelector('main').textContent, errors:window.__errors, requested:window.__requested, containerCount:root.querySelectorAll(':scope > [data-jxnu-container]').length};
  })()`);
  assert.ok(result.sign);
  assert.deepEqual(Array.from(result.errors), []);
  assert.equal(result.text, '2');
  assert.ok(Array.from(result.requested).includes('http://localhost/app/style.css'));
  assert.ok(Array.from(result.requested).includes('http://localhost/app/behavior.js'));
  assert.equal(result.containerCount, 1);
  window.happyDOM.abort();
});
