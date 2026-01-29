/**
 * content.js
 * Main entry point. Observes DOM for ads, matches with storage, injects UI.
 */

const storage = window.AvitoMemoryStorage;
const fingerprint = window.AvitoMemoryFingerprint;
const ui = window.AvitoMemoryUI;

console.log('[AvitoMemory] Content script loaded (v2).');

const OBSERVER_CONFIG = { childList: true, subtree: true };

/**
 * Determines if the element is part of the main single item view or a list item.
 * @param {HTMLElement} element 
 * @returns {'list' | 'single'}
 */
function determineContext(element) {
    // List items now identified by [data-marker="item"]
    if (element.matches('[data-marker="item"]') || element.closest('[data-marker="item"]')) {
        return 'list';
    }

    // Default Check for single page URL
    const isSinglePageUrl = /^\/\w+\/.+_\d+($|\?)/.test(window.location.pathname) || window.location.pathname.match(/\d{9,}/);
    if (isSinglePageUrl && !element.closest('[data-marker="item"]')) {
        return 'single';
    }

    return 'list';
}

let isInjecting = false;
let injectionTimeout = null;
let currentItemId = null; // Track current item for URL change detection

/**
 * Attempts to Inject into the Main Single Item Page.
 * This is run once on load (and maybe on URL change if SPA navigation).
 */
async function injectSinglePageUI() {
    // Global Lock check
    if (isInjecting) return;

    try {
        isInjecting = true;

        // Extract item ID from URL first
        const urlMatch = window.location.pathname.match(/_(\d+)(\?|$)/);
        if (!urlMatch) return; // Not a single item page

        const itemId = urlMatch[1];

        // Update current item ID for URL monitoring
        currentItemId = itemId;

        // If panel already exists, skip
        if (document.getElementById('avito-memory-panel-root')) {
            return;
        }

        // Legacy check
        if (document.getElementById('am-single-panel')) return;

        // Find injection target
        const targetElement = document.querySelector('[data-marker="item-view/title-info"]');

        if (!targetElement) {
            console.log('[AvitoMemory] Title element not found.');
            return;
        }

        // Prepare Data
        const details = fingerprint.extract(document.body, 'single');
        const fpHash = fingerprint.generate(details);

        const checkResult = await storage.findAd(itemId, fpHash);
        const status = checkResult.found ? checkResult.data.status : null;
        const note = checkResult.found ? checkResult.data.note : '';

        // Create UI
        const panel = ui.createControlPanel(status, note, async (newStatus, newNote) => {
            await storage.saveAd(itemId, fpHash, {
                status: newStatus,
                note: newNote,
                details: details
            });
        });

        // DOUBLE CHECK before insertion
        if (document.getElementById('avito-memory-panel-root')) return;

        panel.id = 'avito-memory-panel-root';

        // Create a WRAPPER that we fully control
        // This wrapper will be inserted into DOM and Avito won't remove it
        const wrapper = document.createElement('div');
        wrapper.id = 'avito-memory-wrapper';
        wrapper.setAttribute('data-avito-memory-wrapper', 'true');
        wrapper.style.cssText = 'position: relative; z-index: 1000; pointer-events: auto;';

        // Put panel inside wrapper
        wrapper.appendChild(panel);

        // Insert wrapper AFTER the Title
        targetElement.insertAdjacentElement('afterend', wrapper);

        console.log(`[AvitoMemory] Injected Single Page UI for ${itemId}`);

    } finally {
        isInjecting = false;
    }
}


/**
 * Processes a List Item (Card).
 */
async function processListItem(element) {
    if (element.dataset.amProcessed) return;
    element.dataset.amProcessed = 'true';

    const itemId = element.dataset.itemId || element.getAttribute('data-item-id');
    if (!itemId) return;

    // For List Items, we ONLY show badge if it exists.
    // To avoid performance hit of reading EVERY item in the feed (which could be hundreds),
    // we do it. `chrome.storage.local` is fast enough for 50 items.

    // We need fingerprint too?
    // Ideally yes, to detect "Smart ID" even in list.
    // But extracting full details from list card is cheap.
    const adDetails = fingerprint.extract(element, 'card');
    const fpHash = fingerprint.generate(adDetails);

    // check storage
    const result = await storage.findAd(itemId, fpHash);

    if (result.found && result.data.status) {
        const badge = ui.createStatusBadge(result.data.status, result.data.note);
        if (badge) {
            // Position relative to the image wrapper usually
            // Verified List Item Image Wrapper: often the first child or within [data-marker="item-photo"]
            const imgWrapper = element.querySelector('[class*="photo-slider-root"]') || element.querySelector('[data-marker="item-photo"]') || element;

            // Make sure wrapper is relative
            const style = window.getComputedStyle(imgWrapper);
            if (style.position === 'static') {
                imgWrapper.style.position = 'relative';
            }

            imgWrapper.appendChild(badge);
        }
    }
}

// ---------------------------
// Observers
// ---------------------------

const observer = new MutationObserver((mutations) => {
    // 1. If wrapper exists, we are good.
    if (document.getElementById('avito-memory-wrapper')) {
        return;
    }

    // 2. If wrapper is missing, check if we SHOULD have one (are we on a single item page?)
    const urlMatch = window.location.pathname.match(/_(\d+)(\?|$)/);
    if (urlMatch) {
        const itemId = urlMatch[1];
        // If we are on the SAME item that we decided to inject previously,
        // this is likely a re-render removal. We must restore INSTANTLY.
        if (currentItemId === itemId) {
            console.log('[AvitoMemory] Panel removed by page update! Restoring immediately...');
            if (injectionTimeout) clearTimeout(injectionTimeout);
            injectSinglePageUI(); // No delay
            return;
        }
    }

    // 3. Normal Debounce for looking for new Items (List view or new page)
    if (injectionTimeout) clearTimeout(injectionTimeout);
    injectionTimeout = setTimeout(() => {
        injectSinglePageUI();
    }, 200);

    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
                // Check for list items
                // Verified List Item Selector: [data-marker="item"]
                if (node.hasAttribute('data-marker') && node.getAttribute('data-marker') === 'item') {
                    processListItem(node);
                } else if (node.hasAttribute('data-item-id') && node.classList.contains('iva-item-root')) {
                    // Fallback for older markup just in case
                    processListItem(node);
                } else {
                    // Check children
                    const listItems = node.querySelectorAll('[data-marker="item"]');
                    listItems.forEach(processListItem);
                }
            }
        }
    }
});

function initialScan() {
    injectSinglePageUI();

    const listItems = document.querySelectorAll('[data-marker="item"]');
    console.log(`[AvitoMemory] Found ${listItems.length} list items.`);
    listItems.forEach(processListItem);

    observer.observe(document.body, OBSERVER_CONFIG);
}

// Monitor URL changes for SPA navigation
let lastUrl = window.location.href;
setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        console.log('[AvitoMemory] URL changed, resetting injection state');
        lastUrl = currentUrl;
        // Clear any pending injection
        if (injectionTimeout) clearTimeout(injectionTimeout);
        // Try immediate injection on URL change
        setTimeout(() => injectSinglePageUI(), 100);
    }
}, 500);

// Run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialScan);
} else {
    initialScan();
}
