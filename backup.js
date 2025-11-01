// Save the original game.js file
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'static', 'js', 'game.js');
const backupPath = path.join(__dirname, 'static', 'js', 'game.js.bak');

fs.copyFileSync(srcPath, backupPath);