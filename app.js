// URL API disembunyikan melalui proxy backend (Vercel Serverless Function)
const API_URL = '/api/proxy';
const IMAGE_PROXY_URL = '/api/image'; // Proxy untuk gambar dari core.akun.vip

let allTransactions = [];
let isDataLoaded = false;
let currentPage = 1;
const itemsPerPage = 10;

const CATEGORIES = [
    "Kebutuhan Pokok",
    "Kebutuhan Bayi",
    "Tempat Tinggal",
    "Transportasi",
    "Gaya Hidup & Hiburan",
    "Sosial & Tak Terduga"
];

const KEYWORDS = {
    "Kebutuhan Pokok": ["beras", "minyak", "telur", "sayur", "lauk", "bumbu", "belanja bulanan", "pasar", "alfamart", "indomaret", "makan", "nasi", "galon", "aqua"],
    "Kebutuhan Bayi": ["pampers", "susu", "popok", "bubur bayi", "diaper", "mamy poko", "sweety", "merries"],
    "Tempat Tinggal": ["listrik", "air", "token", "sampah", "iuran", "pbb", "sewa", "kost", "wifi", "indihome"],
    "Transportasi": ["bensin", "pertalite", "pertamax", "ojek", "grab", "gojek", "parkir", "service", "ganti oli", "ban", "tambal"],
    "Gaya Hidup & Hiburan": ["cilok", "seblak", "kopi", "jajan", "nonton", "netflix", "boker", "topup", "game", "shopee", "tiktok", "pulsa"],
    "Sosial & Tak Terduga": ["sumbangan", "kondangan", "sedekah", "obat", "sakit", "darurat", "rumah sakit", "apotek", "infak"]
};

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEventListeners();
    updateDateTime();
});

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateStr = now.toLocaleDateString('id-ID', options);
    const dateEl = document.getElementById('currentDateText');
    if (dateEl) dateEl.textContent = dateStr;

    const hours = now.getHours();
    let greeting = 'Halo, Admin 👋';
    if (hours < 12) greeting = 'Selamat Pagi, Admin ☀️';
    else if (hours < 15) greeting = 'Selamat Siang, Admin 🌤️';
    else if (hours < 18) greeting = 'Selamat Sore, Admin 🌅';
    else greeting = 'Selamat Malam, Admin 🌙';

    const greetingEl = document.getElementById('greetingText');
    if (greetingEl) greetingEl.textContent = greeting;
}

async function init() {
    toggleLoading(true);
    toggleSummaryLoading(true);
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();

        if (json.status === 'success') {
            processData(json.data);
            isDataLoaded = true;
        } else {
            console.error('API Error:', json.message);
        }
    } catch (error) {
        console.warn('Fetch failed:', error);
    } finally {
        toggleLoading(false);
        toggleSummaryLoading(false);
    }
}

function processData(data) {
    const pengeluaran = data.pengeluaran || [];
    const saldo = data.saldo || {};

    // Update Totals
    const totalPengeluaranEl = document.getElementById('totalPengeluaran');
    if (totalPengeluaranEl) {
        totalPengeluaranEl.textContent = saldo.total_pengeluaran !== undefined ? formatRupiah(saldo.total_pengeluaran) : 'Rp 0';
    }
    document.getElementById('totalTransaksiCount').textContent = pengeluaran.length;

    // Filter data pengeluaran bulan ini
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const parseDate = (dateStr) => {
        if (!dateStr) return new Date();
        return new Date(dateStr.replace(' ', 'T'));
    };

    const monthlyItems = pengeluaran.filter(item => {
        const date = parseDate(item.created_at);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const monthlyExpense = monthlyItems.reduce((acc, item) => acc + (parseInt(item.jumlah) || 0), 0);

    // Rata-rata Harian
    let dailyAverage = 0;
    if (monthlyItems.length > 0) {
        const activeDays = new Set();
        monthlyItems.forEach(item => {
            const date = parseDate(item.created_at);
            activeDays.add(date.toDateString());
        });
        if (activeDays.size > 0) dailyAverage = monthlyExpense / activeDays.size;
    }

    document.getElementById('totalPengeluaranBulanIni').textContent = formatRupiah(monthlyExpense);
    document.getElementById('rataRataPengeluaranHarian').textContent = formatRupiah(dailyAverage);

    // Last Transaction Banner
    if (pengeluaran.length > 0) {
        const last = pengeluaran[0];
        document.getElementById('lastTransactionAmount').textContent = formatRupiah(last.jumlah);
        document.getElementById('lastTransactionDate').textContent = `${last.keperluan} • ${last.tanggal_formatted}`;
    }

    // Sort Transactions
    allTransactions = [...pengeluaran].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    currentPage = 1;
    renderTransactions();
}

function renderTransactions() {
    const listContainer = document.getElementById('transactionsList');
    const paginationContainer = document.getElementById('paginationControls');
    const searchVal = document.getElementById('searchInput').value.toLowerCase();

    listContainer.innerHTML = '';
    paginationContainer.classList.add('hidden');

    const filtered = allTransactions.filter(t => {
        const text = (t.keperluan || t.keterangan || t.user_nama || '').toLowerCase();
        return text.includes(searchVal);
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; margin-bottom: 15px; opacity: 0.3;"></i>
                <p>Tidak ada transaksi ditemukan.</p>
            </div>
        `;
        return;
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

    paginatedItems.forEach(t => {
        const title = t.keperluan || 'Pengeluaran';
        const user = t.user_nama;
        const amount = formatRupiah(t.jumlah);

        let imageBtn = '';
        if (t.link_foto) {
            let rawPath = t.link_foto;
            if (rawPath.includes('iili.io/')) {
                const parts = rawPath.split('iili.io/');
                if (parts.length > 1) rawPath = 's/' + btoa(parts[1]);
            }
            const photoUrl = `${IMAGE_PROXY_URL}?path=${encodeURIComponent(rawPath)}`;
            imageBtn = `<div class="photo-badge" onclick="showImage('${photoUrl}', '${title}')"><i class="fa-solid fa-image"></i> Lihat Bukti</div>`;
        }

        const item = document.createElement('div');
        item.className = 'transaction-item';

        // AI Categorization Logic
        let category = t.kategori || predictCategory(t.keperluan || t.keterangan);

        // Category Selector UI
        let categoryOptions = CATEGORIES.map(c => `<option value="${c}" ${c === category ? 'selected' : ''}>${c}</option>`).join('');
        const categorySelector = `
            <div class="category-wrapper">
                <select class="category-select ${category ? 'has-category' : ''}" onchange="updateCategory(${t.id}, this.value)">
                    <option value="" disabled ${!category ? 'selected' : ''}>Pilih Kategori</option>
                    ${categoryOptions}
                </select>
            </div>
        `;

        item.innerHTML = `
            <div class="t-left">
                <div class="t-icon"><i class="fa-solid fa-receipt"></i></div>
                <div class="t-details">
                    <h4>${title}</h4>
                    <p>${user}</p>
                    <div class="t-meta">
                        ${imageBtn}
                        ${categorySelector}
                    </div>
                </div>
            </div>
            <div class="t-right">
                <span class="t-amount">- ${amount}</span>
                <span class="t-date">${t.tanggal_formatted}</span>
                ${t.status ? `<div class="t-status status-${t.status.toLowerCase()}">${t.status}</div>` : ''}
            </div>
        `;
        listContainer.appendChild(item);
    });

    if (totalPages > 1) {
        paginationContainer.classList.remove('hidden');
        renderPaginationControls(totalPages);
    }
}

function renderPaginationControls(totalPages) {
    const container = document.getElementById('paginationControls');
    container.innerHTML = '';

    const createBtn = (text, page, isActive = false, isDisabled = false) => {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${isActive ? 'active' : ''}`;
        btn.innerHTML = text;
        if (isDisabled) btn.disabled = true;
        else btn.onclick = () => { currentPage = page; renderTransactions(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
        return btn;
    };

    container.appendChild(createBtn('<i class="fa-solid fa-chevron-left"></i>', currentPage - 1, false, currentPage === 1));
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            container.appendChild(createBtn(i, i, i === currentPage));
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '10px';
            container.appendChild(dots);
        }
    }
    container.appendChild(createBtn('<i class="fa-solid fa-chevron-right"></i>', currentPage + 1, false, currentPage === totalPages));
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', () => {
        currentPage = 1;
        renderTransactions();
    });

    const modal = document.getElementById('imageModal');
    const closeBtn = document.querySelector('.close-modal');

    const closeModal = () => {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

function formatRupiah(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

function toggleLoading(show) {
    const loader = document.getElementById('loading');
    const list = document.getElementById('transactionsList');
    if (show) {
        loader.classList.remove('hidden');
        list.classList.add('hidden');
    } else {
        loader.classList.add('hidden');
        list.classList.remove('hidden');
    }
}

function toggleSummaryLoading(show) {
    const elements = document.querySelectorAll('.skeleton, .skeleton-small');
    elements.forEach(el => {
        if (show) {
            el.style.opacity = '0.5';
        } else {
            el.style.opacity = '1';
            el.classList.remove('skeleton', 'skeleton-small');
        }
    });
}

window.showImage = function (url, caption) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const captionText = document.getElementById('caption');

    modal.style.display = "flex";
    requestAnimationFrame(() => modal.classList.add('show'));
    captionText.textContent = caption;
    modalImg.src = url;
}

function predictCategory(text) {
    if (!text) return "";
    text = text.toLowerCase();

    for (const [category, keywords] of Object.entries(KEYWORDS)) {
        if (keywords.some(kw => text.includes(kw))) {
            return category;
        }
    }
    return "";
}

async function updateCategory(id, category) {
    try {
        const response = await fetch(`${API_URL}?endpoint=api_update_kategori.php`, {
            method: 'POST',
            body: JSON.stringify({ id, kategori: category })
        });

        const res = await response.json();
        if (res.status === 'success') {
            console.log('Category updated:', res);
            // Optional: Show toast
        } else {
            alert('Gagal mengupdate kategori: ' + res.message);
        }
    } catch (error) {
        console.error('Update category failed:', error);
        alert('Terjadi kesalahan saat mengupdate kategori');
    }
}
