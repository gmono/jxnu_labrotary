const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve('.build/browser/public');
const destination = path.resolve('public');
for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
  fs.cpSync(path.join(source, entry.name), path.join(destination, entry.name), { recursive: true });
}
