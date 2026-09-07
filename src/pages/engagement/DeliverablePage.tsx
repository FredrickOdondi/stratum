import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Send, ExternalLink, CheckCircle, FileText, Play, FileDown } from 'lucide-react';
import { generateStratumPDF } from '../../lib/generatePDF';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { AppShell } from '../../components/layout/AppShell';
import { DeliverablePrintView } from '../../components/engagement/DeliverablePrintView';
import { ConfidenceBadge, PriorityBadge } from '../../components/engagement/Badges';
import { supabase } from '../../lib/supabase';
import { saveStageOutput } from '../../lib/engagementStages';
import { exportDeliverableToDOCX } from '../../lib/docxExport';
import type { Engagement, Deliverable, Finding } from '../../types';

export function DeliverablePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [preparingViewer, setPreparingViewer] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'report' | 'roadmap' | 'appendix'>('report');

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    if (!id) return;
    const [{ data: eng }, { data: delData }, { data: findingData }] = await Promise.all([
      supabase.from('engagements').select('*').eq('id', id).single(),
      supabase.from('deliverables').select('*').eq('engagement_id', id).eq('is_current', true).maybeSingle(),
      supabase.from('findings').select('*').eq('engagement_id', id),
    ]);
    if (eng) setEngagement(eng as Engagement);
    if (delData) setDeliverable(delData as Deliverable);
    if (findingData) setFindings(findingData as Finding[]);
  }

  async function handleSubmitForReview() {
    if (!id || !deliverable) return;
    setSubmitting(true);
    await supabase.from('review_requests').insert({
      engagement_id: id,
      deliverable_id: deliverable.id,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    });
    await supabase.from('engagements').update({ stage: 'in_review', updated_at: new Date().toISOString() }).eq('id', id);

    await saveStageOutput(id, 'deliverable', {
      deliverable_id: deliverable.id,
      version: deliverable.version,
      sections_count: deliverable.document?.sections?.length ?? 0,
      submitted_for_review_at: new Date().toISOString(),
    }, 'completed');

    navigate(`/engagement/${id}/review`);
  }

  async function generatePPTX() {
    const doc = deliverable?.document;
    if (!doc || !id) return null;
    const { default: PptxGenJS } = await import('pptxgenjs');
    const pptx = new PptxGenJS();

    // Title slide
    const slide1 = pptx.addSlide();
    slide1.background = { color: '1a2744' };
    slide1.addText(engagement?.client_name ?? 'Client', {
      x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 14, color: 'c8a96e', fontFace: 'Georgia',
    });
    slide1.addText(doc.governing_thought, {
      x: 0.5, y: 1.4, w: 9, h: 2.5, fontSize: 28, color: 'f5f0e8', fontFace: 'Georgia', bold: true,
    });
    slide1.addText('CONFIDENTIAL DRAFT — NOT FOR DISTRIBUTION', {
      x: 0.5, y: 6.5, w: 9, h: 0.4, fontSize: 9, color: '6b6560', align: 'center',
    });

    // Executive summary
    const slide2 = pptx.addSlide();
    slide2.addText('Executive Summary', { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 20, bold: true, color: '1a2744', fontFace: 'Georgia' });
    slide2.addText(doc.executive_summary, { x: 0.5, y: 1.2, w: 9, h: 4, fontSize: 13, color: '1c1c1c', valign: 'top' });

    // Section slides
    doc.sections?.forEach(section => {
      const s = pptx.addSlide();
      // Tracker
      s.addText('Strategy Report', { x: 0.5, y: 0.2, w: 9, h: 0.3, fontSize: 10, color: '6b6560', bold: true });
      
      // Action Title
      s.addText(section.title, { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 18, bold: true, color: '1a2744', fontFace: 'Georgia' });
      
      const hasChart = !!section.chart;
      const textWidth = hasChart ? 4.5 : 9;
      const chartX = hasChart ? 5 : 0;
      
      const textProps = { x: 0.5, y: 1.4, w: textWidth, h: 4, fontSize: 14, color: '1c1c1c', valign: 'top' };
      
      if (section.slide_bullets && section.slide_bullets.length > 0) {
        const bullets = section.slide_bullets.map(b => ({ text: b, options: { bullet: true, breakLine: true } }));
        s.addText(bullets, textProps);
      } else {
        // Fallback to first paragraph if no slide_bullets generated
        const shortText = section.content.split('\n')[0].substring(0, 400) + '...';
        s.addText(shortText, textProps);
      }

      if (section.chart) {
        const chartData = [
          {
            name: "Values",
            labels: section.chart.data.map(d => d.label),
            values: section.chart.data.map(d => d.value)
          }
        ];
        
        let cType = pptx.ChartType.pie;
        if (section.chart.type === 'bar') cType = pptx.ChartType.bar;
        else if (section.chart.type === 'line') cType = pptx.ChartType.line;
        
        s.addChart(cType, chartData, { x: chartX, y: 1.4, w: 4.5, h: 3.5, showLegend: true });
      }
    });

    // Recommendations
    const recSlide = pptx.addSlide();
    recSlide.addText('Recommendations', { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 18, bold: true, color: '1a2744', fontFace: 'Georgia' });
    doc.recommendations?.forEach((rec, i) => {
      recSlide.addText(`${i + 1}. ${rec.title} [${rec.priority.toUpperCase()}]`, {
        x: 0.5, y: 1.2 + i * 1.0, w: 9, h: 0.5, fontSize: 13, bold: true, color: '1a2744',
      });
      recSlide.addText(rec.rationale, { x: 0.7, y: 1.65 + i * 1.0, w: 8.8, h: 0.4, fontSize: 11, color: '6b6560' });
    });

    return pptx;
  }

  async function handleExportPDF() {
    if (!deliverable?.document || !engagement) return;
    setExportingPdf(true);
    try {
      const summary = [
        { name: 'Verified',   value: findings.filter(f => f.confidence === 'verified').length },
        { name: 'Estimate',   value: findings.filter(f => f.confidence === 'estimate').length },
        { name: 'Assumption', value: findings.filter(f => f.confidence === 'assumption').length },
      ];
      await generateStratumPDF(engagement, deliverable.document, findings, summary);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to generate PDF. Check console for details.');
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportPPTX() {
    const pptx = await generatePPTX();
    if (pptx) {
      await pptx.writeFile({ fileName: `${engagement?.client_name ?? 'Engagement'}_Strategy.pptx` });
    }
  }

  async function handleViewPPTX() {
    if (!id) return;
    setPreparingViewer(true);
    try {
      const pptx = await generatePPTX();
      if (!pptx) throw new Error("Could not generate PPTX");

      const blob = await pptx.write('blob') as Blob;
      
      const fileName = `${id}_${Date.now()}.pptx`;
      const { error: uploadError } = await supabase.storage
        .from('deliverables_public')
        .upload(fileName, blob, { upsert: true, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('deliverables_public')
        .getPublicUrl(fileName);

      navigate(`/engagement/${id}/presentation?url=${encodeURIComponent(publicUrl)}`);
    } catch (err) {
      console.error('Failed to view PPTX:', err);
    }
    setPreparingViewer(false);
  }

  async function handleExportDOCX() {
    const doc = deliverable?.document;
    if (!doc) return;
    setExportingDocx(true);
    try {
      await exportDeliverableToDOCX(engagement, doc, findings);
    } catch (err) {
      console.error('Failed to export DOCX:', err);
    }
    setExportingDocx(false);
  }

  const doc = deliverable?.document;
  const confidenceSummary = [
    { name: 'Verified', value: findings.filter(f => f.confidence === 'verified').length, fill: '#2d7a4f' },
    { name: 'Estimate', value: findings.filter(f => f.confidence === 'estimate').length, fill: '#b8860b' },
    { name: 'Assumption', value: findings.filter(f => f.confidence === 'assumption').length, fill: '#9b3a3a' },
  ];

  return (
    <AppShell engagementId={id} currentStage="deliverable" completedStages={['scoping', 'issue_tree', 'research', 'analysis', 'synthesis', 'quality_check']}>
      <div className="page">
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="badge badge-gold" style={{ marginBottom: 12 }}>Stage 7 — Deliverable</div>
            <h1 className="page-title">Strategy Report</h1>
            <p>{engagement?.client_name} · Version {deliverable?.version ?? 1}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={handleViewPPTX} disabled={preparingViewer}>
              {preparingViewer ? <span className="spinner spinner-sm" /> : <Play size={15} />}
              View PPTX
            </button>
            <button className="btn btn-outline" onClick={handleExportDOCX} disabled={exportingDocx}>
              {exportingDocx ? <span className="spinner spinner-sm" /> : <FileText size={15} />}
              Export .docx
            </button>
            <button className="btn btn-outline" onClick={handleExportPDF} disabled={exportingPdf}>
              {exportingPdf ? <span className="spinner spinner-sm" /> : <FileDown size={15} />}
              Export .pdf
            </button>
            <button className="btn btn-outline" onClick={handleExportPPTX}>
              <Download size={15} />
              Export .pptx
            </button>
            <button className="btn btn-outline" onClick={() => navigate(`/engagement/${id}/present`)}>
              <Play size={15} />
              Present
            </button>
            <button className="btn btn-gold" onClick={handleSubmitForReview} disabled={submitting}>
              {submitting ? <span className="spinner spinner-sm spinner-gold" /> : <Send size={15} />}
              Submit for Expert Review
            </button>
          </div>
        </div>

        {doc && (
          <div style={{ background: 'var(--bg)', padding: '24px', borderRadius: 'var(--r8)' }}>
            {/* Governing thought hero */}
            <div className="deliverable-header" style={{ marginBottom: 24 }}>
              <div className="deliverable-label">Governing Thought</div>
              <div className="deliverable-governing-thought">"{doc.governing_thought}"</div>
              <p style={{ color: 'var(--t2)', fontSize: '0.9375rem', margin: 0, position: 'relative', zIndex: 1, lineHeight: 1.6 }}>
                {doc.executive_summary?.slice(0, 240)}…
              </p>
            </div>

            {/* Confidence chart */}
            <div className="deliverable-stats-grid" style={{ marginBottom: 24 }}>
              <div className="card">
                <h4 style={{ marginBottom: 16 }}>Evidence Quality Distribution</h4>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={confidenceSummary} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--warm-grey)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ border: '1px solid var(--warm-grey)', borderRadius: 8, boxShadow: 'var(--shadow)' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {confidenceSummary.map((entry, i) => (
                        <rect key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h4 style={{ marginBottom: 16 }}>At a Glance</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Findings reviewed</span>
                    <span style={{ fontWeight: 600 }}>{findings.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Report sections</span>
                    <span style={{ fontWeight: 600 }}>{doc.sections?.length ?? 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Recommendations</span>
                    <span style={{ fontWeight: 600 }}>{doc.recommendations?.length ?? 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Roadmap phases</span>
                    <span style={{ fontWeight: 600 }}>{doc.roadmap?.length ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {(['report', 'roadmap', 'appendix'] as const).map(tab => (
                <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === 'report' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {doc.sections?.map((section, i) => (
                  <div key={section.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                      <span style={{
                        minWidth: 36, height: 36, background: 'var(--navy)', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--gold)',
                        fontSize: '1rem', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <h3 style={{ fontSize: '1.25rem', marginTop: 4 }}>{section.title}</h3>
                    </div>
                    <p style={{ lineHeight: 1.75, color: 'var(--ink)', margin: 0 }}>{section.content}</p>
                    {section.chart && (
                      <div style={{ marginTop: 24, height: 260, width: '100%', background: 'var(--bg-1)', borderRadius: 8, padding: 12, border: '1px solid var(--b2)' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          {section.chart.type === 'bar' ? (
                            <BarChart data={section.chart.data}>
                              <XAxis dataKey="label" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                              <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                              <Tooltip cursor={{ fill: 'var(--bg-3)' }} contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--b2)', borderRadius: 6 }} />
                              <Bar dataKey="value" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          ) : section.chart.type === 'line' ? (
                            <LineChart data={section.chart.data}>
                              <XAxis dataKey="label" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                              <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--b2)', borderRadius: 6 }} />
                              <Line type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2} dot={{ r: 4, fill: 'var(--bg-1)', stroke: 'var(--gold)' }} />
                            </LineChart>
                          ) : (
                            <PieChart>
                              <Pie data={section.chart.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80} fill="var(--gold)" label>
                                {section.chart.data.map((_, index) => <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--gold)' : 'var(--accent)'} />)}
                              </Pie>
                              <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--b2)', borderRadius: 6 }} />
                            </PieChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                ))}

                {/* Recommendations */}
                <div className="card">
                  <h3 style={{ marginBottom: 20 }}>Recommendations</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {doc.recommendations?.map((rec, i) => (
                      <div key={rec.id} className={`card card-sm recommendation-priority-${rec.priority}`} style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1.0625rem', fontWeight: 600, color: 'var(--navy)' }}>
                            {i + 1}. {rec.title}
                          </span>
                          <PriorityBadge priority={rec.priority} />
                        </div>
                        <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6 }}>{rec.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'roadmap' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {doc.roadmap?.map((phase, i) => (
                  <div key={phase.phase} style={{ display: 'flex', gap: 20, position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 36, height: 36, background: 'var(--navy)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', fontFamily: 'var(--font-sans)', fontWeight: 600, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      {i < (doc.roadmap?.length ?? 0) - 1 && (
                        <div style={{ width: 1, flex: 1, background: 'var(--warm-grey2)', marginTop: 4, marginBottom: 4, minHeight: 32 }} />
                      )}
                    </div>
                    <div className="card card-sm" style={{ flex: 1, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <h3 style={{ fontSize: '1rem' }}>{phase.phase}</h3>
                        <span className="badge badge-navy">{phase.timeline}</span>
                      </div>
                      <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {phase.actions?.map((action, j) => (
                          <li key={j} style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.5 }}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'appendix' && (
              <div>
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="alert alert-info">
                    <CheckCircle size={16} />
                    Every finding stored in this engagement is tracked with its source URL, retrieval timestamp, and confidence level.
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {findings.map((f, i) => (
                    <div key={f.id} className="finding-card">
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span className="citation">{i + 1}</span>
                        <p className="finding-content" style={{ margin: 0, flex: 1 }}>{f.content}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <ConfidenceBadge confidence={f.confidence} />
                        {f.source_url && (
                          <a href={f.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--gold-dark)' }}>
                            <ExternalLink size={10} />
                            {f.source_title ?? f.source_url}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="alert alert-warn" style={{ marginTop: 32 }}>
              <CheckCircle size={16} />
              This report is an AI-generated first-pass draft, not certified financial, legal, or strategic advice. Verify all data points before making decisions.
            </div>
          </div>
        )}
      </div>

      {/* Hidden PDF Print View */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={contentRef}>
          {doc && engagement && (
            <DeliverablePrintView 
              engagement={engagement} 
              doc={doc} 
              findings={findings} 
              confidenceSummary={confidenceSummary} 
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
