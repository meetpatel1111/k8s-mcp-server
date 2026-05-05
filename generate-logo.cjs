const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, 'assets', 'logo.png');
const outputPath = path.join(__dirname, 'src', 'assets', 'logo-base64.ts');

const logoBuffer = fs.readFileSync(logoPath);
const base64 = logoBuffer.toString('base64');
const content = `export const LOGO_BASE64 = "data:image/png;base64,${base64}";\n`;

fs.writeFileSync(outputPath, content);
console.log('Successfully generated logo-base64.ts');
