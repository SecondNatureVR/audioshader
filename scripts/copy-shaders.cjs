/**
 * Copy shader files from shaders/ to public/shaders/ for Vite build.
 * Vite only copies public/ to dist; shaders must be in public to be deployed.
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'shaders');
const destDir = path.join(__dirname, '..', 'public', 'shaders');

const shaderFiles = [
  'star.vert', 'star.frag',
  'dilation.vert', 'dilation.frag',
  'copy.frag', 'centerBlend.frag',
  'postprocess.vert', 'postprocess.frag',
];

fs.mkdirSync(destDir, { recursive: true });
for (const file of shaderFiles) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}
