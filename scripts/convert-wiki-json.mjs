import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { index: '', out: '', proxy: '', base: '', catalog: '', overwrite: false };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === '--index' && next) {
      args.index = next;
      i += 1;
    } else if (key === '--out' && next) {
      args.out = next;
      i += 1;
    } else if (key === '--proxy' && next) {
      args.proxy = next;
      i += 1;
    } else if (key === '--base' && next) {
      args.base = next;
      i += 1;
    } else if (key === '--catalog' && next) {
      args.catalog = next;
      i += 1;
    } else if (key === '--overwrite') {
      args.overwrite = true;
    }
  }
  return args;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || '');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toProxyUrl(proxy, url) {
  if (!proxy) return url;
  if (proxy.includes('{url}')) {
    return proxy.replace('{url}', encodeURIComponent(url));
  }
  return `${proxy}${encodeURIComponent(url)}`;
}

async function fetchJson(url, proxy) {
  const target = toProxyUrl(proxy, url);
  const res = await fetch(target);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText} (${url})`);
  }
  return res.json();
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function readJsonSource(source, proxy) {
  if (isHttpUrl(source)) {
    return fetchJson(source, proxy);
  }
  return readJsonFile(source);
}

function normalizeWikiData(raw, fallbackId) {
  if (raw?.data?.item) return raw;
  if (raw?.item) {
    return {
      code: raw.code ?? 0,
      message: raw.message ?? 'OK',
      timestamp: raw.timestamp ?? String(Math.floor(Date.now() / 1000)),
      data: { item: raw.item },
    };
  }
  if (raw?.data && raw?.data?.itemId) {
    return {
      code: raw.code ?? 0,
      message: raw.message ?? 'OK',
      timestamp: raw.timestamp ?? String(Math.floor(Date.now() / 1000)),
      data: { item: raw.data },
    };
  }
  if (raw?.itemId) {
    return {
      code: 0,
      message: 'OK',
      timestamp: String(Math.floor(Date.now() / 1000)),
      data: { item: raw },
    };
  }
  return {
    code: 0,
    message: 'OK',
    timestamp: String(Math.floor(Date.now() / 1000)),
    data: { item: { itemId: String(fallbackId ?? ''), ...raw } },
  };
}

function extractEntries(indexData) {
  if (Array.isArray(indexData)) return indexData;
  if (Array.isArray(indexData?.files)) return indexData.files;
  if (Array.isArray(indexData?.items)) return indexData.items;
  if (Array.isArray(indexData?.data)) return indexData.data;
  if (Array.isArray(indexData?.list)) return indexData.list;
  return [];
}

function buildEntryUrl(entry, baseUrl) {
  if (entry?.url && isHttpUrl(entry.url)) return entry.url;
  if (entry?.path && isHttpUrl(entry.path)) return entry.path;
  if (entry?.id && baseUrl) return `${baseUrl}${entry.id}`;
  if (entry?.itemId && baseUrl) return `${baseUrl}${entry.itemId}`;
  if (entry?.path && baseUrl) return `${baseUrl}${entry.path}`;
  return '';
}

function deriveFileName(entry, url, index) {
  const fromEntry = entry?.name || entry?.file || entry?.filename;
  if (fromEntry) return fromEntry.endsWith('.json') ? fromEntry : `${fromEntry}.json`;
  const fromId = entry?.id || entry?.itemId;
  if (fromId) return `id${fromId}.json`;
  if (url) {
    const base = url.split('?')[0].split('#')[0];
    const last = base.split('/').pop() || `item-${index + 1}`;
    return last.endsWith('.json') ? last : `${last}.json`;
  }
  return `item-${index + 1}.json`;
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.index) {
    console.error('Missing --index');
    process.exit(1);
  }

  const outDir = args.out
    ? path.resolve(repoRoot, args.out)
    : path.resolve(repoRoot, 'temp', 'info');

  const indexData = await readJsonSource(args.index, args.proxy);
  const entries = extractEntries(indexData);
  if (!entries.length) {
    console.error('Index has no entries.');
    process.exit(1);
  }

  const outFiles = [];

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const url = buildEntryUrl(entry, args.base);
    if (!url) {
      console.warn(`Skip entry (missing url): ${JSON.stringify(entry)}`);
      continue;
    }

    const fileName = deriveFileName(entry, url, i);
    const outPath = path.join(outDir, fileName);
    if (!args.overwrite && fs.existsSync(outPath)) {
      outFiles.push({ name: fileName, path: fileName });
      continue;
    }

    try {
      const raw = await fetchJson(url, args.proxy);
      const normalized = normalizeWikiData(raw, entry?.id || entry?.itemId || i + 1);
      writeJson(outPath, normalized);
      outFiles.push({ name: fileName, path: fileName });
      console.log(`Saved: ${fileName}`);
    } catch (err) {
      console.error(`Failed: ${url}`);
      console.error(String(err));
    }
  }

  const indexOut = path.join(outDir, 'index.json');
  writeJson(indexOut, { files: outFiles });

  if (args.catalog) {
    const catalogData = await readJsonSource(args.catalog, args.proxy);
    const catalogOutDir = path.resolve(repoRoot, 'temp', 'catalog');
    ensureDir(catalogOutDir);
    writeJson(path.join(catalogOutDir, 'full.json'), catalogData);
    writeJson(path.join(catalogOutDir, 'index.json'), { files: [{ name: 'full.json', path: 'full.json' }] });
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
