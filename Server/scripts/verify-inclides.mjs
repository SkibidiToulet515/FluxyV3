/**
 * Static checks for Inclides: catalog integrity and client/server slot parity.
 * Run: npm run verify:inclides (from Server/) or root package.json script.
 */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  INCLIDES_SHOP_ITEMS,
  CATEGORY_TO_SLOT,
  slotKeyForItem,
} from '../lib/inclidesCatalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientUtilsPath = path.resolve(__dirname, '../../Client/src/lib/inclidesShopUtils.js');

const client = await import(pathToFileURL(clientUtilsPath).href);

const errors = [];

function fail(msg) {
  errors.push(msg);
}

function ok(cond, msg) {
  if (!cond) fail(msg);
}

const EXPECTED_COUNT = 32;

ok(INCLIDES_SHOP_ITEMS.length === EXPECTED_COUNT, `Expected ${EXPECTED_COUNT} shop items, got ${INCLIDES_SHOP_ITEMS.length}`);

const ids = new Set();
const byCat = {};

for (const it of INCLIDES_SHOP_ITEMS) {
  ok(it?.id && typeof it.id === 'string', `Item missing id: ${JSON.stringify(it)}`);
  ok(!ids.has(it.id), `Duplicate catalog id: ${it.id}`);
  ids.add(it.id);

  ok(it.category && CATEGORY_TO_SLOT[it.category], `Unknown category "${it?.category}" for ${it.id}`);
  byCat[it.category] = (byCat[it.category] || 0) + 1;

  const price = Number(it.price);
  ok(Number.isFinite(price) && price >= 0, `Invalid price for ${it.id}`);

  const sk = slotKeyForItem(it);
  const clientSk = client.slotKeyForCategory(it.category);
  ok(
    sk === clientSk,
    `Slot key mismatch for ${it.id}: server="${sk}" client="${clientSk}"`,
  );
}

const serverCategories = Object.keys(CATEGORY_TO_SLOT);
ok(
  client.CATEGORY_ORDER.length === serverCategories.length,
  `CATEGORY_ORDER length ${client.CATEGORY_ORDER.length} vs server ${serverCategories.length}`,
);
for (const c of client.CATEGORY_ORDER) {
  ok(CATEGORY_TO_SLOT[c], `Client CATEGORY_ORDER unknown category: "${c}"`);
}
for (const c of serverCategories) {
  ok(
    client.CATEGORY_ORDER.includes(c),
    `Server category "${c}" missing from client CATEGORY_ORDER`,
  );
}

const attrs = client.slotsToEquipDataAttrs({
  frames: 'f',
  effects: 'e',
  banners: 'b',
  name_effects: 'n',
  badges: 'bd',
  profile_backgrounds: 'p',
  extras: 'x',
});
ok(attrs['data-equip-frames'] === 'f', 'slotsToEquipDataAttrs frames');
ok(attrs['data-equip-name-effects'] === 'n', 'slotsToEquipDataAttrs name_effects');

if (errors.length) {
  console.error('[verify-inclides] FAILED:\n', errors.join('\n'));
  process.exit(1);
}

console.log(
  `[verify-inclides] OK — ${INCLIDES_SHOP_ITEMS.length} items, ${serverCategories.length} categories, client/server parity.`,
);
console.log('[verify-inclides] Categories:', Object.entries(byCat).map(([k, n]) => `${k}:${n}`).join(', '));
