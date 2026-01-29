# Project Specification: Avito Memory Extension (Smart ID)

## 1. Project Overview
**Product:** "Avito Memory" — Chrome Browser Extension (Manifest V3).
**Target Domain:** `avito.ru`.
**Core Goal:** A local CRM that helps users mark ads (Good/Average/Bad) and leave notes.
**Key Challenge:** Sellers frequently delete and repost ads to boost visibility. This changes the technical `item_id`.
**Solution:** The extension must identify ads using a **Dual Lookup System**:
1.  **Primary:** By strict `item_id` (fast).
2.  **Fallback:** By **Content Fingerprint** (Hash of Title + Price + Seller + Image).

---

## 2. Technical Stack & Permissions
* **Manifest:** V3.
* **Storage:** `chrome.storage.local` with `unlimitedStorage` permission.
* **Permissions:**
    * `storage`
    * `host_permissions`: `["*://*.avito.ru/*", "*://*.avito.st/*"]` (The second one is required for Canvas image analysis).
* **No External Backend:** All data stays in the browser.

---

## 3. Data Architecture (The "Smart Storage")

We need to index data by both ID and Hash to handle reposts.

### JSON Schema (`chrome.storage.local`)
```json
{
  // MAIN STORAGE: Data by ID
  "items": {
    "12345678": {
      "status": "good",      // "good" | "average" | "bad"
      "note": "Call regarding Isofix",
      "timestamp": 1700000000,
      "fingerprint": "a1b2c3d4..." // The calculated hash
    }
  },

  // REVERSE INDEX: ID lookup by Hash
  "indexes": {
    "a1b2c3d4...": "12345678" 
  }
}