/**
 * storage.js
 * Handles data persistence and the "Smart ID" lookup logic.
 */

const STORAGE_KEY_ITEMS = 'items';
const STORAGE_KEY_INDEXES = 'indexes';

const Storage = {
    /**
     * Saves an ad's status and note.
     * Updates both the main item storage and the reverse hash index.
     * @param {string} id - The Avito item ID.
     * @param {string} fingerprint - The content hash.
     * @param {object} data - { status: 'good'|'average'|'bad', note: string }
     */
    async saveAd(id, fingerprint, data) {
        const timestamp = Date.now();
        const itemData = {
            ...data,
            timestamp,
            fingerprint
        };

        // targeted update to avoid reading/writing the whole DB if possible, 
        // but chrome.storage.local.get retrieves what we ask.
        // We'll read the current state to ensure we don't overwrite blindly if we need partial updates,
        // but here we are saving a full object for the ID.

        // We need to store:
        // items[id] = itemData
        // indexes[fingerprint] = id

        // Prepare the update object for storage.set
        const updates = {};
        updates[`${STORAGE_KEY_ITEMS}.${id}`] = itemData; // This dot notation doesn't work for top-level keys in chrome.storage.local directly like Mongo.
        // We have to manage the objects ourselves, or store each item as a separate key "item_ID".
        // Storing everything in one big "items" object might hit quota limits per key (8KB? No, unlimitedStorage).
        // But reading the whole "items" object into memory is bad if it gets huge.

        // BETTER APPROACH: Store each item as "item_{id}" and index as "idx_{fingerprint}".
        // This scales better.

        const itemKey = `item_${id}`;
        const idxKey = `idx_${fingerprint}`;

        await chrome.storage.local.set({
            [itemKey]: itemData,
            [idxKey]: id
        });

        console.log(`[AvitoMemory] Saved ${id} (${fingerprint})`);
    },

    /**
     * Retrieves ad data.
     * Implements the "Smart" lookup:
     * 1. Check by ID (O(1)).
     * 2. If missing, check by Fingerprint (O(1) via index).
     * 3. If found by fingerprint (repost), return the OLD data but indicate it's a "match".
     * @param {string} id 
     * @param {string} fingerprint 
     * @returns {Promise<{found: boolean, data: object, source: 'id'|'fingerprint'|null}>}
     */
    async findAd(id, fingerprint) {
        const itemKey = `item_${id}`;
        const idxKey = `idx_${fingerprint}`;

        // Try getting both ID and Index pointers at once
        const result = await chrome.storage.local.get([itemKey, idxKey]);

        // 1. Direct ID Match
        if (result[itemKey]) {
            return { found: true, data: result[itemKey], source: 'id' };
        }

        // 2. Fingerprint Fallback
        const oldId = result[idxKey];
        if (oldId) {
            // We found a pointer to an old ID. Let's fetch that old data.
            // Optimization: We could have stored it, but we need another round trip.
            // Or we can just trust it exists if the index exists.
            const oldItemKey = `item_${oldId}`;
            const oldResult = await chrome.storage.local.get(oldItemKey);

            if (oldResult[oldItemKey]) {
                return { found: true, data: oldResult[oldItemKey], source: 'fingerprint', originalId: oldId };
            }
        }

        return { found: false, data: null, source: null };
    },

    /**
     * Retrieves all unique categories from stored items.
     * @returns {Promise<string[]>} Sorted list of unique categories.
     */
    async getAllCategories() {
        const allData = await chrome.storage.local.get(null);
        const categories = new Set();

        for (const [key, value] of Object.entries(allData)) {
            if (key.startsWith('item_') && value.category) {
                categories.add(value.category.trim());
            }
        }

        return Array.from(categories).sort();
    }
};

// Export for use in other modules (ES modules in Chrome Ext)
// Since we are not using a bundler yet, we'll attach to the global scope or use ES modules if manifest allows.
// Manifest V3 supports ES modules in content scripts if added as modules, but it's often easier to just assign to window in simple scripts 
// or use a structured loader. 
// For simplicity in this setup without a bundler:
window.AvitoMemoryStorage = Storage;
