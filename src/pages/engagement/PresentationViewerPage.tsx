import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Download } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';

export function PresentationViewerPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pptxUrl = searchParams.get('url');
  
  const [isLoading, setIsLoading] = useState(true);

  if (!id || !pptxUrl) {
    return (
      <AppShell engagementId={id!} currentStage="deliverable" completedStages={['scoping', 'issue_tree', 'research', 'analysis', 'synthesis', 'quality_check']}>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p>No presentation URL provided.</p>
          <button className="btn btn-outline" onClick={() => navigate(`/engagement/${id}/deliverable`)}>Go Back</button>
        </div>
      </AppShell>
    );
  }

  // Microsoft Office Web Viewer requires the URL to be properly encoded
  const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(pptxUrl)}`;

  return (
    <AppShell engagementId={id} currentStage="deliverable" completedStages={['scoping', 'issue_tree', 'research', 'analysis', 'synthesis', 'quality_check']}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-2)' }}>
        
        {/* Top Bar */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '16px 24px', 
          background: 'var(--bg-1)',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button 
              className="btn btn-ghost" 
              style={{ padding: '8px', marginLeft: -8 }}
              onClick={() => navigate(`/engagement/${id}/deliverable`)}
              title="Back to Deliverable"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: 0 }}>Presentation Viewer</h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href={pptxUrl} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ textDecoration: 'none' }}>
              <Download size={15} />
              Download File
            </a>
            <a href={viewerUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <ExternalLink size={15} />
              Open in Full Screen
            </a>
          </div>
        </div>

        {/* Viewer Area */}
        <div style={{ flex: 1, position: 'relative' }}>
          {isLoading && (
            <div style={{ 
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-2)', zIndex: 10
            }}>
              <span className="spinner" style={{ width: 32, height: 32, marginBottom: 16, borderTopColor: 'var(--gold)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Loading Microsoft Office Viewer...</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: 8 }}>This may take a few seconds.</p>
            </div>
          )}
          <iframe 
            src={viewerUrl} 
            width="100%" 
            height="100%" 
            frameBorder="0"
            onLoad={() => setIsLoading(false)}
            title="PPTX Viewer"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 }}
          />
        </div>
      </div>
    </AppShell>
  );
}
