/**
 * EAS/Linux: npm does not preserve execute bits on hermesc; Gradle then fails to start the process.
 */
const fs = require('fs');
const path = require('path');

if (process.platform === 'win32') {
  process.exit(0);
}

const roots = [
  path.join(__dirname, '..', 'node_modules', 'hermes-compiler', 'hermesc'),
  path.join(__dirname, '..', 'node_modules', 'react-native', 'sdks', 'hermesc'),
];

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const dir of fs.readdirSync(root)) {
    const bin = path.join(root, dir, 'hermesc');
    if (fs.existsSync(bin)) {
      fs.chmodSync(bin, 0o755);
    }
  }
}
