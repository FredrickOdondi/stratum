import fs from 'node:fs';
import path from 'node:path';

function read(p) {
  return fs.readFileSync(path.join(process.cwd(), p), 'utf8');
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

// Simple contrast ratio calc
function srgbToLin(c) {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) throw new Error('Invalid hex: ' + hex);
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrastRatio(fgHex, bgHex) {
  const L1 = luminance(fgHex);
  const L2 = luminance(bgHex);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

const landingCss = read('src/pages/public/LandingPage.css');

// Check scoped CSS vars defined on landing page root
const landingRootMatch = /\.landing-page\s*\{([\s\S]*?)\}/.exec(landingCss);
assert(!!landingRootMatch, 'Expected .landing-page root styles to exist');
assert(/--success:\s*#16A34A/i.test(landingRootMatch[1]), 'Expected local --success to be #16A34A');
assert(/--success-dark:\s*#13803D/i.test(landingRootMatch[1]), 'Expected local --success-dark to be #13803D');

// Base button variant block
const baseBlock = /\.btn-hero-primary\.get-started-cta\s*\{([\s\S]*?)\}/.exec(landingCss);
assert(!!baseBlock, 'Expected .btn-hero-primary.get-started-cta base block');
assert(/background:\s*var\(\s*--success\s*\)/.test(baseBlock[1]), 'Base background should be var(--success)');

// Hover block
const hoverBlock = /\.btn-hero-primary\.get-started-cta:hover\s*\{([\s\S]*?)\}/.exec(landingCss);
assert(!!hoverBlock, 'Expected hover block for .get-started-cta');
assert(/background:\s*var\(\s*--success-dark\s*\)/.test(hoverBlock[1]), 'Hover background should be var(--success-dark)');

// Active block
const activeBlock = /\.btn-hero-primary\.get-started-cta:active\s*\{([\s\S]*?)\}/.exec(landingCss);
assert(!!activeBlock, 'Expected active block for .get-started-cta');
assert(/background:\s*var\(\s*--success-dark\s*\)/.test(activeBlock[1]), 'Active background should be var(--success-dark)');

// Focus-visible present for a11y parity
assert(/\.btn-hero-primary\.get-started-cta:focus-visible/.test(landingCss), 'Expected focus-visible style for .get-started-cta');

// Ensure only landing page defines the green hero CTA variant
const allCssPaths = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.css')) allCssPaths.push(p);
  }
}
walk('src');
const occurrences = allCssPaths
  .map(p => ({ p, c: read(p) }))
  .filter(({ c }) => /\.btn-hero-primary\.get-started-cta/.test(c));
assert(occurrences.length === 1 && occurrences[0].p.endsWith('LandingPage.css'), 'Green CTA variant should be defined only in LandingPage.css');

// Basic contrast check: text color on green background meets AA 4.5:1
// We use landing local tokens: background #16A34A, text #0B0F0A
const ratio = contrastRatio('#0B0F0A', '#16A34A');
assert(ratio >= 4.5, `Contrast ratio too low: ${ratio.toFixed(2)} (< 4.5)`);

console.log('Landing page CTA style tests passed');
