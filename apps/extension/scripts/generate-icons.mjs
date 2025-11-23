import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');
const svgPath = join(publicDir, 'icon.svg');

const sizes = [48, 128, 256];

console.log('Generating PNG icons from SVG...');

const svgBuffer = readFileSync(svgPath);

for (const size of sizes) {
  const outputPath = join(publicDir, `icon${size}.png`);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`Generated ${size}x${size} icon: icon${size}.png`);
}

console.log('Done!');
