import { useState } from 'react';
import { X, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { saveConnector } from '../../lib/connectorStorage';
import { supabase } from '../../lib/supabase';

export interface ApiKeyField {
  key: string;
  label: string;
  placeholder: string;
  helpText?: string;
  type?: 'text' | 'password' | 'file';
}

export interface ConnectorConfig {
  id: string;
  name: string;
  domain: string;
  description: string;
  authType: 'oauth' | 'apikey';
  iconUrl?: string;
  docsUrl?: string;
  fields?: ApiKeyField[];
  oauthUrl?: string;
  oauthScopes?: string[];
}

interface ConnectModalProps {
  config: ConnectorConfig;
  onClose: () => void;
  onConnected: () => void;
}

export function ConnectModal({ config, onClose, onConnected }: ConnectModalProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [file, setFile] = useState<File | null>(null);

  async function handleApiKeySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let finalFieldValues = { ...fieldValues };
    const fileFields = config.fields?.filter(f => f.type === 'file') || [];

    if (fileFields.length > 0) {
      if (!file) {
        setError('Please select a file to upload');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError('You must be logged in to upload a file.');
        setLoading(false);
        return;
      }

      const filePath = `${userData.user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('csv_uploads')
        .upload(filePath, file);

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      // Save the internal file path instead of a public URL to keep it secure
      finalFieldValues[fileFields[0].key] = filePath;
    } else {
      const missing = config.fields?.filter(f => !finalFieldValues[f.key]?.trim());
      if (missing && missing.length > 0) {
        setError(`Please fill in: ${missing.map(f => f.label).join(', ')}`);
        setLoading(false);
        return;
      }
    }

    const displayName = finalFieldValues['store_url'] || finalFieldValues['subdomain'] || file?.name || (finalFieldValues['api_key'] ? finalFieldValues['api_key'].slice(0, 12) + '...' : config.name);
    const { error: saveError } = await saveConnector(config.id, finalFieldValues, displayName);
    setLoading(false);

    if (saveError) { setError(saveError); return; }

    setSuccess(true);
    setTimeout(() => { onConnected(); onClose(); }, 1500);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-2)',
        borderRadius: 'var(--r16)',
        width: 480,
        maxWidth: '90vw',
        border: '1px solid var(--b2)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1001,
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--b2)', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-2)' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--r8)',
            background: config.iconUrl ? '#00C3F7' : 'var(--bg-3)',
            border: '1px solid var(--b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden',
          }}>
            {config.iconUrl
              ? <img src={config.iconUrl} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              : <img src={`https://www.google.com/s2/favicons?domain=${config.domain}&sz=128`} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
            }
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', color: 'var(--t1)', margin: '0 0 4px 0' }}>
              Connect {config.name}
            </h2>
            <p style={{ color: 'var(--t2)', fontSize: '0.875rem', margin: 0 }}>{config.description}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 4, display: 'flex', alignItems: 'center' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', background: 'var(--bg-2)' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle2 size={48} color="var(--green)" style={{ marginBottom: 16 }} />
              <p style={{ color: 'var(--t1)', fontWeight: 600, fontSize: '1.125rem', marginBottom: 8 }}>Connected!</p>
              <p style={{ color: 'var(--t2)', fontSize: '0.875rem' }}>
                {config.name} is now connected to Stratum.
              </p>
            </div>
          ) : (
            <form onSubmit={handleApiKeySubmit}>
              {config.docsUrl && (
                <a
                  href={config.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--gold)', fontSize: '0.8125rem', marginBottom: 20, textDecoration: 'none' }}
                >
                  <ExternalLink size={13} /> How to find your API key
                </a>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                {config.fields?.map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', color: 'var(--t1)', fontSize: '0.875rem', fontWeight: 500, marginBottom: 6 }}>
                      {field.label}
                    </label>
                    {field.type === 'file' ? (
                      <input
                        type="file"
                        accept=".csv"
                        onChange={e => e.target.files && setFile(e.target.files[0])}
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 'var(--r8)',
                          border: '1px solid var(--b2)',
                          background: 'var(--bg-3)',
                          color: 'var(--t1)',
                          fontSize: '0.875rem',
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <input
                        type={field.type ?? 'text'}
                        placeholder={field.placeholder}
                        value={fieldValues[field.key] ?? ''}
                        onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 'var(--r8)',
                          border: '1px solid var(--b2)',
                          background: 'var(--bg-3)',
                          color: 'var(--t1)',
                          fontSize: '0.875rem',
                          fontFamily: field.type === 'password' ? 'var(--mono)' : 'inherit',
                          letterSpacing: field.type === 'password' ? '0.05em' : 'inherit',
                          outline: 'none',
                        }}
                      />
                    )}
                    {field.helpText && (
                      <p style={{ color: 'var(--t3)', fontSize: '0.75rem', marginTop: 4, lineHeight: 1.5 }}>{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--red-dim)',
                  border: '1px solid var(--red)',
                  borderRadius: 'var(--r8)', padding: '12px', marginBottom: 16,
                  color: 'var(--red)', fontSize: '0.875rem'
                }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', gap: 10, padding: '14px' }}
              >
                {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                {loading ? 'Saving...' : 'Test & Connect'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
