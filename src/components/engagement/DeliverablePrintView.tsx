import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList
} from 'recharts';
import type { Engagement, Finding } from '../../types';

interface DeliverablePrintViewProps {
  engagement: Engagement;
  doc: any; // Deliverable.document structure
  findings: Finding[];
  confidenceSummary: any[];
}

export const DeliverablePrintView: React.FC<DeliverablePrintViewProps> = ({
  engagement, doc, findings, confidenceSummary
}) => {
  // We use strict inline styling for the PDF to ensure html2pdf snapshots it correctly.
  const pageStyle: React.CSSProperties = {
    fontFamily: "var(--font-sans)",
    color: '#000000',
    backgroundColor: '#ffffff',
    padding: '40px 60px', // Standard document margins
    width: '800px', // Fixed width to ensure standard Letter/A4 aspect ratio when scaled
    lineHeight: 1.6,
  };

  const headerStyle: React.CSSProperties = {
    borderBottom: '2px solid #000000',
    paddingBottom: '20px',
    marginBottom: '40px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    margin: '0 0 10px 0',
    letterSpacing: '-0.02em',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '1rem',
    color: '#555555',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginTop: '40px',
    marginBottom: '20px',
    borderBottom: '1px solid #cccccc',
    paddingBottom: '8px',
  };

  return (
    <div style={pageStyle}>
      {/* ─── PAGE 1: TITLE & EXECUTIVE SUMMARY ─── */}
      <div style={headerStyle}>
        <p style={subtitleStyle}>Strategy Report</p>
        <h1 style={titleStyle}>{engagement.client_name}</h1>
      </div>

      <div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '24px', fontWeight: 'bold' }}>
          "{doc.governing_thought}"
        </h2>
        <div style={{ fontSize: '1.125rem', whiteSpace: 'pre-wrap' }}>
          {doc.executive_summary}
        </div>
      </div>

      <div style={{ marginTop: '40px' }}>
        <h3 style={sectionTitleStyle}>Evidence Quality Summary</h3>
        <div style={{ width: '100%', height: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={confidenceSummary} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="name" tick={{ fill: '#333333', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#333333', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Bar dataKey="value" fill="#4a5568" isAnimationActive={false}>
                <LabelList dataKey="value" position="top" fill="#333333" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Force page break before Claims */}
      <div style={{ pageBreakBefore: 'always' }} />

      {/* ─── PAGE 2+: CLAIMS & RECOMMENDATIONS ─── */}
      <h3 style={sectionTitleStyle}>Detailed Claims & Recommendations</h3>
      
      {doc.claims && doc.claims.map((claim: any, index: number) => (
        <div key={index} style={{ marginBottom: '32px', pageBreakInside: 'avoid' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
            <span style={{ 
              backgroundColor: '#000000', 
              color: '#ffffff', 
              padding: '2px 8px', 
              borderRadius: '12px', 
              fontSize: '0.75rem',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              {claim.type}
            </span>
            <h4 style={{ fontSize: '1.25rem', margin: 0 }}>Claim {index + 1}</h4>
          </div>
          <p style={{ fontSize: '1.125rem', margin: '0 0 16px 0', fontWeight: 'bold' }}>
            {claim.text}
          </p>

          {claim.insight_ids && claim.insight_ids.length > 0 && (
            <div style={{ paddingLeft: '16px', borderLeft: '3px solid #e2e8f0' }}>
              <p style={{ fontSize: '0.875rem', color: '#718096', margin: '0 0 8px 0', fontWeight: 'bold' }}>Supporting Evidence:</p>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {claim.insight_ids.map((id: string) => {
                  const finding = findings.find(f => f.id === id);
                  return finding ? (
                    <li key={id} style={{ fontSize: '0.9375rem', marginBottom: '6px', color: '#2d3748' }}>
                      {finding.content}
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          )}
        </div>
      ))}
      
      {/* Force page break before Appendix */}
      <div style={{ pageBreakBefore: 'always' }} />

      {/* ─── APPENDIX: ALL FINDINGS ─── */}
      <h3 style={sectionTitleStyle}>Appendix: Complete Data Findings</h3>
      <div style={{ fontSize: '0.9375rem' }}>
        {findings.map((f, i) => (
          <div key={f.id} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #edf2f7', pageBreakInside: 'avoid' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <strong style={{ minWidth: '24px' }}>[{i + 1}]</strong>
              <div>
                <p style={{ margin: '0 0 4px 0' }}>{f.content}</p>
                <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                  Confidence: {f.confidence.toUpperCase()}
                  {f.source_url && <span style={{ marginLeft: '12px' }}>Source: {f.source_url}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
