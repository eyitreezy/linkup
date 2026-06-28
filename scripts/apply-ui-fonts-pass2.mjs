/**
 * Second pass: single-line style objects `{ fontSize: 12, fontWeight: '700', color: x }`
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'lib'];

const SKIP = [/fontFamily:\s*['"]monospace['"]/, /Platform\.select/];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(tsx?)$/.test(name)) acc.push(full);
  }
  return acc;
}

function fontToken(w) {
  const n = parseInt(String(w).replace(/['"]/g, ''), 10);
  if (n >= 800) return 'fonts.bold';
  if (n >= 600) return 'fonts.medium';
  return 'fonts.regular';
}

function ensureImport(content) {
  if (/import\s*\{[^}]*\bfonts\b/.test(content)) return content;
  const m = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]@\/constants\/theme['"]/);
  if (m) {
    const inner = m[1].trim();
    const next = inner.endsWith(',') ? `${inner} fonts` : `${inner}, fonts`;
    return content.replace(m[0], `import { ${next} } from '@/constants/theme'`);
  }
  const li = content.lastIndexOf('\nimport ');
  const at = li === -1 ? 0 : content.indexOf('\n', li + 1) + 1;
  return content.slice(0, at) + "import { fonts } from '@/constants/theme';\n" + content.slice(at);
}

function process(content) {
  let changed = false;

  // One-line objects with fontWeight, no fontFamily
  content = content.replace(
    /([,{]\s*)([a-zA-Z0-9_]+:\s*\{)([^{}\n]+)(\})/g,
    (full, pre, open, body, close) => {
      if (!/fontWeight:/.test(body) || /fontFamily:/.test(body)) return full;
      if (SKIP.some((re) => re.test(body))) return full;
      const wm = body.match(/fontWeight:\s*(['"][^'"]+['"]|\d+)/);
      if (!wm) return full;
      changed = true;
      const token = fontToken(wm[1]);
      const trimmed = body.trimEnd().replace(/,\s*$/, '');
      return `${pre}${open}${trimmed}, fontFamily: ${token}, ${close}`;
    }
  );

  // One-line fontSize-only (TextInput), no fontWeight/fontFamily
  content = content.replace(
    /([,{]\s*)([a-zA-Z0-9_]+:\s*\{)([^{}\n]+)(\})/g,
    (full, pre, open, body, close) => {
      if (!/fontSize:/.test(body) || /fontWeight:|fontFamily:/.test(body)) return full;
      if (SKIP.some((re) => re.test(body))) return full;
      changed = true;
      const trimmed = body.trimEnd().replace(/,\s*$/, '');
      return `${pre}${open}${trimmed}, fontFamily: fonts.regular, ${close}`;
    }
  );

  if (!changed) return null;
  return ensureImport(content);
}

let n = 0;
for (const f of SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)))) {
  const raw = fs.readFileSync(f, 'utf8');
  const next = process(raw);
  if (next) {
    fs.writeFileSync(f, next);
    n++;
    console.log('pass2', path.relative(ROOT, f));
  }
}
console.log(`Pass 2: ${n} files`);
