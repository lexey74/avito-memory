/**
 * fingerprint.js
 * Extracts ad details and generates a hash to identify the ad content.
 */

const Fingerprint = {
    /**
     * Simple string hash (DJB2 variant).
     */
    hashString(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
        }
        return (hash >>> 0).toString(16); // Return unsigned hex
    },

    /**
     * Generates a fingerprint from ad details.
     * @param {object} details - { title, price, seller, imageSrc }
     * @returns {string} - The calculated hash.
     */
    generate(details) {
        // Normalize data to avoid minor diffs (like whitespace)
        const raw = [
            (details.title || '').trim().toLowerCase(),
            (details.price || '').replace(/\D/g, ''), // Numbers only
            (details.seller || '').trim().toLowerCase(),
            // For image, we might want to strip size params if they vary, 
            // but usually the main ID in the URL is enough. 
            // Avito images: https://90.img.avito.st/image/1/1.xxxx...
            // We'll take the whole URL for now, assuming the primary image stays the same.
            (details.imageSrc || '').split('?')[0]
        ].join('|');

        return this.hashString(raw);
    },

    /**
     * Helper to extract data from a DOM element (Ad Card or Single Page).
     * Callers must provide the correct selectors context.
     */
    extract(element, type = 'card') {
        let title, price, seller, imageSrc;

        if (type === 'card') {
            // Listing Page
            title = element.querySelector('[data-marker="item-title"]')?.textContent;
            price = element.querySelector('[data-marker="item-price"]')?.textContent;
            // List items often don't have seller name easily accessible in the card without hover or extra requests
            // We'll leave seller empty for cards for now to match what we see
            seller = '';

            const imgEl = element.querySelector('img');
            imageSrc = imgEl ? imgEl.src : '';

        } else {
            // Single Item Page
            // Selectors verified:
            // Title: [data-marker="item-view/title-info"]
            // Price: [data-marker="item-view/item-price"]
            // Seller: [data-marker="seller-info/name"] (sometimes inside label, but name marker is more specific for text)

            title = document.querySelector('[data-marker="item-view/title-info"]')?.textContent;
            price = document.querySelector('[data-marker="item-view/item-price"]')?.textContent;
            seller = document.querySelector('[data-marker="seller-info/name"]')?.textContent;

            const imgEl = document.querySelector('[data-marker="image-frame/image-wrapper"] img') || document.querySelector('.image-frame-wrapper-._N3Y img') || document.querySelector('div.gallery-img-wrapper img');
            imageSrc = imgEl ? imgEl.src : '';
        }

        return {
            title,
            price,
            seller,
            imageSrc,
            url: type === 'single' ? window.location.href : element.querySelector('a')?.href || ''
        };
    }
};

window.AvitoMemoryFingerprint = Fingerprint;
