import jsPDF from 'jspdf';
import type { Engagement, Finding } from '../../types';

// ── STRATUM BRAND PALETTE ────────────────────────────────────────────────────
const C = {
  navyDark:  [14,  20,  36]  as [number, number, number],
  navy:      [24,  32,  60]  as [number, number, number],
  navyMid:   [40,  54,  90]  as [number, number, number],
  green:     [62,  207, 142] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
  offWhite:  [250, 250, 252] as [number, number, number],
  grey50:    [246, 248, 251] as [number, number, number],
  grey200:   [220, 225, 235] as [number, number, number],
  grey500:   [107, 120, 140] as [number, number, number],
  grey800:   [28,  38,  56]  as [number, number, number],
  red:       [220,  80,  80] as [number, number, number],
  amber:     [210, 155,  30] as [number, number, number],
  blue:      [80,  140, 220] as [number, number, number],
};

// ── PAGE GEOMETRY ────────────────────────────────────────────────────────────
const PW   = 210;   // A4 width mm
const PH   = 297;   // A4 height mm
const ML   = 20;    // left margin
const MR   = 18;    // right margin
const MT   = 20;    // top margin (non-cover pages)
const MB   = 20;    // bottom margin (space for footer)
const CW   = PW - ML - MR;  // content width = 172 mm
const FOOT = PH - MB - 4;   // footer Y baseline

// ── TEXT SANITIZER ───────────────────────────────────────────────────────────
// jsPDF's default encoding chokes on curly quotes, em-dashes, etc.
// Replace them with safe ASCII equivalents.
function sanitize(s: string): string {
  if (!s) return '';
  return s
    .replace(/\u2018|\u2019/g, "'")   // curly single quotes
    .replace(/\u201C|\u201D/g, '"')   // curly double quotes
    .replace(/\u2013/g, '-')           // en-dash
    .replace(/\u2014/g, '--')          // em-dash
    .replace(/\u2026/g, '...')         // ellipsis
    .replace(/\u00A0/g, ' ')           // non-breaking space
    .replace(/[^\x00-\x7E]/g, ' ');   // any remaining non-ASCII
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
const sf   = (doc: jsPDF, rgb: [number,number,number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
const sd   = (doc: jsPDF, rgb: [number,number,number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
const st   = (doc: jsPDF, rgb: [number,number,number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
const font = (doc: jsPDF, style: 'normal'|'bold'|'italic'|'bolditalic', size: number) => {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
};

/** Wrap text and return how many mm of vertical space it will need */
function textHeight(doc: jsPDF, text: string, maxW: number, lineH: number): number {
  const lines = doc.splitTextToSize(sanitize(text), maxW);
  return lines.length * lineH;
}

/** Draw wrapped text, return new Y after drawing */
function drawText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  align: 'left'|'center'|'right' = 'left'
): number {
  const lines = doc.splitTextToSize(sanitize(text), maxW);
  lines.forEach((line: string, i: number) => {
    let lx = x;
    if (align === 'center') lx = x + maxW / 2;
    if (align === 'right')  lx = x + maxW;
    doc.text(line, lx, y + i * lineH, { align });
  });
  return y + lines.length * lineH;
}

/** Check if content fits on current page; if not, add a new page and reset Y */
function checkBreak(
  doc: jsPDF,
  y: number,
  needed: number,
  drawStripeFn: () => void
): number {
  if (y + needed > FOOT - 4) {
    doc.addPage();
    drawStripeFn();
    return MT + 4;
  }
  return y;
}

// ── STRUCTURAL ELEMENTS ───────────────────────────────────────────────────────

function drawStripe(doc: jsPDF) {
  sf(doc, C.navy);
  doc.rect(0, 0, 6, PH, 'F');
  sf(doc, C.green);
  doc.rect(0, PH - 36, 6, 36, 'F');
}

function drawFooter(doc: jsPDF, page: number, total: number, client: string) {
  sf(doc, C.grey50);
  doc.rect(ML, FOOT, CW, 9, 'F');
  font(doc, 'bold', 6.5);
  st(doc, C.green);
  doc.text('STRATUM STRATEGY REPORT', ML + 3, FOOT + 5.5);
  font(doc, 'normal', 6.5);
  st(doc, C.grey500);
  doc.text(sanitize(client), PW / 2, FOOT + 5.5, { align: 'center' });
  doc.text(`Page ${page} of ${total}`, PW - MR - 3, FOOT + 5.5, { align: 'right' });
}

/** Section title block (navy bar) — returns new Y */
function sectionHeader(doc: jsPDF, tag: string, title: string, y: number): number {
  sf(doc, C.navy);
  doc.rect(ML, y, CW, 15, 'F');
  font(doc, 'bold', 7);
  st(doc, C.green);
  doc.text(sanitize(tag.toUpperCase()), ML + 5, y + 6);
  font(doc, 'bold', 11.5);
  st(doc, C.white);
  const tLines = doc.splitTextToSize(sanitize(title), CW - 10);
  doc.text(tLines, ML + 5, y + 13);
  return y + 15 + (tLines.length - 1) * 6 + 5;
}

/** Rounded pill badge — returns x after badge */
function badge(doc: jsPDF, label: string, x: number, y: number, bg: [number,number,number]): number {
  font(doc, 'bold', 6);
  const w = doc.getTextWidth(label.toUpperCase()) + 5;
  sf(doc, bg);
  doc.roundedRect(x, y - 3.5, w, 5, 1.2, 1.2, 'F');
  st(doc, C.white);
  doc.text(label.toUpperCase(), x + 2.5, y + 0.2);
  return x + w + 3;
}

/** Horizontal divider */
function divider(doc: jsPDF, y: number, rgb: [number,number,number] = C.grey200) {
  sd(doc, rgb);
  doc.setLineWidth(0.25);
  doc.line(ML, y, PW - MR, y);
}

// ── SIMPLE BAR CHART ─────────────────────────────────────────────────────────
function drawBarChart(
  doc: jsPDF,
  data: Array<{ label: string; value: number }>,
  x: number, y: number, w: number, h: number,
  barColor: [number,number,number] = C.green
) {
  if (!data || data.length === 0) return;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const n = data.length;
  const chartH = h - 12;
  const barGap = 4;
  const barW = (w - barGap * (n + 1)) / n;

  // Axis lines
  sd(doc, C.grey200);
  doc.setLineWidth(0.25);
  doc.line(x, y, x, y + chartH);
  doc.line(x, y + chartH, x + w, y + chartH);

  data.forEach((d, i) => {
    const bh = Math.max((d.value / maxVal) * chartH, 1);
    const bx = x + barGap + i * (barW + barGap);
    const by = y + chartH - bh;
    sf(doc, barColor);
    doc.rect(bx, by, barW, bh, 'F');
    // Value
    font(doc, 'bold', 6.5);
    st(doc, C.grey800);
    doc.text(String(d.value), bx + barW / 2, by - 1.5, { align: 'center' });
    // Label
    font(doc, 'normal', 6);
    st(doc, C.grey500);
    const lbl = sanitize(d.label).slice(0, 12);
    doc.text(lbl, bx + barW / 2, y + chartH + 5, { align: 'center' });
  });
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export async function generateStratumPDF(
  engagement: Engagement,
  doc: any,
  findings: Finding[],
  confidenceSummary: Array<{ name: string; value: number }>
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const client = sanitize(engagement.client_name ?? 'Client');
  const industry = sanitize(engagement.industry ?? '');
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const stripe = () => drawStripe(pdf);

  // ═══════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ═══════════════════════════════════════════════════════════════════
  sf(pdf, C.navyDark);
  pdf.rect(0, 0, PW, PH, 'F');

  // Left stripe
  sf(pdf, C.navy);
  pdf.rect(0, 0, 8, PH, 'F');
  sf(pdf, C.green);
  pdf.rect(0, PH - 48, 8, 48, 'F');

  // Top-right accent circle
  sf(pdf, C.navyMid);
  pdf.circle(PW - 14, 22, 26, 'F');
  sf(pdf, C.green);
  pdf.circle(PW - 14, 22, 8, 'F');

  // Bottom decoration panel
  sf(pdf, C.navy);
  pdf.rect(8, PH - 50, PW - 8, 24, 'F');
  sf(pdf, C.navyMid);
  pdf.rect(8, PH - 50, 60, 24, 'F');

  // Stratum logo area
  font(pdf, 'bold', 11);
  st(pdf, C.green);
  pdf.text('STRATUM', 20, 24);
  font(pdf, 'normal', 7.5);
  st(pdf, C.grey200);
  pdf.text('STRATEGY & INTELLIGENCE', 20, 30);
  sd(pdf, C.green);
  pdf.setLineWidth(0.5);
  pdf.line(20, 34, 70, 34);

  // Report type
  font(pdf, 'normal', 7.5);
  st(pdf, C.grey500);
  pdf.text('CONFIDENTIAL STRATEGY REPORT', 20, 100);

  // Client name
  font(pdf, 'bold', 34);
  st(pdf, C.white);
  const clientLines = pdf.splitTextToSize(client, CW - 10);
  pdf.text(clientLines, 20, 115);
  let coverY = 115 + clientLines.length * 14;

  // Industry badge
  if (industry) {
    sf(pdf, C.navyMid);
    const iw = pdf.getTextWidth(industry.toUpperCase()) + 10;
    pdf.roundedRect(20, coverY + 4, iw, 8, 2, 2, 'F');
    font(pdf, 'bold', 7);
    st(pdf, C.green);
    pdf.text(industry.toUpperCase(), 25, coverY + 9.5);
    coverY += 18;
  }

  // Governing thought
  if (doc.governing_thought) {
    coverY += 6;
    font(pdf, 'bold', 7.5);
    st(pdf, C.green);
    pdf.text('KEY FINDING', 20, coverY);
    coverY += 6;
    font(pdf, 'bolditalic', 10.5);
    st(pdf, C.white);
    const gtLines = pdf.splitTextToSize(`"${sanitize(doc.governing_thought)}"`, CW - 16);
    // Clamp to avoid overflow into footer area
    const visibleLines = gtLines.slice(0, Math.floor((FOOT - 20 - coverY) / 6));
    pdf.text(visibleLines, 20, coverY);
  }

  // Bottom strip
  sf(pdf, C.navy);
  pdf.rect(8, PH - 26, PW - 8, 26, 'F');
  font(pdf, 'normal', 7.5);
  st(pdf, C.grey500);
  pdf.text(`Prepared by Stratum   |   ${dateStr}`, 20, PH - 13);
  font(pdf, 'bold', 7.5);
  st(pdf, C.green);
  pdf.text('CONFIDENTIAL', PW - MR - 4, PH - 13, { align: 'right' });

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 2 — EXECUTIVE SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  pdf.addPage();
  stripe();
  let y = sectionHeader(pdf, 'Executive Summary', client, MT);

  // Governing thought callout
  if (doc.governing_thought) {
    const gtText = `"${sanitize(doc.governing_thought)}"`;
    font(pdf, 'bolditalic', 10);
    const gtLines = pdf.splitTextToSize(gtText, CW - 14);
    const gtH = gtLines.length * 5.5 + 10;
    sf(pdf, C.offWhite);
    pdf.rect(ML, y, CW, gtH, 'F');
    sf(pdf, C.green);
    pdf.rect(ML, y, 3, gtH, 'F');
    st(pdf, C.navyDark);
    pdf.text(gtLines, ML + 8, y + 7);
    y += gtH + 6;
  }

  // Stats strip
  const stats = [
    { label: 'Findings',       value: findings.length },
    { label: 'Sections',       value: (doc.sections?.length ?? 0) },
    { label: 'Recommendations',value: (doc.recommendations?.length ?? 0) },
    { label: 'Roadmap Phases', value: (doc.roadmap?.length ?? 0) },
  ];
  const sw = CW / stats.length;
  stats.forEach((s, i) => {
    sf(pdf, i % 2 === 0 ? C.navy : C.navyMid);
    pdf.rect(ML + i * sw, y, sw, 16, 'F');
    font(pdf, 'bold', 16);
    st(pdf, C.green);
    pdf.text(String(s.value), ML + i * sw + sw / 2, y + 10, { align: 'center' });
    font(pdf, 'normal', 6);
    st(pdf, C.grey200);
    pdf.text(s.label.toUpperCase(), ML + i * sw + sw / 2, y + 14.5, { align: 'center' });
  });
  y += 20;

  // Evidence chart
  if (confidenceSummary.some(c => c.value > 0)) {
    font(pdf, 'bold', 7.5);
    st(pdf, C.grey800);
    pdf.text('EVIDENCE QUALITY DISTRIBUTION', ML, y + 5);
    y += 7;
    drawBarChart(pdf, confidenceSummary.map(c => ({ label: c.name, value: c.value })), ML, y, CW / 2 - 4, 38);
    y += 46;
  }

  // Executive summary body
  divider(pdf, y);
  y += 5;
  if (doc.executive_summary) {
    const paragraphs = sanitize(doc.executive_summary).split(/\n+/).filter(Boolean);
    for (const para of paragraphs) {
      font(pdf, 'normal', 9);
      st(pdf, C.grey800);
      const needed = textHeight(pdf, para, CW, 5);
      y = checkBreak(pdf, y, needed + 4, stripe);
      y = drawText(pdf, para, ML, y, CW, 5);
      y += 4; // paragraph gap
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SECTIONS
  // ═══════════════════════════════════════════════════════════════════
  const sections: any[] = doc.sections ?? [];
  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];
    pdf.addPage();
    stripe();
    y = sectionHeader(pdf, `Section ${si + 1}`, section.title ?? '', MT);

    // Section content — paragraph by paragraph
    const paras = sanitize(section.content ?? '').split(/\n+/).filter(Boolean);
    for (const para of paras) {
      font(pdf, 'normal', 9);
      st(pdf, C.grey800);
      const needed = textHeight(pdf, para, CW, 5);
      y = checkBreak(pdf, y, needed + 4, stripe);
      y = drawText(pdf, para, ML, y, CW, 5);
      y += 4;
    }

    // Section chart
    if (section.chart?.data?.length > 0) {
      y = checkBreak(pdf, y, 55, stripe);
      y += 3;
      font(pdf, 'bold', 7);
      st(pdf, C.grey800);
      pdf.text('DATA CHART', ML, y + 4);
      y += 6;
      const chartData = section.chart.data.map((d: any) => ({
        label: sanitize(d.label ?? d.name ?? ''),
        value: Number(d.value ?? 0)
      }));
      drawBarChart(pdf, chartData, ML, y, CW, 44, C.blue);
      y += 52;
    }

    // Key takeaways
    if (section.slide_bullets?.length > 0) {
      const bullets: string[] = section.slide_bullets;
      const boxH = bullets.reduce((acc: number, b: string) => {
        font(pdf, 'normal', 8);
        return acc + textHeight(pdf, b, CW - 14, 4.8) + 2;
      }, 14);
      y = checkBreak(pdf, y, boxH, stripe);
      sf(pdf, C.grey50);
      pdf.rect(ML, y, CW, boxH, 'F');
      sf(pdf, C.green);
      pdf.rect(ML, y, 3, boxH, 'F');
      font(pdf, 'bold', 7);
      st(pdf, C.navyDark);
      pdf.text('KEY TAKEAWAYS', ML + 7, y + 7);
      let by = y + 12;
      for (const b of bullets) {
        font(pdf, 'normal', 8);
        st(pdf, C.grey800);
        by = drawText(pdf, `• ${sanitize(b)}`, ML + 7, by, CW - 14, 4.8);
        by += 2;
      }
      y = by + 4;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════
  const recs: any[] = doc.recommendations ?? [];
  if (recs.length > 0) {
    pdf.addPage();
    stripe();
    y = sectionHeader(pdf, 'Strategic Recommendations', 'Action Plan', MT);

    for (let ri = 0; ri < recs.length; ri++) {
      const rec = recs[ri];
      const prio = (rec.priority ?? 'low') as string;
      const pColor: [number,number,number] = prio === 'high' ? C.red : prio === 'medium' ? C.amber : C.green;

      font(pdf, 'normal', 8.5);
      const titleH = textHeight(pdf, rec.title ?? '', CW - 32, 5);
      font(pdf, 'normal', 8);
      const ratH   = textHeight(pdf, rec.rationale ?? '', CW - 32, 4.5);
      const cardH  = Math.max(titleH + ratH + 20, 28);

      y = checkBreak(pdf, y, cardH + 4, stripe);

      sf(pdf, C.offWhite);
      pdf.roundedRect(ML, y, CW, cardH, 2, 2, 'F');
      sf(pdf, pColor);
      pdf.rect(ML, y, 3, cardH, 'F');

      // Number circle
      sf(pdf, C.navy);
      pdf.circle(ML + 13, y + 10, 5, 'F');
      font(pdf, 'bold', 8);
      st(pdf, C.white);
      pdf.text(String(ri + 1), ML + 13, y + 12.8, { align: 'center' });

      // Priority badge
      badge(pdf, prio, ML + 24, y + 8, pColor);

      // Title
      font(pdf, 'bold', 9.5);
      st(pdf, C.navyDark);
      let ty = drawText(pdf, rec.title ?? '', ML + 24, y + 14, CW - 32, 5);

      // Rationale
      font(pdf, 'normal', 8);
      st(pdf, C.grey500);
      drawText(pdf, rec.rationale ?? '', ML + 24, ty + 2, CW - 32, 4.5);

      y += cardH + 5;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ROADMAP
  // ═══════════════════════════════════════════════════════════════════
  const roadmap: any[] = doc.roadmap ?? [];
  if (roadmap.length > 0) {
    pdf.addPage();
    stripe();
    y = sectionHeader(pdf, 'Implementation Roadmap', 'Phased Action Plan', MT);

    for (let pi = 0; pi < roadmap.length; pi++) {
      const phase = roadmap[pi];
      const actions: string[] = phase.actions ?? [];
      const phaseH = 12 + actions.slice(0, 4).length * 5.5 + 6;
      y = checkBreak(pdf, y, phaseH, stripe);

      // Timeline dot & connector
      const lineX = ML + 10;
      if (pi < roadmap.length - 1) {
        sd(pdf, C.green);
        pdf.setLineWidth(0.8);
        pdf.line(lineX, y + 5, lineX, y + phaseH + 4);
      }
      sf(pdf, C.green);
      pdf.circle(lineX, y + 5, 3.5, 'F');
      sf(pdf, C.white);
      pdf.circle(lineX, y + 5, 1.5, 'F');

      // Phase label
      font(pdf, 'bold', 8.5);
      st(pdf, C.navyDark);
      pdf.text(sanitize(phase.phase ?? `Phase ${pi + 1}`).toUpperCase(), ML + 20, y + 6.5);

      // Timeline badge
      if (phase.timeline) {
        const tlX = ML + 20 + pdf.getTextWidth(sanitize(phase.phase ?? '').toUpperCase()) + 4;
        sf(pdf, C.grey50);
        const tlW = pdf.getTextWidth(sanitize(phase.timeline)) + 8;
        pdf.roundedRect(tlX, y + 2, tlW, 6, 1, 1, 'F');
        font(pdf, 'normal', 6.5);
        st(pdf, C.green);
        pdf.text(sanitize(phase.timeline), tlX + 4, y + 6.5);
      }

      // Actions
      let ay = y + 12;
      for (const action of actions.slice(0, 4)) {
        font(pdf, 'normal', 8);
        st(pdf, C.grey500);
        ay = drawText(pdf, `• ${sanitize(action)}`, ML + 20, ay, CW - 28, 5.5);
      }
      y = ay + 6;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // APPENDIX
  // ═══════════════════════════════════════════════════════════════════
  if (findings.length > 0) {
    pdf.addPage();
    stripe();
    y = sectionHeader(pdf, 'Appendix', 'Data Sources & Evidence', MT);

    for (let fi = 0; fi < Math.min(findings.length, 40); fi++) {
      const f = findings[fi];
      font(pdf, 'normal', 8);
      const contentH = textHeight(pdf, f.content, CW - 14, 4.5) + 10;
      y = checkBreak(pdf, y, contentH, stripe);

      font(pdf, 'bold', 7.5);
      st(pdf, C.navyDark);
      pdf.text(`[${fi + 1}]`, ML, y + 4);

      font(pdf, 'normal', 8);
      st(pdf, C.grey800);
      const fy = drawText(pdf, f.content, ML + 10, y, CW - 14, 4.5);

      // Confidence badge
      const cColor: [number,number,number] = f.confidence === 'verified' ? C.green
                                           : f.confidence === 'estimate'  ? C.amber
                                           : C.grey500;
      badge(pdf, f.confidence, ML + 10, fy + 4, cColor);

      if (f.source_url) {
        font(pdf, 'normal', 6.5);
        st(pdf, C.grey500);
        pdf.text(sanitize(f.source_url).slice(0, 70), ML + 38, fy + 4);
      }

      y = fy + 10;
      divider(pdf, y, C.grey50);
      y += 3;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FOOTERS — applied to all non-cover pages
  // ═══════════════════════════════════════════════════════════════════
  const total = pdf.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    pdf.setPage(p);
    drawFooter(pdf, p - 1, total - 1, client);
  }

  // Save
  pdf.save(`Stratum_${client.replace(/[^a-zA-Z0-9]/g, '_')}_Strategy_Report.pdf`);
}
