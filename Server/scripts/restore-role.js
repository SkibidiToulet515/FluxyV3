/**
 * Restore a user's role field after it was wiped by a game .set() without merge.
 *
 * Usage:
 *   node Server/scripts/restore-role.js <email> <role>
 *   node Server/scripts/restore-role.js admin@fluxyv3.online owner
 */
import 'dotenv/config';
import admin from 'firebase-admin';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('FIREBASE_PROJECT_ID not set in .env');
  process.exit(1);
}

const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT;
if (svcPath) {
  const resolved = path.resolve(import.meta.dirname, '..', svcPath);
  const serviceAccount = require(resolved);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
}

const email = process.argv[2];
const role = process.argv[3] || 'admin';
if (!email) {
  console.error('Usage: node restore-role.js <email> <role>');
  process.exit(1);
}

async function run() {
  const user = await admin.auth().getUserByEmail(email);
  const db = admin.firestore();
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();

  console.log(`User: ${email} (${user.uid})`);
  console.log(`Current doc:`, snap.exists ? snap.data() : '<missing>');

  await ref.set({ role }, { merge: true });
  console.log(`\nRole restored to: ${role}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
