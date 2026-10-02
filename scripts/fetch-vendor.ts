/**
 * Downloads pinned vendor ES modules into public/vendor and verifies them against
 * scripts/vendor.lock.json.
 *
 *   npm run fetch:vendor              # verify against the lockfile (CI default)
 *   npm run fetch:vendor -- --update  # re-download and rewrite the lockfile
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VENDOR_PACKAGES, rewriteImports, vendorUrl, type VendorPackage } from './vendor.config';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIR = join(ROOT, 'public', 'vendor');
const LOCK_FILE = join(ROOT, 'scripts', 'vendor.lock.json');

interface LockEntry {
  version: string;
  url: string;
  sha256: string;
}
type Lock = Record<string, LockEntry>;

const update = process.argv.includes('--update');
const sha256 = (data: string) => createHash('sha256').update(data).digest('hex');

async function readLock(): Promise<Lock> {
  if (!existsSync(LOCK_FILE)) return {};
  return JSON.parse(await readFile(LOCK_FILE, 'utf8')) as Lock;
}

async function fetchPackage(pkg: VendorPackage, lock: Lock): Promise<LockEntry> {
  const url = vendorUrl(pkg);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${pkg.name}: HTTP ${response.status} from ${url}`);

  const raw = await response.text();
  const hash = sha256(raw);
  const locked = lock[pkg.name];

  if (!update) {
    if (!locked || locked.version !== pkg.version) {
      throw new Error(`${pkg.name}@${pkg.version} is not in the lockfile. Run with --update.`);
    }
    if (locked.sha256 !== hash) {
      throw new Error(
        `${pkg.name}@${pkg.version}: sha256 mismatch\n  expected ${locked.sha256}\n  received ${hash}`,
      );
    }
  }

  await writeFile(join(VENDOR_DIR, pkg.file), rewriteImports(raw), 'utf8');
  console.log(
    `  ✓ ${pkg.name}@${pkg.version} → vendor/${pkg.file} (${(raw.length / 1024).toFixed(0)} KB)`,
  );
  return { version: pkg.version, url, sha256: hash };
}

async function main(): Promise<void> {
  await mkdir(VENDOR_DIR, { recursive: true });
  const lock = await readLock();
  console.log(`Fetching vendor modules${update ? ' (updating lockfile)' : ''}...`);

  const results = await Promise.allSettled(VENDOR_PACKAGES.map((pkg) => fetchPackage(pkg, lock)));
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length > 0) {
    for (const f of failures) console.error(`  ✗ ${(f.reason as Error).message}`);
    process.exit(1);
  }

  if (update) {
    const next: Lock = {};
    VENDOR_PACKAGES.forEach((pkg, i) => {
      next[pkg.name] = (results[i] as PromiseFulfilledResult<LockEntry>).value;
    });
    await writeFile(LOCK_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    console.log(`Updated ${LOCK_FILE}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
