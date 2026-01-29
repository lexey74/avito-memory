/**
 * background.js
 * Service Worker.
 */

console.log('[AvitoMemory] Background service worker started.');

// Open Options Page when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
