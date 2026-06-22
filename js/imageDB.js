const IMG_DB_NAME  = 'hackathon_images_v1';
const IMG_STORE    = 'pages';

function openImageDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMG_DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IMG_STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

async function savePageImage(appId, pageIndex, dataURL) {
  const db = await openImageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE, 'readwrite');
    tx.objectStore(IMG_STORE).put(dataURL, `${appId}_p${pageIndex}`);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function loadPageImage(appId, pageIndex) {
  const db = await openImageDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IMG_STORE, 'readonly');
    const req = tx.objectStore(IMG_STORE).get(`${appId}_p${pageIndex}`);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

async function deleteAppImages(appId, maxPages = 10) {
  const db = await openImageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE, 'readwrite');
    for (let i = 0; i < maxPages; i++) {
      tx.objectStore(IMG_STORE).delete(`${appId}_p${i}`);
    }
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}
