/**
 * One-off: docs/LINKUP-USER-GUIDE.md → docs/LINKUP-USER-GUIDE.docx
 * Run: node scripts/export-linkup-user-guide-docx.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  WidthType,
  AlignmentType,
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const mdPath = path.join(root, 'docs', 'LINKUP-USER-GUIDE.md');
const outPath = path.join(root, 'docs', 'LINKUP-USER-GUIDE.docx');

/** Split line into bold/plain TextRuns (handles **segments**). */
function runsFromMd(text) {
  if (!text) return [new TextRun('')];
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter((s) => s.length > 0);
  return segments.map((seg) => {
    if (seg.startsWith('**') && seg.endsWith('**')) {
      return new TextRun({ text: seg.slice(2, -2), bold: true });
    }
    let t = seg;
    t = t.replace(/\*([^*]+)\*/g, (_, inner) => inner);
    return new TextRun({ text: t, italics: /^\*[^*]+\*$/.test(seg.trim()) });
  });
}

function paragraph(children, opts = {}) {
  return new Paragraph({ children, ...opts });
}

function parseTableRows(lines, startIdx) {
  const rows = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;
    if (/^\|\s*[-:]+\s*\|/.test(line)) {
      i += 1;
      continue;
    }
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    rows.push(cells);
    i += 1;
  }
  return { rows, nextIndex: i };
}

function main() {
  const raw = fs.readFileSync(mdPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const children = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      i += 1;
      continue;
    }
    if (trimmed === '---') {
      children.push(new Paragraph({ text: '' }));
      i += 1;
      continue;
    }
    if (trimmed.startsWith('|') && trimmed.includes('|')) {
      const { rows, nextIndex } = parseTableRows(lines, i);
      if (rows.length) {
        const tableRows = rows.map(
          (cells) =>
            new TableRow({
              children: cells.map(
                (c) =>
                  new TableCell({
                    children: [new Paragraph({ children: runsFromMd(c) })],
                    width: { size: Math.floor(9000 / cells.length), type: WidthType.DXA },
                  })
              ),
            })
        );
        children.push(
          new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        children.push(new Paragraph({ text: '' }));
        i = nextIndex;
        continue;
      }
    }

    if (trimmed.startsWith('# ')) {
      children.push(
        new Paragraph({
          text: trimmed.slice(2),
          heading: HeadingLevel.TITLE,
          thematicBreak: false,
        })
      );
      i += 1;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      children.push(
        new Paragraph({
          text: trimmed.slice(3),
          heading: HeadingLevel.HEADING_1,
        })
      );
      i += 1;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      children.push(
        new Paragraph({
          text: trimmed.slice(4),
          heading: HeadingLevel.HEADING_2,
        })
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith('- ')) {
      children.push(
        new Paragraph({
          children: runsFromMd(trimmed.slice(2)),
          bullet: { level: 0 },
        })
      );
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      children.push(
        new Paragraph({
          children: runsFromMd(trimmed.replace(/^\d+\.\s+/, '')),
          numbering: { reference: 'default-numbering', level: 0 },
        })
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
      children.push(
        paragraph([new TextRun({ text: trimmed.slice(1, -1), italics: true })], {
          alignment: AlignmentType.CENTER,
        })
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith('*') && trimmed.includes('*') && trimmed.endsWith('*')) {
      children.push(paragraph(runsFromMd(trimmed)));
      i += 1;
      continue;
    }

    children.push(paragraph(runsFromMd(trimmed)));
    i += 1;
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
  });

  return Packer.toBuffer(doc).then((buf) => {
    fs.writeFileSync(outPath, buf);
    console.log('Wrote', outPath);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
