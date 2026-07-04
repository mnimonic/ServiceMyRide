// Google Drive sync using the REST API and an OAuth access token.
//
// Strategy: we store a single JSON backup file named `servicemyride-backup.json`
// inside the special **appDataFolder** — a hidden, per-app folder in the user's
// Drive that other apps can't see and that doesn't clutter "My Drive". This only
// requires the narrow `drive.appdata` scope instead of full Drive access.
//
// The whole local DB document (see src/storage/db.js) is serialized and pushed
// up / pulled down as one file. Good enough for this data size; if it grows you
// can switch to per-collection files or resumable uploads.

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const BACKUP_NAME = 'servicemyride-backup.json';

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

// Find the backup file id inside appDataFolder, or null if it doesn't exist yet.
export async function findBackupFile(token) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${BACKUP_NAME}'`,
    fields: 'files(id, name, modifiedTime)',
    pageSize: '10',
  });
  const res = await fetch(`${DRIVE_FILES}?${params}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status} ${await safeText(res)}`);
  const json = await res.json();
  return (json.files && json.files[0]) || null;
}

// Upload (create or update) the backup. `data` is a JS object (the DB document).
export async function uploadBackup(token, data, existingFileId) {
  const boundary = 'gk_' + Math.random().toString(36).slice(2);
  const metadata = existingFileId
    ? {} // name/parent can't change on update; send empty metadata part
    : { name: BACKUP_NAME, parents: ['appDataFolder'] };

  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(data) + '\r\n' +
    `--${boundary}--`;

  const url = existingFileId
    ? `${DRIVE_UPLOAD}/${existingFileId}?uploadType=multipart&fields=id,modifiedTime`
    : `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,modifiedTime`;

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status} ${await safeText(res)}`);
  return res.json(); // { id, modifiedTime }
}

// Download and parse the backup content for a given file id.
export async function downloadBackup(token, fileId) {
  const res = await fetch(`${DRIVE_FILES}/${fileId}?alt=media`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status} ${await safeText(res)}`);
  return res.json();
}

// Fetch the signed-in user's basic profile (name, email, picture).
export async function fetchUserInfo(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Userinfo failed: ${res.status}`);
  return res.json(); // { sub, name, email, picture }
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}
