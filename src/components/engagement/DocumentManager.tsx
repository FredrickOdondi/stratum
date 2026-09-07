import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { uploadAndSaveDocument } from '../../lib/documentParser';
import type { Document } from '../../types';

interface DocumentManagerProps {
  engagementId: string;
  onDocumentsChanged?: () => void;
}

function fileExt(name: string) {
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

export function DocumentManager({ engagementId, onDocumentsChanged }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadDocuments(); }, [engagementId]);

  async function loadDocuments() {
    if (!engagementId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('engagement_id', engagementId)
        .order('name', { ascending: true });
      setDocuments((data as Document[]) || []);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      for (const file of arr) {
        await uploadAndSaveDocument(engagementId, file);
      }
      setSuccess(`${arr.length} document${arr.length > 1 ? 's' : ''} uploaded, parsed, and embedded in Pinecone.`);
      await loadDocuments();
      if (onDocumentsChanged) onDocumentsChanged();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(docId: string, docName: string) {
    if (!confirm(`Remove "${docName}" from this engagement?`)) return;
    try {
      const { error } = await supabase.from('documents').delete().eq('id', docId);
      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== docId));
      if (onDocumentsChanged) onDocumentsChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  }


  function onDragOver(e: React.DragEvent) { e.preventDefault(); setDragging(true); }
  function onDragLeave() { setDragging(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="section-heading" style={{ margin: 0, marginBottom: 4 }}>
            Documents {documents.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', textTransform: 'none', letterSpacing: 0, fontSize: '0.875rem' }}>({documents.length})</span>}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: 0 }}>
            Uploaded files are chunked and fed into all AI agents.
          </p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={e => e.target.files && uploadFiles(e.target.files)}
          multiple
          accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json,.tsv"
          style={{ display: 'none' }}
        />
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12, fontSize: '0.8125rem' }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: 12, fontSize: '0.8125rem' }}>
          <CheckCircle2 size={13} /> {success}
        </div>
      )}

      {/* Document list */}
      {!loading && documents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {documents.map(doc => {
            const chunks = Array.isArray(doc.parsed_chunks) ? doc.parsed_chunks.length : 0;
            return (
              <div key={doc.id} className="doc-row">
                <div className="doc-icon">
                  <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.03em', color: 'var(--accent)' }}>
                    {fileExt(doc.name)}
                  </span>
                </div>
                <div className="doc-name">{doc.name}</div>
                <div className="doc-meta">{chunks} chunk{chunks !== 1 ? 's' : ''}</div>
                <button
                  onClick={() => handleDelete(doc.id, doc.name)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                  title="Remove document"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Drop zone */}
      <label
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{ cursor: uploading ? 'default' : 'pointer' }}
      >
        {uploading ? (
          <>
            <span className="spinner spinner-sm" />
            <span className="drop-zone-label">Processing &amp; chunking…</span>
          </>
        ) : (
          <>
            <div className="drop-zone-icon">
              <Upload size={16} />
            </div>
            <span className="drop-zone-label">
              {documents.length > 0 ? 'Upload more documents' : 'Drop files here or click to upload'}
            </span>
            <span className="drop-zone-hint">PDF, DOCX, XLSX, CSV, TXT — any file type</span>
          </>
        )}
      </label>
    </div>
  );
}
