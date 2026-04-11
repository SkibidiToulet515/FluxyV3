import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function uploadProfilePicture(uid, file) {
  const ext = file.name.split('.').pop();
  const storageRef = ref(storage, `avatars/${uid}.${ext}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export async function deleteProfilePicture(uid, ext = 'png') {
  const storageRef = ref(storage, `avatars/${uid}.${ext}`);
  try { await deleteObject(storageRef); } catch { /* ignore if not found */ }
}

export async function uploadChatImage(channelPath, file) {
  const id = generateId();
  const ext = file.name.split('.').pop();
  const storageRef = ref(storage, `chat/${channelPath}/${id}.${ext}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export async function uploadThumbnail(gameId, file) {
  const ext = file.name.split('.').pop();
  const storageRef = ref(storage, `thumbnails/${gameId}.${ext}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export async function uploadMedia(folder, file) {
  const id = generateId();
  const ext = file.name.split('.').pop();
  const storageRef = ref(storage, `${folder}/${id}.${ext}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

/** Upload main game HTML for a Firestore game id; returns public download URL and Storage path for cleanup. */
export async function uploadGameFile(gameId, file) {
  let base = (file.name || 'game.html').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!base) base = 'game.html';
  const safeName = /\.html?$/i.test(base) ? base : `${base}.html`;
  const path = `ugsgames/${gameId}/${safeName}`;
  const storageRef = ref(storage, path);
  const contentType = file.type && file.type !== '' ? file.type : 'text/html';
  await uploadBytes(storageRef, file, { contentType });
  const url = await getDownloadURL(storageRef);
  return { url, path };
}

export async function deleteGameFileByPath(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') return;
  const storageRef = ref(storage, storagePath);
  try {
    await deleteObject(storageRef);
  } catch {
    /* ignore missing or permission edge cases */
  }
}
