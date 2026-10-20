const fs = require('fs');
const path = require('path');

function findCommands(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findCommands(fullPath);
    } else if (file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const regex = /setName\(["']([^"']+)["']\)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        console.log(match[1] + ' <- ' + fullPath);
      }
    }
  }
}

findCommands('./src/commands');