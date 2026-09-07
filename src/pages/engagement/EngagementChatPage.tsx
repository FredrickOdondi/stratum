import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Bot, User, Send, Loader2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import { streamEngagementAgent } from '../../lib/openai';
import type { Engagement, Finding } from '../../types';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  context_used?: string;
}

export function EngagementChatPage() {
  const { id } = useParams<{ id: string }>();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      supabase.from('engagements').select('*').eq('id', id).single().then(res => {
        if (res.data) setEngagement(res.data as Engagement);
      });
      supabase.from('findings').select('*').eq('engagement_id', id).then(res => {
        if (res.data) setFindings(res.data as Finding[]);
      });
    }
  }, [id]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  async function handleSend() {
    if (!input.trim() || !engagement || isTyping || !id) return;
    
    const query = input.trim();
    setInput('');
    const userMsgId = Date.now().toString();
    const agentMsgId = (Date.now() + 1).toString();

    setMessages(prev => [
      ...prev, 
      { id: userMsgId, role: 'user', content: query },
      { id: agentMsgId, role: 'agent', content: '', context_used: '' }
    ]);
    setIsTyping(true);

    try {
      await streamEngagementAgent(
        id, 
        engagement, 
        findings, 
        query, 
        (chunk) => {
          setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: m.content + chunk } : m));
        },
        (source) => {
          setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, context_used: source } : m));
        }
      );
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: 'Sorry, I encountered an error streaming the response.' } : m));
    }
    
    setIsTyping(false);
  }

  return (
    <AppShell engagementId={id} currentStage="chat" completedStages={[]}>
      <div className="page" style={{ height: 'calc(100vh - var(--topbar-h))', display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>


        {/* Chat Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '10vh', color: 'var(--t2)' }}>
              <Bot size={48} style={{ margin: '0 auto 16px', opacity: 0.5, color: 'var(--gold)' }} />
              <h3 style={{ marginBottom: 8, color: 'var(--t1)' }}>How can I help you?</h3>
              <p style={{ maxWidth: 400, margin: '0 auto', fontSize: '0.875rem' }}>
                Ask me about the progress of the research, or query specific findings and data points for this engagement.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800, margin: '0 auto' }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    overflow: 'hidden',
                    background: msg.role === 'agent' ? 'var(--gold-lo)' : 'var(--bg-3)',
                    border: '1px solid', borderColor: msg.role === 'agent' ? 'var(--b-accent)' : 'var(--b2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: msg.role === 'agent' ? 'var(--gold)' : 'var(--t2)'
                  }}>
                    {msg.role === 'agent' ? <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="Agent" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <User size={18} />}
                  </div>
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--t1)', marginBottom: 4 }}>
                      {msg.role === 'agent' ? 'Marcus Tree' : 'You'}
                    </div>
                    <div style={{ color: 'var(--t2)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                      <div className="synthesis-text">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                    {msg.context_used && (
                      <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--t2)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 'var(--r6)', border: '1px solid var(--b1)' }}>
                        <strong>Intelligence Sources:</strong> {msg.context_used}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--b1)' }}>
                    <Loader2 size={16} className="spin" color="var(--gold)" />
                  </div>
                  <div style={{ padding: '8px 0', color: 'var(--t2)' }}>Thinking...</div>
                </div>
              )}
              <div ref={endOfMessagesRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div style={{ padding: '24px 32px', background: 'transparent', flexShrink: 0, paddingBottom: '32px' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative' }}>
            <textarea
              className="input-field"
              placeholder="Ask about research progress or dive deep into the findings..."
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={e => { 
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(); 
                }
              }}
              disabled={isTyping}
              rows={1}
              style={{ 
                width: '100%',
                minHeight: '60px',
                maxHeight: '200px',
                resize: 'none',
                background: 'var(--bg-2)',
                border: '1px solid var(--b2)',
                borderRadius: '16px',
                padding: '18px 24px',
                paddingRight: '64px',
                fontSize: '1rem',
                lineHeight: 1.5,
                color: 'var(--t1)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.03)',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
              }}
            />
            <button 
              onClick={handleSend} 
              disabled={!input.trim() || isTyping}
              style={{
                position: 'absolute',
                right: '12px',
                bottom: '12px',
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                background: input.trim() ? 'var(--gold)' : 'var(--b1)',
                color: input.trim() ? 'var(--bg)' : 'var(--t2)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
