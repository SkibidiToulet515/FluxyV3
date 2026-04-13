import {
  ref, uploadBytes, uploadBytesResumable,
  getDownloadURL, deleteObject,
} from 'firebase/storage';
import { storage } from './firebase';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
];
const ALLOWED_ATTACHMENT_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function validateFile(file, maxSize = MAX_FILE_SIZE, allowedTypes = null) {
  if (!file) throw new Error('No file selected');
  if (file.size > maxSize) {
    const mb = (maxSize / (1024 * 1024)).toFixed(0);
    throw new Error(`File too large. Maximum size is ${mb} MB.`);
  }
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    throw new Error(`File type "${file.type || 'unknown'}" is not allowed.`);
  }
}

export function isImageFile(file) {
  return ALLOWED_IMAGE_TYPES.includes(file.type);
}

/**
 * Upload with progress tracking.
 * Returns { url, path, cancel } where cancel() aborts the upload.
 * onProgress receives 0–100.
 */
export function uploadWithProgress(storagePath, file, onProgress) {
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

  let cancelled = false;

  const promise = new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (cancelled) return;
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        onProgress?.(pct);
      },
      (err) => {
        if (cancelled) return;
        reject(err);
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({ url, path: storagePath });
        } catch (err) {
          reject(err);
        }
      },
    );
  });

  return {
    promise,
    cancel() {
      cancelled = true;
      task.cancel();
    },
  };
}

// ─── Profile Pictures ─────────────────────────────────────────────────────────

export async function uploadProfilePicture(uid, file) {
  validateFile(file, MAX_AVATAR_SIZE, ALLOWED_IMAGE_TYPES);
  const ext = file.name.split('.').pop();
  const storageRef = ref(storage, `avatars/${uid}.${ext}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export async function deleteProfilePicture(uid, ext = 'png') {
  const storageRef = ref(storage, `avatars/${uid}.${ext}`);
  try { await deleteObject(storageRef); } catch { /* ignore */ }
}

// ─── Chat Attachments (images, files) ─────────────────────────────────────────

/**
 * Upload a chat attachment (image or document).
 * channelPath example: "dm/abc_def" or "group/xyz" or "server/s1/general"
 * Returns { promise, cancel } with progress.
 */
export function uploadChatAttachment(channelPath, file, onProgress) {
  validateFile(file, MAX_FILE_SIZE, ALLOWED_ATTACHMENT_TYPES);
  const id = generateId();
  const ext = file.name.split('.').pop() || 'bin';
  const path = `chat/${channelPath}/${id}.${ext}`;
  return uploadWithProgress(path, file, onProgress);
}

export async function uploadChatImage(channelPath, file) {
  validateFile(file, MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES);
  const id = generateId();
  const ext = file.name.split('.').pop();
  const storageRef = ref(storage, `chat/${channelPath}/${id}.${ext}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

// ─── Server / Group Icons ─────────────────────────────────────────────────────

export async function uploadServerIcon(serverId, file) {
  validateFile(file, MAX_AVATAR_SIZE, ALLOWED_IMAGE_TYPES);
  const ext = file.name.split('.').pop();
  const storageRef = ref(storage, `serverIcons/${serverId}.${ext}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export async function uploadGroupIcon(groupId, file) {
  validateFile(file, MAX_AVATAR_SIZE, ALLOWED_IMAGE_TYPES);
  const ext = file.name.split('.').pop();
  const storageRef = ref(storage, `groupIcons/${groupId}.${ext}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

// ─── Thumbnails & Media ───────────────────────────────────────────────────────

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
  try { await deleteObject(storageRef); } catch { /* ignore */ }
}

const MAX_BG_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_BG_VIDEO_SIZE = 15 * 1024 * 1024;
const ALLOWED_BG_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_BG_VIDEO = ['video/mp4', 'video/webm'];

export async function uploadUserBackground(uid, file) {
  if (!uid || !file) throw new Error('Missing uid or file');
  const isVideo = ALLOWED_BG_VIDEO.includes(file.type);
  const isImage = ALLOWED_BG_IMAGE.includes(file.type);
  if (!isVideo && !isImage) throw new Error('Unsupported file type. Use JPG, PNG, WebP, GIF, MP4, or WebM.');
  if (isImage && file.size > MAX_BG_IMAGE_SIZE) throw new Error('Image must be under 5 MB.');
  if (isVideo && file.size > MAX_BG_VIDEO_SIZE) throw new Error('Video must be under 15 MB.');
  const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'png');
  const path = `backgrounds/${uid}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);
  return { url, type: isVideo ? 'video' : 'image', path };
}

export async function deleteUserBackground(uid) {
  const exts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm'];
  for (const ext of exts) {
    try { await deleteObject(ref(storage, `backgrounds/${uid}.${ext}`)); } catch { /* ignore */ }
  }
}
