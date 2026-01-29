/**
 * options.js
 * Logic for the Database Viewer page with Sorting.
 */

let currentRecords = [];
let sortState = {
    field: null,
    direction: 'asc' // or 'desc'
};

document.addEventListener('DOMContentLoaded', init);

function init() {
    document.getElementById('refreshBtn').addEventListener('click', loadRecords);

    // Add sort listeners
    document.getElementById('sort-title').addEventListener('click', () => handleSort('title'));
    document.getElementById('sort-price').addEventListener('click', () => handleSort('price'));
    document.getElementById('sort-status').addEventListener('click', () => handleSort('status'));
    document.getElementById('categoryFilter').addEventListener('change', handleFilter);

    loadRecords();
}

async function loadRecords() {
    console.log('Loading records...');
    const noData = document.getElementById('noData');

    try {
        const allData = await chrome.storage.local.get(null);

        // Filter and map
        currentRecords = Object.entries(allData).filter(([key, value]) => {
            return value && value.details;
        }).map(([key, value]) => {
            return {
                id: key,
                ...value
            };
        });

        if (currentRecords.length === 0) {
            noData.style.display = 'block';
            renderTable([]);
            return;
        } else {
            noData.style.display = 'none';
        }

        // Populate Filter Dropdown
        const categories = new Set();
        currentRecords.forEach(r => {
            if (r.category) categories.add(r.category.trim());
        });

        const filterSelect = document.getElementById('categoryFilter');
        const currentSelection = filterSelect.value;
        filterSelect.innerHTML = '<option value="">Все</option>';

        Array.from(categories).sort().forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            filterSelect.appendChild(opt);
        });
        if (currentSelection && categories.has(currentSelection)) {
            filterSelect.value = currentSelection;
        }

        // Initial sort if set, or default
        if (sortState.field) {
            sortRecords();
        }

        renderTable(getFilteredRecords());

    } catch (e) {
        console.error('Error loading records:', e);
        document.querySelector('#recordsTable tbody').innerHTML = `<tr><td colspan="8" style="color:red">Ошибка загрузки: ${e.message}</td></tr>`;
    }
}

function handleFilter() {
    renderTable(getFilteredRecords());
}

function getFilteredRecords() {
    const filterVal = document.getElementById('categoryFilter').value;
    if (!filterVal) return currentRecords;

    return currentRecords.filter(r => (r.category || '').trim() === filterVal);
}

function handleSort(field) {
    if (sortState.field === field) {
        // Toggle
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.field = field;
        sortState.direction = 'asc'; // Default new sort to asc
    }

    updateHeaderIcons();
    sortRecords();
    renderTable(getFilteredRecords());
}

function updateHeaderIcons() {
    ['title', 'price', 'status'].forEach(f => {
        const th = document.getElementById(`sort-${f}`);
        if (!th) return;

        let arrow = '↕';
        if (sortState.field === f) {
            arrow = sortState.direction === 'asc' ? '↑' : '↓';
            th.style.background = '#e0e0e0'; // Highlight active sort
        } else {
            th.style.background = '#f0f0f0';
        }
        // Reset text (hacky but simple) and append arrow
        // We know the labels: Название, Цена, Статус, Категория
        const labels = { title: 'Название', price: 'Цена', status: 'Статус' };
        th.innerText = `${labels[f]} ${arrow}`;
    });
}

function sortRecords() {
    const field = sortState.field;
    const dir = sortState.direction === 'asc' ? 1 : -1;

    currentRecords.sort((a, b) => {
        let valA, valB;

        if (field === 'price') {
            // Parse "10 000 ₽" -> 10000
            valA = parseInt((a.details.price || '0').replace(/\D/g, '')) || 0;
            valB = parseInt((b.details.price || '0').replace(/\D/g, '')) || 0;
        } else if (field === 'status') {
            // Rank: good (3) > average (2) > bad (1) > unknown (0)
            const ranks = { 'good': 3, 'average': 2, 'bad': 1 };
            valA = ranks[a.status] || 0;
            valB = ranks[b.status] || 0;
        } else if (field === 'title') {
            valA = (a.details.title || '').toLowerCase();
            valB = (b.details.title || '').toLowerCase();
            return valA.localeCompare(valB) * dir;
        }

        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
    });
}

function renderTable(records) {
    const tbody = document.querySelector('#recordsTable tbody');
    tbody.innerHTML = '';

    records.forEach(record => {
        const tr = document.createElement('tr');

        // 1. Image
        const imgCell = document.createElement('td');
        if (record.details.imageSrc) {
            const img = document.createElement('img');
            img.src = record.details.imageSrc;
            img.className = 'img-preview';
            imgCell.appendChild(img);
        } else {
            imgCell.textContent = '-';
        }
        tr.appendChild(imgCell);

        // 2. Title (Link)
        const titleCell = document.createElement('td');
        const link = document.createElement('a');
        if (record.details.url) {
            link.href = record.details.url;
        } else {
            link.href = `https://www.avito.ru/${record.id}`;
        }
        link.target = '_blank';
        link.textContent = record.details.title || `Item ${record.id}`;
        titleCell.appendChild(link);
        tr.appendChild(titleCell);

        // 3. Price
        const priceCell = document.createElement('td');
        priceCell.textContent = record.details.price || '-';
        tr.appendChild(priceCell);

        // 4. Seller
        const sellerCell = document.createElement('td');
        sellerCell.textContent = record.details.seller || '-';
        tr.appendChild(sellerCell);

        // 5. Status
        const statusCell = document.createElement('td');
        statusCell.className = 'status-badge';
        const emojis = { good: '👍', average: '📌', bad: '👎' };
        statusCell.textContent = emojis[record.status] || record.status;
        tr.appendChild(statusCell);

        // 6. Category (New)
        const categoryCell = document.createElement('td');
        categoryCell.textContent = record.category || '-';
        tr.appendChild(categoryCell);

        // 7. Comment
        const commentCell = document.createElement('td');
        commentCell.textContent = record.note || '';
        commentCell.style.maxWidth = '300px';
        tr.appendChild(commentCell);

        // 8. Actions
        const actionCell = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete';
        delBtn.textContent = 'Удалить';
        delBtn.onclick = async () => {
            if (confirm('Вы уверены?')) {
                await chrome.storage.local.remove([`item_${record.id}`, `idx_${record.fingerprint}`]);
                // Note: record.id is just the id string, but keys are item_ID. 
                // Wait, previous remove code was `chrome.storage.local.remove(record.id)`. 
                // That was WRONG because we changed keys to `item_${id}` in storage.js!
                // FIXING IT HERE.

                // Oops, I need to check how renderTable constructed the record object. 
                // In loadRecords: id: key. AND key is "item_123456".
                // So record.id IS "item_123456". 
                // correct logic: remove(record.id).

                // BUT, we also want to remove `idx_${fp}`. 
                // loadRecords does NOT include idx keys in currentRecords because of filter.
                // So record.id is "item_123..."

                await chrome.storage.local.remove(record.id);
                // We should also remove the index. storage.js doesn't have a deleteAd method exposed yet?
                // For now just deleting the item is enough to hide it, but leaves garbage index.
                // Better: add deleteAd to storage.js later.

                // Remove from local array too to avoid full reload
                currentRecords = currentRecords.filter(r => r.id !== record.id);

                // Re-populate filter just in case category is gone? optimizing: skip for now.

                renderTable(getFilteredRecords());
            }
        };
        actionCell.appendChild(delBtn);
        tr.appendChild(actionCell);

        tbody.appendChild(tr);
    });
}
