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

// Minimal CSS parser for the specific selectors we care about
function parseCssRules(css) {
  const rules = [];
  // Strip comments
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rx = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = rx.exec(cleaned))) {
    const selRaw = m[1].trim();
    const body = m[2].trim();
    // Only keep rules relevant to our test to avoid keyframes/media internals
    if (!(selRaw.includes('.btn-hero-primary') || selRaw.includes('.landing-page'))) continue;
    const decls = Object.create(null);
    for (const line of body.split(';')) {
      const kv = line.trim();
      if (!kv) continue;
      const idx = kv.indexOf(':');
      if (idx === -1) continue;
      const prop = kv.slice(0, idx).trim();
      const val = kv.slice(idx + 1).trim();
      decls[prop] = val;
    }
    rules.push({ selector: selRaw, decls });
  }
  return rules;
}

function splitSelector(sel) {
  // Extract pseudo-class (hover/active/focus-visible) and classes required on the element
  const pseudoMatch = sel.match(/:(hover|active|focus-visible)/);
  const pseudo = pseudoMatch ? pseudoMatch[1] : null;
  // Remove pseudo and descendants to get simple compound selector for the element
  const noPseudo = sel.replace(/:(hover|active|focus-visible)/g, '').trim();
  // If descendant selector, take the last compound part for element matching but keep ancestor info to decide scope
  const parts = noPseudo.split(/\s+/);
  const last = parts[parts.length - 1];
  const classes = (last.match(/\.[-_a-zA-Z0-9]+/g) || []).map(s => s.slice(1));
  const hasLandingAncestor = parts.some(p => p.includes('.landing-page'));
  const isLandingRoot = parts.length === 1 && parts[0] === '.landing-page';
  return { pseudo, classes, hasLandingAncestor, isLandingRoot };
}

function elementMatches(classesNeeded, elementClasses) {
  return classesNeeded.every(c => elementClasses.has(c));
}

function computeVariables(rules, ancestorClasses) {
  // Variables cascade: collect from .landing-page root rule and any rule that targets .landing-page without pseudo
  const vars = Object.create(null);
  for (const r of rules) {
    const s = splitSelector(r.selector);
    if (s.isLandingRoot) {
      for (const [k, v] of Object.entries(r.decls)) {
        if (k.startsWith('--')) vars[k] = v;
      }
    }
  }
  return vars;
}

function resolveVars(value, vars) {
  return value.replace(/var\(\s*(--[a-zA-Z0-9-_]+)\s*\)/g, (_, name) => {
    return vars[name] || `var(${name})`;
  });
}

function computeStyle(rules, elementClasses, state /* 'base' | 'hover' | 'active' | 'focus-visible' */) {
  const style = Object.create(null);
  const vars = computeVariables(rules, new Set(['landing-page']));
  // Apply base rules in order
  for (const r of rules) {
    const s = splitSelector(r.selector);
    if (s.pseudo) continue; // base only for now
    if (!elementMatches(s.classes, elementClasses)) continue;
    // If rule expects landing ancestor, assume true (we mount inside .landing-page)
    for (const [k, v] of Object.entries(r.decls)) {
      style[k] = resolveVars(v, vars);
    }
  }
  // Apply state overrides
  if (state && state !== 'base') {
    for (const r of rules) {
      const s = splitSelector(r.selector);
      if (s.pseudo !== state) continue;
      if (!elementMatches(s.classes, elementClasses)) continue;
      for (const [k, v] of Object.entries(r.decls)) {
        style[k] = resolveVars(v, vars);
      }
    }
  }
  return style;
}

// Load CSS
const landingCss = read('src/pages/public/LandingPage.css');
const rules = parseCssRules(landingCss);

// Sanity: scoped CSS vars defined on landing page root
const landingRootMatch = /\.landing-page\s*\{([\s\S]*?)\}/.exec(landingCss);
assert(!!landingRootMatch, 'Expected .landing-page root styles to exist');
assert(/--success:\s*#16A34A/i.test(landingRootMatch[1]), 'Expected local --success to be #16A34A');
assert(/--success-dark:\s*#13803D/i.test(landingRootMatch[1]), 'Expected local --success-dark to be #13803D');

// Compute styles for the Get Started CTA element
const elementClasses = new Set(['btn-hero-primary', 'get-started-cta']);
const baseStyle = computeStyle(rules, elementClasses, 'base');
assert(baseStyle.background, 'Expected base background to be set');
assert(baseStyle.background.toLowerCase() === '#16a34a' || baseStyle.background.toLowerCase() === 'rgb(22, 163, 74)'.toLowerCase(), `Base background should resolve to #16A34A, got ${baseStyle.background}`);

const hoverStyle = computeStyle(rules, elementClasses, 'hover');
assert(hoverStyle.background, 'Expected hover background to be set');
assert(hoverStyle.background.toLowerCase() === '#13803d' || hoverStyle.background.toLowerCase() === 'rgb(19, 128, 61)'.toLowerCase(), `Hover background should resolve to #13803D, got ${hoverStyle.background}`);

const activeStyle = computeStyle(rules, elementClasses, 'active');
assert(activeStyle.background, 'Expected active background to be set');
assert(activeStyle.background.toLowerCase() === '#13803d' || activeStyle.background.toLowerCase() === 'rgb(19, 128, 61)'.toLowerCase(), `Active background should resolve to #13803D, got ${activeStyle.background}`);

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
