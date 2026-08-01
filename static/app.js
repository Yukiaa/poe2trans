const searchInput = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('suggestions');
const resultsEl = document.getElementById('results');
const detailEl = document.getElementById('detail');
const themeToggle = document.getElementById('themeToggle');

function initTheme() {
    const saved = localStorage.getItem('poe2_theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

initTheme();

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('poe2_theme', next);
});

let currentQuery = '';
let suggestions = [];
let selectedIdx = -1;
let debounceTimer = null;

searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const q = e.target.value;
    debounceTimer = setTimeout(() => {
        currentQuery = q;
        if (q.trim() === '') {
            hideSuggestions();
            resultsEl.innerHTML = '';
            detailEl.style.display = 'none';
            return;
        }
        fetchSuggestions(q);
    }, 200);
});

searchInput.addEventListener('focus', () => {
    if (currentQuery.trim() !== '') {
        fetchSuggestions(currentQuery);
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
        hideSuggestions();
    }
});

searchInput.addEventListener('keydown', (e) => {
    const q = searchInput.value.trim();
    if (q === '') {
        if (e.key === 'Enter') {
            hideSuggestions();
            detailEl.style.display = 'none';
        }
        return;
    }

    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIdx = (selectedIdx + 1) % suggestions.length;
        highlightSuggestion();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIdx = (selectedIdx - 1 + suggestions.length) % suggestions.length;
        highlightSuggestion();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
            showDetail(suggestions[selectedIdx]);
        } else if (suggestions.length > 0) {
            showDetail(suggestions[0]);
        }
    } else if (e.key === 'Escape') {
        hideSuggestions();
    }
});

function highlightSuggestion() {
    const items = suggestionsEl.querySelectorAll('.suggestion-item');
    items.forEach((el, i) => {
        if (i === selectedIdx) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

function hideSuggestions() {
    suggestionsEl.style.display = 'none';
    selectedIdx = -1;
}

function fetchSuggestions(q) {
    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`)
        .then(r => r.json())
        .then(data => {
            suggestions = data;
            renderSuggestions(data);
        })
        .catch(err => {
            console.error(err);
        });
}

function renderSuggestions(data) {
    if (data.length === 0) {
        suggestionsEl.innerHTML = '<div class="suggestion-empty">未找到匹配的技能</div>';
        suggestionsEl.style.display = 'block';
        return;
    }

    suggestionsEl.innerHTML = data.map((s, i) => `
        <div class="suggestion-item ${i === selectedIdx ? 'active' : ''}" data-idx="${i}">
            ${s.icon ? `<img class="suggestion-icon" src="${s.icon}" alt="" onerror="this.style.display='none'">` : ''}
            <div class="suggestion-main">
                <span class="name-sc">${highlight(s.name_sc || s.name_en, currentQuery)}</span>
                <span class="name-tc">${highlight(s.name_tc || '', currentQuery)}</span>
                <span class="name-en">${highlight(s.name_en || '', currentQuery)}</span>
            </div>
            <div class="suggestion-type">${s.type}</div>
        </div>
    `).join('');

    suggestionsEl.style.display = 'block';

    suggestionsEl.querySelectorAll('.suggestion-item').forEach((el, i) => {
        el.addEventListener('mouseenter', () => {
            selectedIdx = i;
            highlightSuggestion();
        });
        el.addEventListener('click', () => {
            showDetail(suggestions[i]);
        });
    });
}

function highlight(text, query) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text;
    return text.substring(0, idx) + '<mark>' + text.substring(idx, idx + query.length) + '</mark>' + text.substring(idx + query.length);
}

let DEFAULT_NAV = [];
const NAV_STORAGE_KEY = 'poe2_nav_cards';
let navCards = [];
let navEditMode = false;

async function loadDefaultNav() {
    try {
        const res = await fetch('nav_cards.json');
        DEFAULT_NAV = await res.json();
    } catch (e) {
        DEFAULT_NAV = [];
    }
}

function loadNavCards() {
    const saved = localStorage.getItem(NAV_STORAGE_KEY);
    if (saved) {
        try {
            navCards = JSON.parse(saved);
        } catch (e) {
            navCards = [...DEFAULT_NAV];
        }
    } else {
        navCards = [...DEFAULT_NAV];
    }
}

function saveNavCards() {
    localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(navCards));
}

let dragEl = null;

function renderIcon(icon) {
    if (/^https?:\/\//i.test(icon) || /^[./]/.test(icon) || /\.(png|jpg|jpeg|gif|svg|ico|webp)$/i.test(icon)) {
        return `<img src="${escapeHtml(icon)}" alt="" onerror="this.style.display='none';this.nextSibling.style.display=''"><span style="display:none">🔗</span>`;
    }
    return escapeHtml(icon);
}

function renderNav() {
    const grid = document.getElementById('navGrid');
    grid.innerHTML = '';

    navCards.forEach((card, idx) => {
        const el = document.createElement('div');
        el.className = 'nav-card' + (navEditMode ? ' editing' : '');
        el.draggable = navEditMode;
        el.dataset.idx = idx;

        if (navEditMode) {
            el.innerHTML = `
                <div class="nav-drag-handle" title="拖动排序">⋮⋮</div>
                <div class="nav-icon">${renderIcon(card.icon)}</div>
                <div class="nav-content">
                    <div class="nav-name">${escapeHtml(card.name)}</div>
                    <div class="nav-desc">${escapeHtml(card.desc || '')}</div>
                </div>
                <button class="nav-delete" data-idx="${idx}" title="删除">✕</button>
            `;
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('nav-delete')) {
                    deleteCard(parseInt(e.target.dataset.idx));
                    return;
                }
                openEditModal(idx);
            });
        } else {
            el.innerHTML = `
                <a class="nav-card-link" href="${escapeHtml(card.url)}" target="_blank" rel="noopener">
                    <div class="nav-icon">${renderIcon(card.icon)}</div>
                    <div class="nav-content">
                        <div class="nav-name">${escapeHtml(card.name)}</div>
                        <div class="nav-desc">${escapeHtml(card.desc || '')}</div>
                    </div>
                </a>
            `;
        }

        el.addEventListener('dragstart', (e) => {
            dragEl = el;
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(idx));
        });

        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            document.querySelectorAll('.nav-card.drop-target')
                .forEach(n => n.classList.remove('drop-target'));

            if (dragEl) {
                const children = Array.from(grid.children);
                const newIdx = children.indexOf(dragEl);
                const oldIdx = parseInt(dragEl.dataset.idx);

                if (oldIdx !== newIdx) {
                    const [moved] = navCards.splice(oldIdx, 1);
                    navCards.splice(newIdx, 0, moved);
                    saveNavCards();
                }
                dragEl = null;
            }
            renderNav();
        });

        el.addEventListener('dragover', (e) => {
            if (!dragEl || dragEl === el) return;
            e.preventDefault();

            const rect = el.getBoundingClientRect();
            const after = e.clientY > rect.top + rect.height / 2;

            document.querySelectorAll('.nav-card.drop-target')
                .forEach(n => n.classList.remove('drop-target'));
            el.classList.add('drop-target');

            if (after) {
                grid.insertBefore(dragEl, el.nextSibling);
            } else {
                grid.insertBefore(dragEl, el);
            }
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
        });

        grid.appendChild(el);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function deleteCard(idx) {
    if (!confirm(`确定删除「${navCards[idx].name}」？`)) return;
    navCards.splice(idx, 1);
    saveNavCards();
    renderNav();
}

let editingNewIdx = -1;

function openEditModal(idx) {
    const isNew = idx === editingNewIdx;
    const card = isNew
        ? { icon: '🔗', name: '', desc: '', url: '' }
        : navCards[idx];
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <h3>${isNew ? '新建卡片' : '编辑卡片'}</h3>
            <label>图标 (emoji 或文字)</label>
            <input type="text" id="editIcon" value="${escapeHtml(card.icon)}" maxlength="4" placeholder="🗡️">
            <label>名称</label>
            <input type="text" id="editName" value="${escapeHtml(card.name)}" maxlength="40">
            <label>描述</label>
            <input type="text" id="editDesc" value="${escapeHtml(card.desc || '')}" maxlength="60">
            <label>链接</label>
            <input type="url" id="editUrl" value="${escapeHtml(card.url)}" placeholder="https://...">
            <div class="modal-actions">
                <button class="modal-cancel" id="modalCancel">取消</button>
                <button class="modal-save" id="modalSave">保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#modalCancel').onclick = () => {
        if (isNew) {
            editingNewIdx = -1;
        }
        close();
    };
    modal.querySelector('#modalSave').onclick = () => {
        let icon = modal.querySelector('#editIcon').value.trim();
        let name = modal.querySelector('#editName').value.trim();
        let desc = modal.querySelector('#editDesc').value.trim();
        let url = modal.querySelector('#editUrl').value.trim();
        if (!name || !url) { alert('名称和链接不能为空'); return; }
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }
        if (isNew) {
            navCards.push({ icon: icon || '🔗', name, desc, url });
            editingNewIdx = -1;
        } else {
            navCards[idx] = { icon: icon || '🔗', name, desc, url };
        }
        saveNavCards();
        renderNav();
        close();
    };
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

function toggleNavEdit() {
    navEditMode = !navEditMode;
    document.getElementById('editNavBtn').style.display = navEditMode ? 'none' : '';
    document.getElementById('addNavBtn').style.display = navEditMode ? '' : 'none';
    document.getElementById('saveNavBtn').style.display = navEditMode ? '' : 'none';
    document.getElementById('navHint').style.display = navEditMode ? '' : 'none';
    renderNav();
}

document.getElementById('editNavBtn').addEventListener('click', toggleNavEdit);
document.getElementById('saveNavBtn').addEventListener('click', toggleNavEdit);
document.getElementById('addNavBtn').addEventListener('click', () => {
    editingNewIdx = -999;
    openEditModal(editingNewIdx);
});

loadDefaultNav().then(() => {
    loadNavCards();
    renderNav();
});

function showDetail(s) {
    searchInput.value = s.name_sc;
    hideSuggestions();

    const urlCN = `https://poe2db.tw/cn/${s.id}`;
    const urlTC = `https://poe2db.tw/tw/${s.id}`;
    const urlEN = `https://poe2db.tw/us/${s.id}`;

    detailEl.style.display = 'block';
    detailEl.innerHTML = `
        <div class="detail-card">
            <div class="detail-header">
                ${s.icon ? `<img class="detail-icon" src="${s.icon}" alt="" onerror="this.style.display='none'">` : ''}
                <div class="detail-title">
                    <span class="badge">${s.type}</span>
                    ${s.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                </div>
            </div>
            <div class="detail-names">
                <div class="name-row">
                    <span class="lang-label">简体</span>
                    <span class="name">${s.name_sc}</span>
                    <a class="detail-link" href="${urlCN}" target="_blank" rel="noopener">poe2db 简体 ↗</a>
                </div>
                <div class="name-row">
                    <span class="lang-label">繁體</span>
                    <span class="name">${s.name_tc}</span>
                    <a class="detail-link" href="${urlTC}" target="_blank" rel="noopener">poe2db 繁體 ↗</a>
                </div>
                <div class="name-row">
                    <span class="lang-label">English</span>
                    <span class="name">${s.name_en}</span>
                    <a class="detail-link" href="${urlEN}" target="_blank" rel="noopener">poe2db EN ↗</a>
                </div>
            </div>
            <div class="detail-desc">
                <h3>技能描述</h3>
                <div class="desc-row">
                    <span class="lang-label">简体</span>
                    <p>${s.description_sc || s.description_en || ''}</p>
                </div>
                <div class="desc-row">
                    <span class="lang-label">繁體</span>
                    <p>${s.description_tc || s.description_en || ''}</p>
                </div>
                <div class="desc-row">
                    <span class="lang-label">English</span>
                    <p>${s.description_en || ''}</p>
                </div>
            </div>
            <div class="detail-actions">
                <span class="detail-id">ID: ${s.id}</span>
                <div class="detail-btns">
                    <a class="btn" href="${urlCN}" target="_blank" rel="noopener">简体详情</a>
                    <a class="btn" href="${urlTC}" target="_blank" rel="noopener">繁體詳情</a>
                    <a class="btn" href="${urlEN}" target="_blank" rel="noopener">English</a>
                </div>
            </div>
        </div>
    `;
}