/**
 * Adds fontFamily from constants/theme.ts to text styles that lack one.
 * Skips admin/debug monospace styles. Run: node scripts/apply-ui-fonts.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SCAN_DIRS = ['app', 'components', 'lib'];

const SKIP_FONT_FAMILY_PATTERNS = [
  /fontFamily:\s*['"]monospace['"]/,
  /fontFamily:\s*Platform\.select/,
  /fontFamily:\s*['"]Menlo['"]/,
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      walk(full, acc);
    } else if (/\.(tsx?)$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

function fontTokenForWeight(weightStr) {
  const n = parseInt(String(weightStr).replace(/['"]/g, ''), 10);
  if (Number.isNaN(n)) return 'fonts.regular';
  if (n >= 800) return 'fonts.bold';
  if (n >= 600) return 'fonts.medium';
  return 'fonts.regular';
}

function ensureFontsImport(content) {
  if (/import\s*\{[^}]*\bfonts\b[^}]*\}\s*from\s*['"]@\/constants\/theme['"]/.test(content)) {
    return content;
  }

  const themeImport = content.match(
    /import\s*\{([^}]+)\}\s*from\s*['"]@\/constants\/theme['"]/
  );
  if (themeImport) {
    const inner = themeImport[1].trim();
    const replacement = inner.endsWith(',') ? `${inner} fonts` : `${inner}, fonts`;
    return content.replace(themeImport[0], `import { ${replacement} } from '@/constants/theme'`);
  }

  const lastImport = content.lastIndexOf('\nimport ');
  if (lastImport === -1) {
    return `import { fonts } from '@/constants/theme';\n${content}`;
  }
  const end = content.indexOf('\n', lastImport + 1);
  const insertAt = end === -1 ? content.length : end + 1;
  return (
    content.slice(0, insertAt) +
    "import { fonts } from '@/constants/theme';\n" +
    content.slice(insertAt)
  );
}

function isMonospaceStyleBlock(block) {
  return SKIP_FONT_FAMILY_PATTERNS.some((re) => re.test(block));
}

function patchStyleObjectBody(body) {
  if (isMonospaceStyleBlock(body) || /fontFamily:/.test(body)) {
    return body;
  }

  const weightMatch = body.match(/fontWeight:\s*(['"][^'"]+['"]|\d+)/);
  if (weightMatch) {
    const indent = body.match(/\n(\s+)fontWeight:/)?.[1] ?? '    ';
    const token = fontTokenForWeight(weightMatch[1]);
    return body.replace(
      /fontWeight:\s*(['"][^'"]+['"]|\d+)\s*,?/,
      `fontWeight: ${weightMatch[1].replace(/^['"]|['"]$/g, (m) => m)},\n${indent}fontFamily: ${token},`
    );
  }

  if (/fontSize:/.test(body)) {
    const indent = body.match(/\n(\s+)fontSize:/)?.[1] ?? '    ';
    return body.replace(
      /fontSize:\s*[^,\n]+,?/,
      (m) => `${m}\n${indent}fontFamily: fonts.regular,`
    );
  }

  return body;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!/(fontSize:|fontWeight:)/.test(content)) return false;

  let changed = false;

  // StyleSheet.create({ key: { ... } }) and similar top-level style objects
  const blockRe = /([,{]\s*)([a-zA-Z0-9_]+:\s*\{)([\s\S]*?)(\n\s*\})/g;
  content = content.replace(blockRe, (full, prefix, open, body, close) => {
    const nextBody = patchStyleObjectBody(body);
    if (nextBody === body) return full;
    changed = true;
    return `${prefix}${open}${nextBody}${close}`;
  });

  // export const fooStyle = { fontSize, fontWeight }
  const exportRe = /(export const \w+ = \{)([\s\S]*?)(\};)/g;
  content = content.replace(exportRe, (full, open, body, close) => {
    if (!/(fontSize:|fontWeight:)/.test(body)) return full;
    const nextBody = patchStyleObjectBody(body);
    if (nextBody === body) return full;
    changed = true;
    return `${open}${nextBody}${close}`;
  });

  if (!changed) return false;

  content = ensureFontsImport(content);
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
let count = 0;
for (const f of files) {
  if (processFile(f)) {
    count++;
    console.log('updated', path.relative(ROOT, f));
  }
}
console.log(`Done. ${count} files updated.`);
