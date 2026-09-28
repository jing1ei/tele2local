const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function platform(name) {
  const ctx=vm.createContext({window:{},navigator:{platform:name}});
  vm.runInContext(fs.readFileSync('src/platform.js','utf8'),ctx);
  return ctx.window.Tele2LocalPlatform;
}
test('Mac accelerators keep Command and Control distinct',()=>{
  const p=platform('MacIntel');
  assert.equal(p.prettyShortcut('CmdOrCtrl+Shift+KeyI'),'⌘⇧I');
  assert.equal(p.modifiers({metaKey:true,ctrlKey:true}).join('+'),'CmdOrCtrl+Control');
});
test('Windows accelerators record the Windows key without converting it to Control',()=>{
  const p=platform('Win32');
  assert.equal(p.prettyShortcut('CmdOrCtrl+Alt+KeyI'),'Ctrl+Alt+I');
  assert.equal(p.modifiers({metaKey:true,shiftKey:true}).join('+'),'Super+Shift');
  assert.equal(p.prettyShortcut('Super+Shift+KeyI'),'Win+Shift+I');
  assert.equal(p.modifiers({ctrlKey:true,altKey:true}).join('+'),'Control+Alt');
});
