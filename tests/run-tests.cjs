/* Simple repository tests for .btn-hero-primary styling and Sign In CTAs */
const fs = require('fs');
const path = require('path');

function read(p) {
  return fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testCss() {
  const css = read('src/index.css');

  const baseMatch = css.match(/\.btn-hero-primary\s*\{[\s\S]*?\}/);
  assert(baseMatch, 'Missing .btn-hero-primary base style');
  const base = baseMatch[0];
  assert(/background:\s*var\(--green\)/.test(base), 'Base background should be var(--green)');
  assert(/color:\s*var\(--bg\)/.test(base), 'Base text color should use var(--bg) for contrast');

  const hoverMatch = css.match(/\.btn-hero-primary:hover\s*\{[\s\S]*?\}/);
  assert(hoverMatch, 'Missing .btn-hero-primary:hover style');
  const hover = hoverMatch[0];
  // Accept either a darker token or color-mix darkening
  assert(/color-mix\(|var\(--green-dark\)/.test(hover) || /filter:\s*brightness\(0\.9\)/.test(hover), 'Hover should darken the green (color-mix or --green-dark or brightness)');

  const focusMatch = css.match(/\.btn-hero-primary:focus[\s\S]*?\{[\s\S]*?\}/) || css.match(/\.btn-hero-primary:focus,[\s\S]*?\.btn-hero-primary:focus-visible\s*\{[\s\S]*?\}/);
  assert(focusMatch, 'Missing focus styles for .btn-hero-primary');
  const focus = focusMatch[0];
  assert(/outline:/.test(focus), 'Focus should define a visible outline');
  assert(/box-shadow:/.test(focus), 'Focus should define a focus ring via box-shadow');
}

function testPages() {
  const landing = read('src/pages/public/LandingPage.tsx');
  const contact = read('src/pages/public/ContactPage.tsx');

  const btnRe = /<button[^>]*className="btn-hero-primary"[\s\S]*?>[\s\S]*?Sign In[\s\S]*?<\/button>/;
  assert(btnRe.test(landing), 'LandingPage: Sign In CTA with .btn-hero-primary not found');
  assert(btnRe.test(contact), 'ContactPage: Sign In CTA with .btn-hero-primary not found');
}

function main() {
  try {
    testCss();
    testPages();
    console.log('All tests passed.');
    process.exit(0);
  } catch (err) {
    console.error('TEST FAILURE:\n' + err.message);
    process.exit(1);
  }
}

main();
