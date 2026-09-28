const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(invoke = async () => [], platform = 'MacIntel') {
  const elements = new Map();
  let document;
  const element = id => {
    if (!elements.has(id)) {
      const classes = new Set(), attrs = new Map();
      elements.set(id, {id,value:'',textContent:'',className:'',style:{},dataset:{},disabled:false,isConnected:true,
        classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
        setAttribute:(k,v)=>attrs.set(k,v),getAttribute:k=>attrs.get(k),removeAttribute:k=>attrs.delete(k),
        querySelector:()=>element(id+'-body'),querySelectorAll:()=>[],appendChild(){},addEventListener(){},
        focus(){document.activeElement=this;}});
    }
    return elements.get(id);
  };
  document={getElementById:element,createElement:()=>element('row-'+Math.random()),activeElement:null,
    querySelector:()=>['overlay','srv-overlay'].map(element).find(e=>e.classList.contains('show'))||null,addEventListener(){},hidden:true};
  const context=vm.createContext({navigator:{platform},document,console,setInterval(){},alert(){},confirm:()=>true,window:{__TAURI__:{core:{invoke}},addEventListener(){},removeEventListener(){}}});
  vm.runInContext(fs.readFileSync('src/platform.js','utf8'),context);
  vm.runInContext(fs.readFileSync('src/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],context);
  return {element,run:code=>vm.runInContext(code,context)};
}

test('stale token validation cannot overwrite changed credentials',async()=>{
  let finish;
  const app=setup((cmd)=>cmd==='validate_token'?new Promise(r=>finish=r):Promise.resolve([]));
  app.run('openForm()');app.element('f-token').value='first';
  const pending=app.run('validateToken()');
  app.element('f-token').value='second';app.run('clearValidate()');
  finish('first_bot');await pending;
  assert.equal(app.element('validate-msg').textContent,'');
  assert.equal(app.element('validate-btn').disabled,false);
});

test('picker response from a closed form never changes a new form',async()=>{
  let finish;
  const app=setup(cmd=>cmd==='pick_markdown_file'?new Promise(r=>finish=r):Promise.resolve([]));
  app.run('openForm()');const pending=app.run("browseInto('f-file','pick_markdown_file')");
  app.run('closeForm(); openForm()');app.element('f-file').value='/new/note.md';
  finish('/old/note.md');await pending;
  assert.equal(app.element('f-file').value,'/new/note.md');
});

test('out-of-order refresh cannot replace a newer bot list',async()=>{
  const replies=[];const app=setup(()=>new Promise(r=>replies.push(r)));
  const latest=app.run('refresh()');replies[1]([]);await latest;
  replies[0]([{id:'stale'}]);await new Promise(r=>setImmediate(r));
  assert.equal(app.element('summary').textContent,'0 bots · 0 running');
});

test('invalid server port is rejected without sending corrected settings',async()=>{
  const calls=[];const app=setup(async(cmd)=>{calls.push(cmd);return [];});
  app.element('s-port').value='70000';app.element('s-api-id').value='123';
  await app.run('saveServerConfig()');
  assert(!calls.includes('update_server_config'));
  assert.match(app.element('s-msg').textContent,/65535/);
});

test('validation ending after close cannot overwrite a new dialog',async()=>{
  let finish;const app=setup(cmd=>cmd==='validate_token'?new Promise(r=>finish=r):Promise.resolve([]));
  app.run('openForm()');app.element('f-token').value='old';const pending=app.run('validateToken()');
  app.run('closeForm(); openForm()');finish('old_bot');await pending;
  assert.equal(app.element('validate-msg').textContent,'');
});


test('Windows manager shows native paths and accepts Windows form inputs', async () => {
  const app=setup(async()=>[], 'Win32');
  assert.equal(app.element('f-file').placeholder, 'C:\\Users\\you\\Notes\\ideas.md');
  assert.match(app.element('f-shortcut').placeholder, /Ctrl\+Alt/);
  assert.equal(app.run("prettyShortcut('CmdOrCtrl+Shift+KeyI')"), 'Ctrl+Shift+I');
});

test('new bot requires an explicit user ID choice before saving',async()=>{
  const calls=[];const app=setup(async(cmd,args)=>{calls.push([cmd,args]);return [];});
  app.run('openForm()');
  app.element('f-token').value='fixture';app.element('f-file').value='/demo/notes.md';
  await app.run('save()');
  assert(!calls.some(([cmd])=>cmd==='add_bot'));
  assert.match(app.element('validate-msg').textContent,/user ID/);
  assert.equal(app.element('f-user').getAttribute('aria-invalid'),'true');
});

test('new-file picker passes creation intent without changing the read-file picker',async()=>{
  const calls=[];const app=setup(async(cmd,args)=>{calls.push([cmd,args]);return cmd==='pick_markdown_file'?'/demo/new.md':[];});
  app.run('openForm()');
  await app.run("browseInto('f-file','pick_markdown_file',{newFile:true})");
  await app.run("browseInto('f-read-file','pick_markdown_file')");
  const pickers=calls.filter(([cmd])=>cmd==='pick_markdown_file');
  assert.equal(pickers[0][1].newFile,true);
  assert.equal(pickers[1][1].newFile,undefined);
  assert.equal(app.element('f-file').value,'/demo/new.md');
});


test('saved settings with a failed server start keep a recoverable form', async () => {
  const calls=[];
  const app=setup(async(cmd,args)=>{
    calls.push([cmd,args]);
    return cmd==='update_server_config' ? {startup_error:'port already in use'} : [];
  });
  app.element('s-enabled').checked=true;
  app.element('s-api-id').value='123'; app.element('s-port').value='8081';
  app.element('s-api-hash').value='fixture-hash';
  await app.run('saveServerConfig()');
  assert.match(app.element('s-status').textContent,/port already in use/);
  assert.match(app.element('s-msg').textContent,/Settings saved/);
  assert.equal(app.element('s-api-hash').value,'');
  assert.equal(app.element('s-api-hash').dataset.had,'true');
  await app.run('saveServerConfig()');
  assert.equal(calls.filter(([cmd])=>cmd==='update_server_config').length,2);
});
