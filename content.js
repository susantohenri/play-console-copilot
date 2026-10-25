// Content script for deeply extracting metrics from Google Play Console

(function () {
  /**
   * Helper to clean text
   */
  function clean(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract basic app metadata from current URL and headers
   */
  function extractAppMetadata() {
    const url = window.location.href;
    const appMatch = url.match(/\/app\/([^\/\?#]+)/);
    const appId = appMatch ? appMatch[1] : null;

    // Try finding App Name
    let appName = '';
    const h1 = document.querySelector('h1');
    if (h1 && clean(h1.textContent)) {
      appName = clean(h1.textContent);
    } else {
      const titleElem = document.querySelector('[data-test-id="app-title"], .app-title, header span');
      if (titleElem) appName = clean(titleElem.textContent);
    }

    return {
      url,
      appId,
      appName: appName || appId || 'Aplikasi Play Store',
      pageTitle: document.title,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Specifically target Traffic Sources and Acquisition channels (Search, Explore, Referrers, Keywords)
   * Handles both English and Indonesian Play Console UI
   */
  function extractTrafficSources() {
    const trafficItems = [];
    const trafficKeywords = [
      'google play search', 'pencarian google play', 'penelusuran google play',
      'google play explore', 'penjelajahan google play',
      'third-party', 'pihak ketiga', 'referrer', 'perujuk',
      'google ads', 'iklan',
      'direct', 'langsung',
      'traffic source', 'sumber lalu lintas', 'jalur',
      'store listing acquisition', 'akuisisi listing toko', 'akuisisi',
      'store listing visitor', 'pengunjung listing toko',
      'conversion rate', 'rasio konversi', 'tingkat konversi',
      'search term', 'istilah penelusuran', 'kata kunci'
    ];

    // Find all containers containing traffic keywords
    const candidateElements = document.querySelectorAll(
      'section, [role="region"], [role="table"], [role="grid"], table, div, li'
    );

    candidateElements.forEach((el) => {
      const text = clean(el.innerText);
      if (!text || text.length > 1000 || text.length < 15) return;
      const lower = text.toLowerCase();

      // Check if it matches at least one strong traffic keyword and contains numbers
      const hasTrafficKeyword = trafficKeywords.some(k => lower.includes(k));
      const hasNumbers = /\d+/.test(text);

      if (hasTrafficKeyword && hasNumbers) {
        // Prefer row-like or card-like text
        if (text.length < 400) {
          trafficItems.push(text);
        }
      }
    });

    // Also specifically look for search terms if present
    const searchTerms = [];
    const searchTermElements = document.querySelectorAll('[data-column-id*="search"], [aria-label*="search"], [role="row"]');
    searchTermElements.forEach((el) => {
      const t = clean(el.innerText);
      if (t && t.length > 5 && t.length < 200 && /\d+/.test(t)) {
        searchTerms.push(t);
      }
    });

    return {
      trafficBreakdown: Array.from(new Set(trafficItems)).slice(0, 15),
      searchTerms: Array.from(new Set(searchTerms)).slice(0, 10)
    };
  }

  /**
   * Deep Table & Grid Row Extractor
   * Collects rows formatted as: "Col A | Col B | Col C"
   */
  function extractAllRowsAndTables() {
    const extractedRows = [];
    // Match traditional tables as well as Angular / Material grid rows
    const rowSelectors = [
      'tr',
      '[role="row"]',
      '.table-row',
      '.particle-table-row',
      '[data-row-id]',
      'div[aria-rowindex]',
      'li[role="listitem"]'
    ];

    const rowElements = document.querySelectorAll(rowSelectors.join(', '));
    rowElements.forEach((row) => {
      // Find cells inside this row
      const cellElements = row.querySelectorAll('td, th, [role="cell"], [role="columnheader"], .cell, [data-column-id]');
      let cells = [];

      if (cellElements.length > 0) {
        cells = Array.from(cellElements)
          .map(c => clean(c.innerText))
          .filter(t => t.length > 0 && t.length < 200);
      } else {
        // Fallback: direct spans/divs with text
        const children = Array.from(row.children)
          .map(c => clean(c.innerText))
          .filter(t => t.length > 0 && t.length < 200);
        if (children.length >= 2) cells = children;
      }

      // Deduplicate adjacent repeating strings
      const uniqueCells = [];
      for (const cell of cells) {
        if (uniqueCells.length === 0 || uniqueCells[uniqueCells.length - 1] !== cell) {
          uniqueCells.push(cell);
        }
      }

      if (uniqueCells.length >= 2) {
        extractedRows.push(uniqueCells.join(' | '));
      }
    });

    return Array.from(new Set(extractedRows)).slice(0, 40);
  }

  /**
   * Extract KPI Cards & Key Numbers
   */
  function extractKpiCards() {
    const cards = [];
    const cardSelectors = [
      '[role="region"]',
      '.kpi-tile',
      '.metric-card',
      'material-card',
      'section',
      '[data-test-id*="metric"]',
      '[data-test-id*="card"]',
      '.stat-card'
    ];

    const elements = document.querySelectorAll(cardSelectors.join(', '));
    elements.forEach((el) => {
      const text = clean(el.innerText);
      if (!text || text.length > 600 || text.length < 10) return;

      // Check if it contains digits and metric signals
      if (/\d+/.test(text) && (text.includes('%') || text.includes('vs') || text.includes('total') || text.length < 180)) {
        cards.push(text);
      }
    });

    return Array.from(new Set(cards)).slice(0, 15);
  }

  /**
   * Extract Visible Reviews
   */
  function extractReviews() {
    const reviews = [];
    const reviewSelectors = [
      '[data-test-id*="review"]',
      '.review-content',
      'material-expansionpanel',
      'li[role="listitem"]',
      '[role="article"]'
    ];

    const elements = document.querySelectorAll(reviewSelectors.join(', '));
    elements.forEach((el) => {
      const text = clean(el.innerText);
      if (text && (text.includes('★') || text.includes('star') || text.length > 25)) {
        if (text.length < 500) {
          reviews.push(text);
        }
      }
    });

    return Array.from(new Set(reviews)).slice(0, 10);
  }

  /**
   * Comprehensive Main Content Semantic Text (up to 20,000 characters)
   * Walks DOM of main container, avoiding navigation noise, but capturing every cell and paragraph
   */
  function extractFullMainContent() {
    const main = document.querySelector('main, [role="main"], #main-content') || document.body;
    const cloned = main.cloneNode(true);

    // Remove noise elements from clone
    const noise = cloned.querySelectorAll('nav, aside, header, footer, script, style, svg, [aria-hidden="true"]');
    noise.forEach(el => el.remove());

    const text = clean(cloned.innerText);
    // Return dense semantic text
    return text.slice(0, 20000);
  }

  /**
   * Wait for DOM Hydration / Angular rendering
   */
  function waitForHydration(timeoutMs = 4000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const spinners = document.querySelectorAll('mat-progress-bar, [role="progressbar"], .loading, .spinner, material-spinner');
        const hasContent = document.body && document.body.innerText.length > 500;

        if ((spinners.length === 0 && hasContent) || (Date.now() - startTime > timeoutMs)) {
          clearInterval(interval);
          // small settle timeout
          setTimeout(resolve, 800);
        }
      }, 300);
    });
  }

  /**
   * Scrape comprehensive data package
   */
  async function scrapeCurrentPage(checkpointName) {
    await waitForHydration(3500);

    const metadata = extractAppMetadata();
    const traffic = extractTrafficSources();
    const rows = extractAllRowsAndTables();
    const kpis = extractKpiCards();
    const reviews = extractReviews();
    const pageText = extractFullMainContent();

    return {
      checkpoint: checkpointName || 'Halaman Aktif',
      metadata,
      trafficSources: traffic.trafficBreakdown,
      searchTerms: traffic.searchTerms,
      tableRows: rows,
      kpis,
      reviews,
      pageTextSnapshot: pageText,
      timestamp: Date.now()
    };
  }

  // Runtime Message Listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PING') {
      sendResponse({ status: 'PONG', url: window.location.href });
      return true;
    }

    if (request.action === 'EXTRACT_CHECKPOINT_DATA') {
      scrapeCurrentPage(request.checkpoint)
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => {
          console.error('[Play Console Copilot] Scrape error:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep message port open for async response
    }

    if (request.action === 'GET_APP_METADATA') {
      sendResponse({ success: true, metadata: extractAppMetadata() });
      return true;
    }
  });

  console.log('[Play Console Copilot] Deep Content script initialized on:', window.location.href);
})();
