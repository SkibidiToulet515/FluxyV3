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
