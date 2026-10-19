// Keep keyboard labels and recorded accelerators consistent across both windows.
window.Tele2LocalPlatform = (() => {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  function modifiers(event) {
    const keys = [];
    if (event.metaKey) keys.push(isMac ? 'CmdOrCtrl' : 'Super');
    if (event.ctrlKey) keys.push('Control');
    if (event.altKey) keys.push('Alt');
    if (event.shiftKey) keys.push('Shift');
    return keys;
  }
  function prettyShortcut(accelerator) {
    const labels = {CmdOrCtrl: isMac ? '⌘' : 'Ctrl', CommandOrControl: isMac ? '⌘' : 'Ctrl',
      Command:'⌘', Cmd:'⌘', Super:isMac ? '⌘' : 'Win', Meta:isMac ? '⌘' : 'Win',
      Control:isMac ? '⌃' : 'Ctrl', Ctrl:isMac ? '⌃' : 'Ctrl',
      Alt:isMac ? '⌥' : 'Alt', Option:isMac ? '⌥' : 'Alt', Shift:isMac ? '⇧' : 'Shift'};
    return accelerator.split('+').map(key => labels[key] || key.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow','').replace('Numpad','Num ')).join(isMac ? '' : '+');
  }
  return {isMac, modifiers, prettyShortcut};
})();
