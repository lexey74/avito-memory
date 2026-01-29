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

        // Initial sort if set, or default
        if (sortState.field) {
            sortRecords();
        }

        renderTable(currentRecords);

    } catch (e) {
        console.error('Error loading records:', e);
        document.querySelector('#recordsTable tbody').innerHTML = `<tr><td colspan="7" style="color:red">Ошибка загрузки: ${e.message}</td></tr>`;
    }
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
    renderTable(currentRecords);
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
        // We know the labels: Название, Цена, Статус
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

        // 6. Comment
        const commentCell = document.createElement('td');
        commentCell.textContent = record.note || '';
        commentCell.style.maxWidth = '300px';
        tr.appendChild(commentCell);

        // 7. Actions
        const actionCell = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete';
        delBtn.textContent = 'Удалить';
        delBtn.onclick = async () => {
            if (confirm('Вы уверены?')) {
                await chrome.storage.local.remove(record.id);
                // Remove from local array too to avoid full reload
                currentRecords = currentRecords.filter(r => r.id !== record.id);
                renderTable(currentRecords);
            }
        };
        actionCell.appendChild(delBtn);
        tr.appendChild(actionCell);

        tbody.appendChild(tr);
    });
}
