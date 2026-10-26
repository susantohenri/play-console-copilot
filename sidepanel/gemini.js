// Universal AI Provider Client (Supports FreeLLMAPI Anthropic/OpenAI protocol, & Google Gemini)

export const DEFAULT_GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_LOCAL_URL = 'http://127.0.0.1:31415';

// Default for public/fresh installs: Google Gemini (so friends don't hit 127.0.0.1 connection errors)
export const DEFAULT_BASE_URL = DEFAULT_GEMINI_URL;
export const DEFAULT_API_KEY = '';
export const DEFAULT_MODEL = 'gemini-3.8-flash';

export const GEMINI_FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite'
];

function normalizeApiBaseUrl(baseUrl) {
  let clean = (baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  if (!clean.includes('/v1') && !clean.includes('googleapis.com')) {
    clean = `${clean}/v1`;
  }
  return clean;
}

export class GeminiMentor {
  constructor(onStatusUpdate = null) {
    this.baseUrl = DEFAULT_BASE_URL;
    this.apiKey = DEFAULT_API_KEY;
    this.model = DEFAULT_MODEL;
    this.chatHistory = [];
    this.lastAuditContext = null;
    this.onStatusUpdate = onStatusUpdate;
  }

  async init() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['apiBaseUrl', 'geminiApiKey', 'geminiModel'], (result) => {
        if (result.apiBaseUrl !== undefined && result.apiBaseUrl !== '') {
          this.baseUrl = result.apiBaseUrl.trim();
        } else {
          this.baseUrl = DEFAULT_BASE_URL;
        }

        if (result.geminiApiKey !== undefined && result.geminiApiKey !== '') {
          this.apiKey = result.geminiApiKey;
        } else {
          this.apiKey = DEFAULT_API_KEY;
        }

        if (result.geminiModel) {
          this.model = result.geminiModel;
        } else {
          this.model = DEFAULT_MODEL;
        }

        resolve();
      });
    });
  }

  isGoogleGemini() {
    return (this.baseUrl || '').toLowerCase().includes('generativelanguage.googleapis.com');
  }

  async setConfig(baseUrl, apiKey, model) {
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).trim();
    this.apiKey = (apiKey || '').trim();
    this.model = (model || 'auto').trim();

    return new Promise((resolve) => {
      chrome.storage.local.set({
        apiBaseUrl: this.baseUrl,
        geminiApiKey: this.apiKey,
        geminiModel: this.model
      }, resolve);
    });
  }

  /**
   * Dynamically fetch available models from the configured Base URL
   */
  static async fetchAvailableModels(baseUrl, apiKey) {
    const cleanUrl = normalizeApiBaseUrl(baseUrl || DEFAULT_BASE_URL);
    const isGoogle = cleanUrl.toLowerCase().includes('googleapis.com');

    try {
      if (isGoogle) {
        if (!apiKey) {
          return GEMINI_FALLBACK_MODELS;
        }
        const url = `${cleanUrl}/models?key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();
        if (Array.isArray(data.models)) {
          return data.models
            .filter(m => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
            .map(m => (m.name || m.id).replace('models/', ''));
        }
        return GEMINI_FALLBACK_MODELS;
      } else {
        // FreeLLMAPI / OpenAI-compatible endpoint
        const url = `${cleanUrl}/models`;
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
          headers['x-api-key'] = apiKey;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();

        let modelList = [];
        if (Array.isArray(data.data)) {
          modelList = data.data.map(m => m.id);
        } else if (Array.isArray(data.models)) {
          modelList = data.models.map(m => m.id || m.name);
        } else if (Array.isArray(data)) {
          modelList = data.map(m => m.id || m.name);
        }

        // Ensure 'auto' is always prioritized at the top
        if (!modelList.includes('auto')) {
          modelList.unshift('auto');
        } else {
          // move 'auto' to the front
          modelList = ['auto', ...modelList.filter(m => m !== 'auto')];
        }
        return modelList;
      }
    } catch (err) {
      if (cleanUrl.includes('127.0.0.1') || cleanUrl.includes('localhost')) {
        throw new Error('Server FreeLLMAPI lokal (127.0.0.1:31415) tidak aktif di komputermu. Pastikan aplikasinya sudah kamu jalankan, atau gunakan Google Gemini.');
      }
      if (isGoogle) {
        return GEMINI_FALLBACK_MODELS;
      }
      throw new Error(`Gagal menghubungi server (${err.message}). Periksa Base URL & API Key.`);
    }
  }

  getSystemInstruction() {
    return `Kamu adalah "Dokter Aplikasi & Mentor Pertumbuhan Android" untuk developer indie / pemula (misal baru tembus 70+ install).

ATURAN FORMAT MUTLAK (SANGAT PENTING):
1. DILARANG KERAS MENULIS PARAGRAF PANJANG! Pengguna sangat lelah membaca esai/cerita bertele-tele.
2. WAJIB MENGGUNAKAN "LIST OF BULLETS" (poin-poin bertingkat) yang mudah di-scan dalam 5 detik.
3. Maksimal 1 sampai 2 kalimat pendek per baris bullet.
4. Selalu TEBALKAN angka, metrik, kata kunci, dan label penting (contoh: **54 install**, **26.5% konversi**, **Google Play Search**).
5. Format checklist gunakan format markdown: "* [ ] **Nama Aksi**: Keterangan 1 kalimat".

MISI UTAMAMU:
1. Menampilkan rincian dari MANA JALUR/SUMBER TRAFIK orang datang menginstall (Search, Explore, Referral/Link luar, Ads) beserta angka dan kata kuncinya.
2. Mendiagnosa kebocoran pengguna (kenapa install banyak tapi aktif sedikit) tanpa bertele-tele.
3. Memberikan to-do list berprioritas tajam (P1, P2, P3).`;
  }

  /**
   * Main synthesis call: Takes aggregated tour data and produces comprehensive story & action plan
   */
  async synthesizeTourReport(auditData) {
    this.lastAuditContext = auditData;

    const prompt = `Berikut adalah data hasil penjelajahan di Google Play Console untuk aplikasi "${auditData.appName || 'Aplikasi'}":

${JSON.stringify(auditData, null, 2)}

Sajikan hasil analisa dengan FORMAT RINGKAS & LIST OF BULLETS berikut (JANGAN BIKIN PARAGRAF PANJANG):

### 📊 1. Ringkasan Angka Kunci
* 📥 **Total Download**: [angka] install | **Aktif Saat Ini**: [angka] HP ([%] dari total)
* 🚪 **Pintu Masuk Utama**: [Jalur utama] ([%] dari seluruh trafik)
* ⚡ **Kesehatan Mesin**: [Aman / Ada crash di perangkat tertentu]

### 🧭 2. Rincian Jalur Trafik (Dari Mana User Datang?)
* 🔍 **Pencarian Google Play (Search)**:
  * ↳ **[Jumlah] install** ([%] konversi)
  * ↳ **Kata Kunci Teratas**: "[kata kunci 1]" ([n] install), "[kata kunci 2]" ([n] install)
* 🌐 **Penjelajahan / Rekomendasi (Explore)**:
  * ↳ **[Jumlah] install** ([%] konversi) — Dari rekomendasi aplikasi serupa
* 🔗 **Tautan Luar / Referal**:
  * ↳ **[Jumlah] install** ([%] konversi) — Dari link medsos/share langsung

### 🧩 3. Diagnosa Cepat (Kenapa Banyak yang Uninstall?)
* ⚠️ **Masalah Utama**: [1 kalimat jelas]
* 💡 **Akar Masalah**: [1 kalimat jelas menghubungkan data mesin/ulasan]

### 🎯 4. Rencana Aksi Hari Ini (Checklist Berprioritas)
🔴 **P1 (Kritis - Hari Ini)**:
* [ ] **[Aksi Konkret 1]**: [alasan 1 kalimat]

🟡 **P2 (Penting - Minggu Ini)**:
* [ ] **[Aksi Konkret 2]**: [alasan 1 kalimat]

🟢 **P3 (Penyempurnaan - Santai)**:
* [ ] **[Aksi Konkret 3]**: [alasan 1 kalimat]`;

    const response = await this.dispatchApiCall([
      { role: 'user', parts: [{ text: prompt }] }
    ]);

    this.chatHistory = [
      { role: 'user', parts: [{ text: `Konteks audit aplikasi: ${JSON.stringify(auditData)}` }] },
      { role: 'model', parts: [{ text: response }] }
    ];

    return response;
  }

  /**
   * Follow-up chat method
   */
  async askQuestion(userMessage) {
    if (!this.chatHistory || this.chatHistory.length === 0) {
      if (this.lastAuditContext) {
        this.chatHistory.push({
          role: 'user',
          parts: [{ text: `Konteks audit aplikasi: ${JSON.stringify(this.lastAuditContext)}` }]
        });
      }
    }

    this.chatHistory.push({
      role: 'user',
      parts: [{ text: `${userMessage}\n\n(Penting: Jawab secara ringkas menggunakan format list of bullets, tebalkan angka dan metrik penting, jangan buat paragraf panjang).` }]
    });

    try {
      const response = await this.dispatchApiCall(this.chatHistory);
      this.chatHistory.push({
        role: 'model',
        parts: [{ text: response }]
      });
      return response;
    } catch (err) {
      this.chatHistory.pop();
      throw err;
    }
  }

  /**
   * Dispatches call to FreeLLMAPI / Anthropic / OpenAI / Gemini
   */
  async dispatchApiCall(contents) {
    if (this.isGoogleGemini()) {
      return await this.callGeminiWithFallback(contents);
    } else {
      return await this.callFreeLLMAPIOrOpenAI(contents);
    }
  }

  /**
   * FreeLLMAPI Dual-Engine: Tries Anthropic Messages format first (Claude Code style), falls back to OpenAI format
   */
  async callFreeLLMAPIOrOpenAI(contents) {
    const cleanUrl = normalizeApiBaseUrl(this.baseUrl);

    const messages = contents.map(c => ({
      role: c.role === 'model' ? 'assistant' : c.role,
      content: c.parts.map(p => p.text).join('\n')
    }));

    try {
      // Method 1: Try Anthropic /messages format (FreeLLMAPI native for Claude Code)
      try {
        const anthropicUrl = `${cleanUrl}/messages`;
        const res = await fetch(anthropicUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'Authorization': `Bearer ${this.apiKey}`,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.model || 'auto',
            max_tokens: 4096,
            system: this.getSystemInstruction(),
            messages: messages
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.content) && data.content[0]?.text) {
            return data.content[0].text;
          }
        }
      } catch (e) {
        console.warn('Anthropic protocol failed, trying OpenAI protocol...', e.message);
      }

      // Method 2: Try OpenAI /chat/completions format
      const openaiUrl = `${cleanUrl}/chat/completions`;
      const openAiMessages = [
        { role: 'system', content: this.getSystemInstruction() },
        ...messages
      ];

      const resOpenAI = await fetch(openaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({
          model: this.model || 'auto',
          messages: openAiMessages,
          temperature: 0.7
        })
      });

      if (!resOpenAI.ok) {
        const errorJson = await resOpenAI.json().catch(() => ({}));
        const errorMsg = errorJson.error?.message || errorJson.message || `HTTP ${resOpenAI.status}: ${resOpenAI.statusText}`;
        throw new Error(`AI Server Error: ${errorMsg}`);
      }

      const data = await resOpenAI.json();
      const reply = data.choices?.[0]?.message?.content;
      if (!reply) {
        throw new Error('API tidak mengembalikan konten jawaban.');
      }

      return reply;
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        if (cleanUrl.includes('127.0.0.1') || cleanUrl.includes('localhost')) {
          throw new Error('Koneksi ke 127.0.0.1:31415 gagal. Server FreeLLMAPI tidak aktif di komputer ini. Jika kamu teman yang menginstall ekstensi ini, silakan buka Pengaturan (⚙️) lalu pilih Google Gemini API (gratis)!');
        }
        throw new Error(`Gagal menghubungi server AI (${cleanUrl}). Periksa koneksi internet.`);
      }
      throw err;
    }
  }

  /**
   * Google Gemini Fallback Cascade
   */
  async callGeminiWithFallback(contents) {
    const candidateModels = [this.model, ...GEMINI_FALLBACK_MODELS.filter(m => m !== this.model)];
    let lastError = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const currentCandidate = candidateModels[i];
      try {
        if (i > 0 && this.onStatusUpdate) {
          this.onStatusUpdate(`⚠️ Model sebelumnya sedang padat. Beralih ke model cadangan: ${currentCandidate}...`);
        }

        const result = await this.executeSingleGeminiCall(currentCandidate, contents);
        this.model = currentCandidate;
        return result;
      } catch (err) {
        lastError = err;
        const msg = (err.message || '').toLowerCase();
        const isTemporary = msg.includes('high demand') || msg.includes('429') || msg.includes('503') || msg.includes('overloaded');

        console.warn(`[GeminiMentor] Model ${currentCandidate} failed: ${err.message}. ${isTemporary ? 'Trying fallback...' : ''}`);
        await new Promise(r => setTimeout(r, 600));
      }
    }

    throw new Error(`Semua model sedang sibuk: ${lastError?.message}`);
  }

  async executeSingleGeminiCall(modelName, contents) {
    const cleanUrl = this.baseUrl.replace(/\/+$/, '');
    const url = `${cleanUrl}/models/${modelName}:generateContent?key=${this.apiKey}`;

    const body = {
      systemInstruction: {
        parts: [{ text: this.getSystemInstruction() }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2500
      }
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const errorMsg = errorJson.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      if (!candidate || !candidate.content?.parts?.[0]?.text) {
        throw new Error('API tidak mengembalikan teks jawaban.');
      }

      return candidate.content.parts[0].text;
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        throw new Error('Gagal terhubung ke Google Gemini API. Periksa koneksi internetmu atau pastikan API Key sudah benar.');
      }
      throw err;
    }
  }
}
