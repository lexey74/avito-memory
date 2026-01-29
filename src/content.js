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

/**
 * Attempts to Inject into the Main Single Item Page.
 * This is run once on load (and maybe on URL change if SPA navigation).
 */
async function injectSinglePageUI() {
    // Global Lock check
    if (isInjecting) return;

    // Check if already injected (fast check)
    if (document.getElementById('avito-memory-panel-root')) return;

    try {
        isInjecting = true;

        // 1. Check if Single Page
        // URL pattern: ..._1234567890
        // And existence of an H1 and Price block.

        // Selectors for Single Item ID.
        // Usually found in `div.style-item-view-content...` -> `div[data-item-id]`?
        // Often Avito puts the ID in `<div data-item-id="123..." ...>` at the top level of the ad parameter block.

        // Let's try to find the ID from the metadata if possible
        let itemId;
        // Single page ID is often in the URL, but let's be robust.
        const metaId = document.querySelector('[data-item-id]'); // Still risky on single page if suggestions exist


        // Better: From the URL?
        // ..._(\d+)$ is not always true, sometimes ..._(\d+)?...
        const urlMatch = window.location.pathname.match(/_(\d+)(\?|$)/);
        if (!urlMatch) return; // Not a single item page or ID not found

        itemId = urlMatch[1];

        // Check if already injected
        if (document.getElementById('avito-memory-panel-root')) return;
        // Legacy check
        if (document.getElementById('am-single-panel')) return;

        // Find injection target
        // We want it near the price or contacts.
        // `.style-item-view-price-string` or `.style-price-value...`
        // Or underneath `.style-item-view-contacts...`

        // Find injection target
        // User requested anchoring to Title or Photo.
        // Verified Marker: [data-marker="item-view/title-info"]
        const targetElement = document.querySelector('[data-marker="item-view/title-info"]');

        if (!targetElement) {
            console.log('[AvitoMemory] Title element not found.');
            return;
        }

        // Prepare Data
        // For single page, we should extract fingerprint from the whole page.
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

        // DOUBLE CHECK before insertion (in case another async call finished while we were awaiting storage)
        if (document.getElementById('avito-memory-panel-root')) return;

        panel.id = 'avito-memory-panel-root'; // Ensure ID matches our check
        // Also verify strict ID on the element itself if UI didn't set it (UI does set it, but be safe)

        // Insert AFTER the Title
        targetElement.insertAdjacentElement('afterend', panel);
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
    // Early exit if panel already exists - prevents unnecessary debounce triggers
    if (document.getElementById('avito-memory-panel-root')) {
        return;
    }

    // Debounce the injection call
    if (injectionTimeout) clearTimeout(injectionTimeout);
    injectionTimeout = setTimeout(() => {
        injectSinglePageUI();
    }, 200); // Wait 200ms for DOM to settle

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

// Run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialScan);
} else {
    initialScan();
}
