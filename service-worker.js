// Background Service Worker for Play Console Copilot

// Enable side panel to open upon clicking the action icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set panel behavior:', error));

chrome.runtime.onInstalled.addListener(() => {
  console.log('Play Console Copilot extension installed successfully.');
});
