import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  PageBreak,
} from 'docx';
import type { Engagement, DeliverableDocument, Finding } from '../types';

export async function exportDeliverableToDOCX(
  engagement: Engagement | null,
  doc: DeliverableDocument,
  findings: Finding[]
): Promise<void> {
  const clientName = engagement?.client_name ?? 'Client';
  const businessQuestion = engagement?.business_question ?? '';

  const tableBorderNone = {
    top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
  };

  const sectionsList = (doc.sections ?? []).flatMap((sec, idx) => [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      text: `${idx + 1}. ${sec.title}`,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 140 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: sec.content,
          size: 22,
          color: '1c1c1c',
        }),
      ],
      spacing: { after: 240 },
    }),
  ]);

  // Recommendations table
  const recRows = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1A2744' },
          children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true, color: 'F5F0E8' })] })],
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1A2744' },
          children: [new Paragraph({ children: [new TextRun({ text: 'Recommendation', bold: true, color: 'F5F0E8' })] })],
        }),
        new TableCell({
          width: { size: 45, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1A2744' },
          children: [new Paragraph({ children: [new TextRun({ text: 'Strategic Rationale', bold: true, color: 'F5F0E8' })] })],
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1A2744' },
          children: [new Paragraph({ children: [new TextRun({ text: 'Priority', bold: true, color: 'F5F0E8' })] })],
        }),
      ],
    }),
    ...(doc.recommendations ?? []).map((rec, i) =>
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: String(i + 1) })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: rec.title, bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ text: rec.rationale })],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: rec.priority.toUpperCase(),
                    bold: true,
                    color: rec.priority === 'high' ? '9B3A3A' : rec.priority === 'medium' ? 'B8860B' : '2D7A4F',
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    ),
  ];

  const recTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: recRows,
  });

  // Roadmap list
  const roadmapParagraphs = (doc.roadmap ?? []).flatMap(r => [
    new Paragraph({
      children: [
        new TextRun({ text: `${r.phase}: `, bold: true, color: '1A2744' }),
        new TextRun({ text: r.timeline, italics: true, color: '6B6560' }),
      ],
      spacing: { before: 180, after: 60 },
    }),
    ...(r.actions ?? []).map(
      action =>
        new Paragraph({
          text: `• ${action}`,
          indent: { left: 360 },
          spacing: { after: 60 },
        })
    ),
  ]);

  // Evidence Sources list
  const evidenceParagraphs = findings.slice(0, 15).map((f, i) =>
    new Paragraph({
      children: [
        new TextRun({ text: `[${i + 1}] `, bold: true, color: 'C8A96E' }),
        new TextRun({ text: `(${f.confidence.toUpperCase()}) `, italics: true }),
        new TextRun({ text: f.content }),
        ...(f.source_url
          ? [new TextRun({ text: ` — Source: ${f.source_title || f.source_url}`, color: '6B6560', italics: true })]
          : []),
      ],
      spacing: { after: 120 },
    })
  );

  const documentFile = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title / Header
          new Paragraph({
            children: [
              new TextRun({
                text: 'STRATUM ADVISORY',
                bold: true,
                size: 24,
                color: 'C8A96E',
                font: 'Georgia',
              }),
            ],
            spacing: { after: 120 },
          }),
          new Paragraph({
            text: `Strategic Deliverable: ${clientName}`,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Business Question: `,
                bold: true,
                color: '1A2744',
              }),
              new TextRun({
                text: businessQuestion,
                italics: true,
              }),
            ],
            spacing: { after: 360 },
          }),

          // Governing Thought Callout Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorderNone,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: 'F5F0E8' },
                    margins: { top: 200, bottom: 200, left: 200, right: 200 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'GOVERNING THOUGHT',
                            bold: true,
                            size: 18,
                            color: 'C8A96E',
                          }),
                        ],
                        spacing: { after: 100 },
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `"${doc.governing_thought}"`,
                            bold: true,
                            size: 26,
                            font: 'Georgia',
                            color: '1A2744',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // Executive Summary
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({
            text: 'Executive Summary',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 140 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: doc.executive_summary,
                size: 22,
                color: '1C1C1C',
              }),
            ],
            spacing: { after: 300 },
          }),

          // Detailed Sections
          ...sectionsList,

          // Strategic Recommendations
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({
            text: 'Strategic Recommendations',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 160 },
          }),
          recTable,

          // Implementation Roadmap
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({
            text: 'Implementation Roadmap',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 160 },
          }),
          ...roadmapParagraphs,

          // Evidence & Citations Appendix
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({
            text: 'Evidence Base & Research Citations',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 160 },
          }),
          ...evidenceParagraphs,

          // Footer notice
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'CONFIDENTIAL — PREPARED FOR CLIENT USE ONLY',
                size: 16,
                color: '6B6560',
                italics: true,
              }),
            ],
            spacing: { before: 600 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(documentFile);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${clientName.replace(/\s+/g, '_')}_Strategy_Report.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
