// --- Tabs ---
const TABS = ['board', 'home', 'target', 'rappels'];

function setTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.view').forEach((view) => {
    view.hidden = view.dataset.view !== tab;
  });
  const indicator = document.querySelector('[data-indicator]');
  const index = TABS.indexOf(tab);
  indicator.style.transform = `translateX(${index * 100}%)`;
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
});

setTab('board');

// --- Photo slots (IndexedDB-backed image upload with persistence) ---
const DB_NAME = 'vision-board';
const STORE_NAME = 'photos';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getPhoto(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function savePhoto(id, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deletePhoto(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function renderPhoto(slot, blob) {
  slot.querySelectorAll('img').forEach((img) => {
    URL.revokeObjectURL(img.src);
    img.remove();
  });
  if (!blob) {
    slot.classList.remove('has-image');
    return;
  }
  const img = document.createElement('img');
  img.src = URL.createObjectURL(blob);
  img.alt = '';
  slot.prepend(img);
  slot.classList.add('has-image');
}

function initPhotoSlot(slot) {
  const id = slot.dataset.slot;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.hidden = true;
  slot.appendChild(input);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-photo';
  removeBtn.type = 'button';
  removeBtn.textContent = '×';
  removeBtn.setAttribute('aria-label', 'Retirer la photo');
  slot.appendChild(removeBtn);

  getPhoto(id).then((blob) => renderPhoto(slot, blob));

  slot.addEventListener('click', (e) => {
    if (e.target === removeBtn) return;
    input.click();
  });

  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    await savePhoto(id, file);
    renderPhoto(slot, file);
    input.value = '';
  });

  removeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await deletePhoto(id);
    renderPhoto(slot, null);
  });

  slot.addEventListener('dragover', (e) => {
    e.preventDefault();
    slot.classList.add('drag-over');
  });

  slot.addEventListener('dragleave', () => {
    slot.classList.remove('drag-over');
  });

  slot.addEventListener('drop', async (e) => {
    e.preventDefault();
    slot.classList.remove('drag-over');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    await savePhoto(id, file);
    renderPhoto(slot, file);
  });
}

document.querySelectorAll('.photo-slot').forEach(initPhotoSlot);

// --- Quotes (editable, persisted in localStorage) ---
const QUOTES_KEY = 'vision-board-quotes';
const ACCENT_CYCLE = ['#e0447a', '#7a5cd6', '#d98324', '#2f8f83'];

const DEFAULT_QUOTES = [
  { id: 'q1', text: "T'as deux choix : rester allongée et continuer de rêver, ou bien te lever, bosser et réaliser tes rêves.", accent: '#e0447a' },
  { id: 'q2', text: "Ton anxiété, c'est ce que t'as commencé et pas terminé. Poursuis ton potentiel.", accent: '#7a5cd6' },
  { id: 'q3', text: "Ta psy t'a dit que tu dois faire des activités stimulantes pour ton cerveau sinon tu rumines. Bosser, c'est littéralement obligatoire pour ta santé mentale.", accent: '#d98324' },
  { id: 'q4', text: "Pense aux idols coréennes, tu les vois procrastiner ? C'est des bosseurs, sois comme eux. Regarde Yujin.", accent: '#2f8f83' },
  { id: 'q5', text: "T'es pas trop vieille, plein de gens sont plus vieux que toi et commencent tout juste.", accent: '#e0447a' },
  { id: 'q6', text: "T'as vécu des épreuves et fait quelques erreurs mais ça t'a beaucoup appris, et sans ça t'aurais pas évolué.", accent: '#7a5cd6' },
  { id: 'q7', text: "T'inquiète pas de la concurrence, t'es unique en ton genre, aie confiance.", accent: '#d98324' },
  { id: 'q8', text: "Pas besoin d'être parfaite. Pas besoin de tout comprendre. Pas besoin de tout guérir. Pas besoin de s'éprouver.", accent: '#2f8f83' },
];

function loadQuotes() {
  try {
    const raw = localStorage.getItem(QUOTES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore malformed storage, fall back to defaults
  }
  return DEFAULT_QUOTES.slice();
}

function saveQuotes() {
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}

function selectAllText(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

let quotes = loadQuotes();
let editingQuotes = false;

const quotesList = document.querySelector('[data-quotes-list]');
const editToggle = document.querySelector('[data-edit-toggle]');
const addQuoteBtn = document.querySelector('[data-add-quote]');

function renderQuotes() {
  quotesList.classList.toggle('editing', editingQuotes);
  quotesList.innerHTML = '';

  quotes.forEach((q) => {
    const bq = document.createElement('blockquote');
    bq.style.setProperty('--accent', q.accent);
    bq.dataset.id = q.id;

    const openMark = document.createElement('span');
    openMark.className = 'quote-mark quote-open';
    openMark.innerHTML = '&ldquo;';

    const p = document.createElement('p');
    p.textContent = q.text;
    p.contentEditable = editingQuotes ? 'true' : 'false';

    p.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        p.blur();
      }
    });

    p.addEventListener('blur', () => {
      const val = p.textContent.trim();
      if (val) {
        if (val !== q.text) {
          q.text = val;
          saveQuotes();
        }
      } else {
        p.textContent = q.text;
      }
    });

    const closeMark = document.createElement('span');
    closeMark.className = 'quote-mark quote-close';
    closeMark.innerHTML = '&rdquo;';

    bq.append(openMark, p, closeMark);

    if (editingQuotes) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'quote-delete';
      del.textContent = '×';
      del.setAttribute('aria-label', 'Supprimer la citation');
      del.addEventListener('click', () => {
        quotes = quotes.filter((item) => item.id !== q.id);
        saveQuotes();
        renderQuotes();
      });
      bq.appendChild(del);
    }

    quotesList.appendChild(bq);
  });
}

function addQuote() {
  const accent = ACCENT_CYCLE[quotes.length % ACCENT_CYCLE.length];
  const q = { id: 'q' + Date.now(), text: 'Nouvelle citation', accent };
  quotes.push(q);
  saveQuotes();
  renderQuotes();

  const p = quotesList.querySelector(`blockquote[data-id="${q.id}"] p`);
  if (p) {
    p.focus();
    selectAllText(p);
  }
}

editToggle.addEventListener('click', () => {
  editingQuotes = !editingQuotes;
  editToggle.textContent = editingQuotes ? 'Terminé' : 'Modifier les citations';
  editToggle.classList.toggle('active', editingQuotes);
  addQuoteBtn.hidden = !editingQuotes;
  renderQuotes();
});

addQuoteBtn.addEventListener('click', addQuote);

renderQuotes();
