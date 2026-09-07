import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Upload, X, ChevronDown } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { uploadAndSaveDocument } from '../../lib/documentParser';
import { loadConnectors, type ConnectorCredential } from '../../lib/connectorStorage';
import { usePaystackPayment } from 'react-paystack';

function MultiSelectDropdown({ options, value, onChange, placeholder }: { options: any[], value: string, onChange: (v: string) => void, placeholder: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedValues = value ? value.split(',') : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabels = selectedValues.map((v: string) => {
    const opt = options.find((o: any) => o.value === v);
    return opt ? opt.label : v;
  });

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="form-input" 
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}
      >
        <span style={{ color: selectedLabels.length ? 'var(--text)' : 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabels.length ? selectedLabels.join(', ') : placeholder}
        </span>
        <ChevronDown size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
      </div>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--bg-2)', border: '1px solid var(--b2)', borderRadius: '6px', zIndex: 10, padding: '4px', boxShadow: 'var(--sh2)', maxHeight: 250, overflowY: 'auto' }}>
          {options.map((opt: any) => {
            const isChecked = selectedValues.includes(opt.value);
            return (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderRadius: 4, margin: 2, background: isChecked ? 'var(--bg-3)' : 'transparent' }}>
                <input 
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    let newVals = [...selectedValues];
                    if (checked) {
                      if (!newVals.includes(opt.value)) newVals.push(opt.value);
                    } else {
                      newVals = newVals.filter((v: string) => v !== opt.value);
                    }
                    onChange(newVals.join(','));
                  }}
                  style={{ accentColor: 'var(--gold)', width: 16, height: 16, margin: 0 }}
                />
                <span style={{ fontSize: '0.875rem', color: 'var(--t1)' }}>{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SECTIONS = [
  {
    title: 'Client & Context',
    fields: [
      { id: 'company', label: 'Company / Client Name', type: 'text', placeholder: 'e.g. Acme Corp', required: true },
      { id: 'industry', label: 'Industry', type: 'select', options: ['Technology & Software', 'Financial Services', 'Healthcare & Life Sciences', 'Consumer & Retail', 'Energy & Utilities', 'Industrial & Manufacturing', 'Media & Entertainment', 'Real Estate', 'Professional Services', 'Other'], required: true },
      { id: 'geography', label: 'Geography / Market Focus', type: 'text', placeholder: 'e.g. North America, UK, Global', required: false },
    ],
  },
  {
    title: 'Business Question',
    fields: [
      { id: 'business_question', label: 'Core Business Question', type: 'textarea', placeholder: 'What is the one most important question this engagement must answer? e.g. "Should we enter the Southeast Asian market, and if so, how?"', required: true },
      { id: 'decision', label: 'Decision to be Made', type: 'textarea', placeholder: 'What decision will be made based on this analysis? Who will make it?', required: false },
      { id: 'competitors', label: 'Key Competitors', type: 'text', placeholder: 'e.g. Competitor A, Competitor B', required: false },
      { id: 'timeline', label: 'Engagement Timeline', type: 'select', options: ['Less than 1 week', '1–2 weeks', '2–4 weeks', '1–3 months', '3–6 months'], required: false },
    ],
  },
  {
    title: 'Additional Context',
    fields: [
      { id: 'context', label: 'Background & Constraints', type: 'textarea', placeholder: 'Any other relevant background: current strategy, constraints, existing data, key stakeholders, etc.', required: false },
    ],
  },
];

export function NewEngagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [connectors, setConnectors] = useState<ConnectorCredential[]>([]);
  
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [engagementCount, setEngagementCount] = useState(0);
  const [checkingLimit, setCheckingLimit] = useState(true);

  useEffect(() => {
    if (user) {
      loadConnectors().then(setConnectors);
      
      // Fetch tier and engagement count
      Promise.all([
        supabase.from('user_subscriptions').select('tier').eq('user_id', user.id).single(),
        supabase.from('engagements').select('id', { count: 'exact' }).eq('owner_id', user.id)
      ]).then(([tierRes, countRes]) => {
        if (tierRes.data) setTier(tierRes.data.tier);
        if (countRes.count !== null) setEngagementCount(countRes.count);
        setCheckingLimit(false);
      });
    }
  }, [user]);

  const config = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || 'test@stratum.com',
    amount: 10 * 100, // 10 KES
    publicKey: 'pk_live_82a92343e08ef9d76f653ae86e0664d098685e20',
    currency: 'KES',
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async () => {
    // Call the RPC function to upgrade the user
    const { error } = await supabase.rpc('upgrade_to_pro');
    if (error) {
      console.error('Failed to upgrade to pro:', error);
      alert('Payment successful, but failed to upgrade account. Please contact support.');
    } else {
      // Reload state locally to unlock the form
      setTier('pro');
      window.location.reload();
    }
  };

  const onClose = () => {
    console.log('Payment modal closed');
  };

  const sectionsWithConnectors = [
    {
      title: 'Data Integration',
      fields: [
        { 
          id: 'connected_app_ids', 
          label: 'Attach Connected Apps', 
          type: 'multiselect', 
          options: connectors.map(c => ({ label: c.display_name, value: c.id })),
          required: false,
          placeholder: 'Select connected apps (Optional)'
        }
      ]
    },
    ...SECTIONS
  ];

  const allRequiredFields = sectionsWithConnectors.flatMap(s => s.fields).filter(f => f.required);
  const isValid = allRequiredFields.every(f => values[f.id]?.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !isValid) return;
    setSaving(true);
    setError('');
    try {
      const { data: eng, error: engErr } = await supabase
        .from('engagements')
        .insert({ owner_id: user.id, client_name: values.company, industry: values.industry ?? '', business_question: values.business_question, stage: 'scoping' })
        .select().single();
      if (engErr || !eng) throw engErr ?? new Error('Failed to create engagement');
      const answers = Object.entries(values).map(([field, value]) => ({ engagement_id: eng.id, field, value }));
      await supabase.from('intake_answers').insert(answers);
      
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          setUploadProgress(`Uploading to Pinecone (${i + 1}/${files.length})...`);
          await uploadAndSaveDocument(eng.id, files[i]);
        }
      }

      navigate(`/engagement/${eng.id}/scoping`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
      setUploadProgress(null);
    }
  }

  function addFiles(fileList: FileList | File[]) {
    setFiles(prev => [...prev, ...Array.from(fileList)]);
  }

  return (
    <AppShell>
      <div className="new-engagement-container" style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div className="badge badge-gold" style={{ marginBottom: 12 }}>New Engagement</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 8 }}>Define the engagement</h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
            Scope the project so the AI agents have everything they need to begin.
          </p>
        </div>

        {checkingLimit ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner spinner-gold" style={{ margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--text-tertiary)' }}>Checking account limits...</div>
          </div>
        ) : tier === 'free' && engagementCount >= 3 ? (
          <div className="form-section animate-in" style={{ textAlign: 'center', padding: '60px 40px', background: 'var(--navy)' }}>
            <div className="badge badge-gold" style={{ margin: '0 auto 16px' }}>Limit Reached</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              You've reached your free limit
            </h2>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
              Free accounts are limited to 3 engagements. Upgrade to Pro for unlimited engagements and advanced features.
            </p>
            <button 
              className="btn-hero-primary" 
              onClick={() => initializePayment({ onSuccess, onClose })}
              style={{ height: '48px', padding: '0 32px', fontSize: '1rem' }}
            >
              Upgrade to Pro — 10 KES/mo
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sectionsWithConnectors.map((section, si) => (
            <div key={section.title} className="form-section animate-in" style={{ animationDelay: `${si * 0.06}s`, position: 'relative', zIndex: 100 - si }}>
              <div className="form-section-title">{section.title}</div>
              {section.fields.map(field => (
                <div key={field.id} className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">
                    {field.label}
                    {field.required && <span style={{ color: 'var(--error)', marginLeft: 3 }}>*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="form-textarea"
                      placeholder={field.placeholder}
                      value={values[field.id] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                      rows={3}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className="form-select"
                      value={values[field.id] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      {field.options?.map(opt => (
                        typeof opt === 'string' 
                          ? <option key={opt} value={opt}>{opt}</option>
                          : <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'multiselect' ? (
                    <MultiSelectDropdown 
                      options={field.options || []}
                      value={values[field.id] || ''}
                      onChange={(newVal) => setValues(v => ({ ...v, [field.id]: newVal }))}
                      placeholder={field.placeholder || 'Select...'}
                    />
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      placeholder={field.placeholder}
                      value={values[field.id] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* File Upload */}
          <div className="form-section animate-in" style={{ animationDelay: '0.18s' }}>
            <div className="form-section-title">Supporting Documents</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              Upload financials, decks, CRM exports, or market data. The platform will reason over your actual numbers.
            </p>

            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {files.map((f, i) => (
                  <div key={i} className="doc-row">
                    <div className="doc-icon">
                      <span style={{ fontSize: '0.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                        {f.name.split('.').pop()?.toUpperCase()}
                      </span>
                    </div>
                    <div className="doc-name">{f.name}</div>
                    <div className="doc-meta">{(f.size / 1024).toFixed(0)} KB</div>
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4, display: 'flex' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label
              className={`drop-zone ${dragging ? 'dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
              style={{ cursor: 'pointer' }}
            >
              <div className="drop-zone-icon"><Upload size={16} /></div>
              <span className="drop-zone-label">{files.length > 0 ? 'Upload more documents' : 'Drop files here or click to upload'}</span>
              <span className="drop-zone-hint">PDF, DOCX, XLSX, CSV, TXT</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={e => e.target.files && addFiles(e.target.files)}
                accept=".pdf,.docx,.xlsx,.csv,.pptx,.txt"
              />
            </label>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
            <button type="submit" className="btn btn-gold btn-lg" disabled={!isValid || saving}>
              {saving ? <span className="spinner spinner-sm spinner-gold" /> : <ArrowRight size={16} />}
              {saving ? (uploadProgress || 'Creating engagement…') : 'Create Engagement'}
            </button>
          </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
