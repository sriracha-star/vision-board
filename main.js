// --- Tabs ---
const TABS = ['home', 'target', 'rappels'];

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

setTab('home');

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
