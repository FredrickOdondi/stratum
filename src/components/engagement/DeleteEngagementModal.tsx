import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';

interface DeleteEngagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName: string;
}

export function DeleteEngagementModal({ isOpen, onClose, onConfirm, clientName }: DeleteEngagementModalProps) {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const isMatch = inputValue.trim() === clientName.trim();

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 400, padding: 24, position: 'relative' }}>
        <button onClick={() => { setInputValue(''); onClose(); }} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, color: 'var(--red)' }}>
          <Trash2 size={24} />
          <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>Delete Engagement</h2>
        </div>

        <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
          This action is permanent and cannot be undone. All documents, analysis, and deliverables will be permanently lost.
        </p>

        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Please type <strong>{clientName}</strong> to confirm.
        </label>
        
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={clientName}
          style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', marginBottom: 24, fontSize: '0.9375rem' }}
        />

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button 
            onClick={() => { setInputValue(''); onClose(); }}
            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (isMatch) {
                onConfirm();
                setInputValue('');
                onClose();
              }
            }}
            disabled={!isMatch}
            style={{ padding: '8px 16px', background: 'var(--red)', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', cursor: isMatch ? 'pointer' : 'not-allowed', fontWeight: 500, opacity: isMatch ? 1 : 0.5, transition: 'opacity 0.2s ease' }}
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}
