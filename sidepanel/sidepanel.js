import { GeminiMentor, DEFAULT_GEMINI_URL, DEFAULT_LOCAL_URL, GEMINI_FALLBACK_MODELS } from './gemini.js';

// Application State
const mentor = new GeminiMentor((statusText) => {
  appendMessage('assistant', `🔄 *${statusText}*`);
});
let currentTabId = null;
let currentAppInfo = {
  devId: null,
  appId: null,
  baseAppUrl: null,
  appName: null
};

// DOM Elements
const topControlSection = document.getElementById('topControlSection');
const btnToggleTopCard = document.getElementById('btnToggleTopCard');
const banner = document.getElementById('detectionBanner');
const bannerIcon = document.getElementById('bannerIcon');
const detectedAppTitle = document.getElementById('detectedAppTitle');
const detectedAppDesc = document.getElementById('detectedAppDesc');

const btnStartTour = document.getElementById('btnStartTour');
const btnScanCurrent = document.getElementById('btnScanCurrent');
const tourProgressCard = document.getElementById('tourProgressCard');
const progressSubtitle = document.getElementById('progressSubtitle');

const chatStream = document.getElementById('chatStream');
const chatInput = document.getElementById('chatInput');
const btnSendChat = document.getElementById('btnSendChat');
const quickPrompts = document.getElementById('quickPrompts');

// Settings & Theme Elements
const btnThemeToggle = document.getElementById('btnThemeToggle');
const btnSettingsToggle = document.getElementById('btnSettingsToggle');
const settingsModal = document.getElementById('settingsModal');
const modalOverlay = document.getElementById('modalOverlay');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const selectProviderPreset = document.getElementById('selectProviderPreset');
const linkGetApiKey = document.getElementById('linkGetApiKey');
const baseUrlHelp = document.getElementById('baseUrlHelp');
const inputBaseUrl = document.getElementById('inputBaseUrl');
const inputApiKey = document.getElementById('inputApiKey');
const selectModel = document.getElementById('selectModel');
const btnFetchModels = document.getElementById('btnFetchModels');
const customModelGroup = document.getElementById('customModelGroup');
const inputCustomModel = document.getElementById('inputCustomModel');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const settingsFeedback = document.getElementById('settingsFeedback');

/**
 * Initialize Side Panel
 */
async function init() {
  await initTheme();
  await mentor.init();

  inputBaseUrl.value = mentor.baseUrl;
  inputApiKey.value = mentor.apiKey;

  // Determine active preset based on loaded baseUrl
  const isLocal = mentor.baseUrl.includes('127.0.0.1') || mentor.baseUrl.includes('localhost');
  const isGoogle = mentor.baseUrl.includes('googleapis.com');

  if (selectProviderPreset) {
    if (isLocal) {
      selectProviderPreset.value = 'freellmapi';
    } else if (isGoogle) {
      selectProviderPreset.value = 'gemini';
    } else {
      selectProviderPreset.value = 'custom';
    }
    updatePresetUI(selectProviderPreset.value);
  }

  updateModelDropdown(mentor.model);

  setupEventListeners();
  await checkActiveTab();
}

function updatePresetUI(preset) {
  if (preset === 'gemini') {
    if (baseUrlHelp) baseUrlHelp.textContent = 'Google Gemini endpoint resmi (gratis via Google AI Studio).';
    if (linkGetApiKey) linkGetApiKey.classList.remove('hidden');
  } else if (preset === 'freellmapi') {
    if (baseUrlHelp) baseUrlHelp.textContent = 'FreeLLMAPI lokal (Hanya jalan jika aplikasi FreeLLMAPI aktif di komputermu).';
    if (linkGetApiKey) linkGetApiKey.classList.add('hidden');
  } else {
    if (baseUrlHelp) baseUrlHelp.textContent = 'Custom Base URL OpenAI / Anthropic / Proxy lainnya.';
    if (linkGetApiKey) linkGetApiKey.classList.add('hidden');
  }
}

function applyProviderPreset(preset) {
  updatePresetUI(preset);
  if (preset === 'gemini') {
    inputBaseUrl.value = DEFAULT_GEMINI_URL;
    selectModel.innerHTML = '';
    for (const m of GEMINI_FALLBACK_MODELS) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m === 'gemini-3.8-flash' ? `${m} (Rekomendasi Cepat & Cerdas)` : m;
      selectModel.appendChild(opt);
    }
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = '✍️ Ketik Model Manual...';
    selectModel.appendChild(customOpt);
    selectModel.value = 'gemini-3.8-flash';
    customModelGroup.classList.add('hidden');
  } else if (preset === 'freellmapi') {
    inputBaseUrl.value = DEFAULT_LOCAL_URL;
    selectModel.innerHTML = `
      <option value="auto" selected>auto (Smart Routing)</option>
      <option value="custom">✍️ Ketik Model Manual...</option>
    `;
    selectModel.value = 'auto';
    customModelGroup.classList.add('hidden');
  }
}

function updateModelDropdown(activeModel) {
  // Check if option exists in dropdown
  let found = false;
  for (const opt of selectModel.options) {
    if (opt.value === activeModel) {
      selectModel.value = activeModel;
      found = true;
      break;
    }
  }

  if (!found && activeModel) {
    // Add active model to dropdown
    const opt = document.createElement('option');
    opt.value = activeModel;
    opt.textContent = `${activeModel} (Tersimpan)`;
    selectModel.insertBefore(opt, selectModel.firstChild);
    selectModel.value = activeModel;
  }
}

/**
 * Initialize Dark / Light Theme
 */
function initTheme() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['theme'], (result) => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = result.theme === 'dark' || (!result.theme && prefersDark);

      applyTheme(isDark);
      resolve();
    });
  });
}

function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add('dark-theme');
    if (btnThemeToggle) {
      btnThemeToggle.textContent = '☀️';
      btnThemeToggle.title = 'Ganti Mode Terang';
    }
  } else {
    document.body.classList.remove('dark-theme');
    if (btnThemeToggle) {
      btnThemeToggle.textContent = '🌙';
      btnThemeToggle.title = 'Ganti Mode Gelap';
    }
  }
}

function toggleTheme() {
  const isDarkNow = document.body.classList.toggle('dark-theme');
  applyTheme(isDarkNow);
  chrome.storage.local.set({ theme: isDarkNow ? 'dark' : 'light' });
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Tour & Scan buttons
  btnStartTour.addEventListener('click', handleStartTour);
  btnScanCurrent.addEventListener('click', handleScanCurrent);

  // Chat input
  btnSendChat.addEventListener('click', handleSendChat);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  });

  // Quick Prompt pills
  quickPrompts.addEventListener('click', (e) => {
    const pill = e.target.closest('.prompt-pill');
    if (pill && pill.dataset.prompt) {
      chatInput.value = pill.dataset.prompt;
      handleSendChat();
    }
  });

  // Theme Toggle (Dark / Light)
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', toggleTheme);
  }

  // Toggle Collapsible Top Controls
  if (btnToggleTopCard) {
    btnToggleTopCard.addEventListener('click', () => {
      topControlSection.classList.toggle('collapsed');
    });
  }

  // Settings Model dropdown changes
  if (selectModel) {
    selectModel.addEventListener('change', () => {
      if (selectModel.value === 'custom') {
        customModelGroup.classList.remove('hidden');
        inputCustomModel.focus();
      } else {
        customModelGroup.classList.add('hidden');
      }
    });
  }

  // Provider Preset changes
  if (selectProviderPreset) {
    selectProviderPreset.addEventListener('change', () => {
      applyProviderPreset(selectProviderPreset.value);
    });
  }

  // Smart detect Google Gemini API key on input/paste
  if (inputApiKey) {
    inputApiKey.addEventListener('input', () => {
      const val = inputApiKey.value.trim();
      if (val.startsWith('AIzaSy') && selectProviderPreset && selectProviderPreset.value !== 'gemini') {
        selectProviderPreset.value = 'gemini';
        applyProviderPreset('gemini');
        showSettingsFeedback('✨ Key Google Gemini terdeteksi! Provider otomatis disetel ke Google Gemini.', 'success');
      }
    });
  }

  // Fetch Models button
  if (btnFetchModels) {
    btnFetchModels.addEventListener('click', handleFetchModels);
  }

  // Settings Modal
  btnSettingsToggle.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
  modalOverlay.addEventListener('click', () => settingsModal.classList.add('hidden'));
  btnSaveSettings.addEventListener('click', handleSaveSettings);

  // Track Tab Changes
  chrome.tabs.onActivated.addListener(async () => {
    await checkActiveTab();
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (tabId === currentTabId && changeInfo.url) {
      await checkActiveTab();
    }
  });
}

/**
 * Detect if active tab is inside Play Console & parse App details
 */
async function checkActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    currentTabId = tab.id;
    const url = tab.url;

    if (!url.includes('play.google.com/console')) {
      updateBannerStatus(false, 'Bukan Tab Google Play Console', 'Buka dashboard Play Console aplikasimu di browser ini.');
      btnStartTour.disabled = true;
      btnScanCurrent.disabled = true;
      return;
    }

    // Parse Developer ID and App ID
    // Example: https://play.google.com/console/u/0/developers/123456789/app/49728374928/app-dashboard
    const appMatch = url.match(/\/developers\/([^\/]+)\/app\/([^\/\?#]+)/);
    if (appMatch) {
      currentAppInfo.devId = appMatch[1];
      currentAppInfo.appId = appMatch[2];
      
      // Determine base URL prefix (accounting for /u/0/ or direct)
      const uPrefixMatch = url.match(/play\.google\.com\/console(\/u\/\d+)?/);
      const prefix = uPrefixMatch ? uPrefixMatch[0] : 'play.google.com/console';
      currentAppInfo.baseAppUrl = `https://${prefix}/developers/${currentAppInfo.devId}/app/${currentAppInfo.appId}`;

      updateBannerStatus(true, `Aplikasi Terdeteksi: ${currentAppInfo.appId}`, 'Siap melakukan penjelajahan audit holistik.');
      btnStartTour.disabled = false;
      btnScanCurrent.disabled = false;
    } else {
      updateBannerStatus(true, 'Play Console Terbuka', 'Pilih salah satu aplikasimu dari daftar untuk memulai.');
      btnStartTour.disabled = true;
      btnScanCurrent.disabled = false;
    }
  } catch (err) {
    console.error('Error checking active tab:', err);
  }
}

function updateBannerStatus(isPlayConsole, title, desc) {
  if (isPlayConsole) {
    banner.className = 'detection-banner banner-detected';
    bannerIcon.textContent = '✅';
  } else {
    banner.className = 'detection-banner banner-idle';
    bannerIcon.textContent = 'ℹ️';
  }
  detectedAppTitle.textContent = title;
  detectedAppDesc.textContent = desc;
}

/**
 * Ensure content script is active in the tab
 */
async function ensureContentScript(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'PING' });
    if (response && response.status === 'PONG') return true;
  } catch {
    // If not injected, inject programmatically
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    await new Promise((r) => setTimeout(r, 400));
  }
  return true;
}

/**
 * Wait for a tab navigation to complete & settle
 */
function waitForTabLoad(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // Proceed anyway on timeout
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        // Settle delay for Play Console Angular/gRPC rendering
        setTimeout(resolve, 3200);
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Handle Full Tour: Visits key checkpoints sequentially
 */
async function handleStartTour() {
  if (!currentAppInfo.baseAppUrl || !currentTabId) {
    alert('Buka halaman aplikasi di Google Play Console terlebih dahulu.');
    return;
  }

  // Collapse top bar to give 100% full height to the Doctor's chat/report
  topControlSection.classList.add('collapsed');

  btnStartTour.disabled = true;
  btnScanCurrent.disabled = true;
  tourProgressCard.classList.remove('hidden');

  const checkpoints = [
    {
      id: 1,
      name: 'Lapak Toko & Sumber Trafik',
      url: `${currentAppInfo.baseAppUrl}/store-performance`,
      desc: 'Membaca jalur masuk (Search, Explore, Referral) & angka instalasi...'
    },
    {
      id: 2,
      name: 'Kondisi Mesin (Android Vitals)',
      url: `${currentAppInfo.baseAppUrl}/vitals/crashes-anrs`,
      desc: 'Memeriksa apakah ada crash, freeze (ANR), dan tipe HP terdampak...'
    },
    {
      id: 3,
      name: 'Retensi & Perangkat Aktif',
      url: `${currentAppInfo.baseAppUrl}/statistics`,
      desc: 'Memeriksa berapa banyak pengguna yang uninstall vs bertahan...'
    },
    {
      id: 4,
      name: 'Suara Pengguna & Ulasan',
      url: `${currentAppInfo.baseAppUrl}/user-feedback/reviews`,
      desc: 'Membaca keluhan, pujian, dan rating dari pengguna...'
    }
  ];

  const gatheredData = {
    appName: currentAppInfo.appName || currentAppInfo.appId,
    appId: currentAppInfo.appId,
    checkpoints: []
  };

  try {
    // 0. First, grab whatever is already visible on the current tab (e.g. Dashboard)
    try {
      await ensureContentScript(currentTabId);
      const initialSnapshot = await chrome.tabs.sendMessage(currentTabId, {
        action: 'EXTRACT_CHECKPOINT_DATA',
        checkpoint: 'Dashboard / Halaman Awal'
      });
      if (initialSnapshot && initialSnapshot.success) {
        gatheredData.checkpoints.push(initialSnapshot.data);
      }
    } catch (e) {
      console.log('Skipping initial page snapshot:', e.message);
    }

    // 1-4. Now visit the 4 core checkpoints
    for (const cp of checkpoints) {
      updateStepperUI(cp.id, 'active');
      progressSubtitle.textContent = `Pos ${cp.id}/4: ${cp.name} - ${cp.desc}`;

      // Navigate active tab
      await chrome.tabs.update(currentTabId, { url: cp.url });
      await waitForTabLoad(currentTabId);

      // Ensure extractor is ready
      await ensureContentScript(currentTabId);

      // Scrape metrics deeply
      const response = await chrome.tabs.sendMessage(currentTabId, {
        action: 'EXTRACT_CHECKPOINT_DATA',
        checkpoint: cp.name
      });

      if (response && response.success) {
        gatheredData.checkpoints.push(response.data);
      }

      updateStepperUI(cp.id, 'completed');
    }

    progressSubtitle.textContent = '✨ Selesai menjelajah! Dokter Aplikasi sedang meracik cerita & rekomendasi...';

    // Send full dossier to Gemini
    appendMessage('assistant', '🔍 *Semua pos telah dijelajahi! Sedang menganalisa sumber trafik & merajut cerita utuh aplikasimu...*');
    const report = await mentor.synthesizeTourReport(gatheredData);

    appendMessage('assistant', report);
  } catch (err) {
    console.error('Error during tour:', err);
    appendMessage('assistant', `⚠️ **Terjadi kendala saat menjelajah:** ${err.message}. Kamu bisa coba klik tombol "Analisis Halaman Ini Saja" sebagai alternatif.`);
  } finally {
    btnStartTour.disabled = false;
    btnScanCurrent.disabled = false;
    setTimeout(() => tourProgressCard.classList.add('hidden'), 5000);
  }
}

/**
 * Handle Single-Page Instant Scan
 */
async function handleScanCurrent() {
  if (!currentTabId) return;

  btnScanCurrent.disabled = true;
  appendMessage('assistant', '📸 *Sedang membaca data di halaman yang aktif saat ini...*');

  try {
    await ensureContentScript(currentTabId);
    const response = await chrome.tabs.sendMessage(currentTabId, {
      action: 'EXTRACT_CHECKPOINT_DATA',
      checkpoint: 'Halaman Aktif'
    });

    if (!response || !response.success) {
      throw new Error('Gagal mengekstrak data dari halaman ini.');
    }

    const report = await mentor.synthesizeTourReport({
      appName: currentAppInfo.appName || currentAppInfo.appId || 'Aplikasi',
      appId: currentAppInfo.appId,
      checkpoints: [response.data]
    });

    appendMessage('assistant', report);
  } catch (err) {
    console.error('Scan error:', err);
    appendMessage('assistant', `⚠️ **Gagal menganalisis halaman:** ${err.message}`);
  } finally {
    btnScanCurrent.disabled = false;
  }
}

/**
 * Handle User Chat Input
 */
async function handleSendChat() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  appendMessage('user', text);

  // Typing indicator
  const typingBubble = appendMessage('assistant', '⏳ *Dokter Aplikasi sedang berpikir...*');

  try {
    const reply = await mentor.askQuestion(text);
    typingBubble.querySelector('.bubble-content').innerHTML = renderMarkdown(reply);
  } catch (err) {
    typingBubble.querySelector('.bubble-content').innerHTML = `⚠️ **Error:** ${err.message}`;
  }
}

/**
 * Update Progress Stepper UI
 */
function updateStepperUI(stepNumber, state) {
  const stepItem = document.getElementById(`step${stepNumber}`);
  const line = document.getElementById(`line${stepNumber - 1}`);

  if (state === 'active') {
    stepItem.className = 'step-item active';
  } else if (state === 'completed') {
    stepItem.className = 'step-item completed';
    if (line) line.classList.add('completed');
  }
}

/**
 * Append message bubble to chat
 */
function appendMessage(sender, text) {
  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${sender}`;

  if (sender === 'assistant') {
    bubble.innerHTML = `
      <div class="bubble-header">
        <span class="bubble-badge">Dokter Aplikasi</span>
      </div>
      <div class="bubble-content">${renderMarkdown(text)}</div>
    `;
  } else {
    bubble.innerHTML = `<div class="bubble-content">${escapeHTML(text)}</div>`;
  }

  chatStream.appendChild(bubble);
  chatStream.scrollTop = chatStream.scrollHeight;
  return bubble;
}

/**
 * Lightweight Safe Markdown Renderer optimized for clean bullet lists & stats
 */
function renderMarkdown(raw) {
  if (!raw) return '';

  // 1. Normalize line endings and escape HTML
  let text = escapeHTML(raw.replace(/\r\n/g, '\n'));

  // 2. Headers
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 3. Bold & inline code
  text = text.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  text = text.replace(/`([^`]+)`/gim, '<code>$1</code>');

  // 4. Checkboxes
  text = text.replace(/\[ \]/g, '<span class="todo-box">⬜</span>');
  text = text.replace(/\[x\]/gi, '<span class="todo-box done">✅</span>');

  // 5. Sub-bullets (indented with 2+ spaces or tabs)
  text = text.replace(/^(?:  |\t)[\*\-]\s+(.*$)/gim, '<li class="sub-li">$1</li>');

  // 6. Top-level bullets (* or -)
  text = text.replace(/^[\*\-]\s+(.*$)/gim, '<li>$1</li>');

  // 7. Process lines and wrap consecutive list items into separate <ul>
  const lines = text.split('\n');
  const result = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      continue;
    }

    if (line.startsWith('<li>') || line.startsWith('<li class="sub-li">')) {
      if (!inList) {
        result.push('<ul class="bullet-list">');
        inList = true;
      }
      result.push(line);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (line.startsWith('<h1') || line.startsWith('<h2') || line.startsWith('<h3')) {
        result.push(line);
      } else {
        result.push(`<p class="msg-para">${line}</p>`);
      }
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  return result.join('\n');
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Fetch available models dynamically from Base URL
 */
async function handleFetchModels() {
  const baseUrl = inputBaseUrl.value.trim();
  const apiKey = inputApiKey.value.trim();

  if (!baseUrl) {
    showSettingsFeedback('Base URL tidak boleh kosong.', 'error');
    return;
  }

  btnFetchModels.disabled = true;
  btnFetchModels.textContent = '⏳ Mengambil...';
  showSettingsFeedback('Menghubungi Base URL untuk mengambil model...', 'success');

  try {
    const models = await GeminiMentor.fetchAvailableModels(baseUrl, apiKey);
    
    // Clear select options
    selectModel.innerHTML = '';

    const isGoogle = baseUrl.toLowerCase().includes('googleapis.com');

    // Only put 'auto' first if not Google Gemini (for FreeLLMAPI)
    if (!isGoogle && !models.includes('auto')) {
      const autoOpt = document.createElement('option');
      autoOpt.value = 'auto';
      autoOpt.textContent = 'auto (Smart Routing)';
      selectModel.appendChild(autoOpt);
    }

    // Append fetched models
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m === 'auto' ? 'auto (Smart Routing)' : (m === 'gemini-3.8-flash' ? `${m} (Rekomendasi)` : m);
      selectModel.appendChild(opt);
    }

    // Add manual custom entry option
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = '✍️ Ketik Model Manual...';
    selectModel.appendChild(customOpt);

    // Default to mentor.model or first option
    if (models.includes(mentor.model)) {
      selectModel.value = mentor.model;
    } else {
      selectModel.value = models[0] || (isGoogle ? 'gemini-3.8-flash' : 'auto');
    }

    showSettingsFeedback(`Berhasil mengambil ${models.length} model!`, 'success');
  } catch (err) {
    showSettingsFeedback(`Gagal mengambil model: ${err.message}`, 'error');
  } finally {
    btnFetchModels.disabled = false;
    btnFetchModels.textContent = '🔄 Fetch Models';
  }
}

/**
 * Save Settings
 */
async function handleSaveSettings() {
  let newBaseUrl = inputBaseUrl.value.trim();
  const newKey = inputApiKey.value.trim();
  let newModel = selectModel.value;

  if (selectProviderPreset && selectProviderPreset.value === 'gemini') {
    if (!newBaseUrl || newBaseUrl.includes('127.0.0.1') || newBaseUrl.includes('localhost')) {
      newBaseUrl = DEFAULT_GEMINI_URL;
      inputBaseUrl.value = DEFAULT_GEMINI_URL;
    }
  } else if (!newBaseUrl) {
    newBaseUrl = DEFAULT_GEMINI_URL;
  }

  if (newModel === 'custom') {
    const customName = inputCustomModel.value.trim();
    if (!customName) {
      showSettingsFeedback('Harap ketik nama model khusus di kolom Nama Model Khusus.', 'error');
      inputCustomModel.focus();
      return;
    }
    newModel = customName;
  }

  // Warning if attempting to use localhost
  if ((newBaseUrl.includes('127.0.0.1') || newBaseUrl.includes('localhost')) && selectProviderPreset?.value !== 'freellmapi') {
    selectProviderPreset.value = 'freellmapi';
    updatePresetUI('freellmapi');
  }

  await mentor.setConfig(newBaseUrl, newKey, newModel);

  showSettingsFeedback('Pengaturan berhasil disimpan!', 'success');
  setTimeout(() => {
    settingsModal.classList.add('hidden');
    settingsFeedback.classList.add('hidden');
  }, 1000);
}

function showSettingsFeedback(msg, type) {
  settingsFeedback.textContent = msg;
  settingsFeedback.className = `feedback-msg ${type}`;
  settingsFeedback.classList.remove('hidden');
}

// Start
init();
