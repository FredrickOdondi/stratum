import { useState, useEffect, useRef } from 'react';
import { Bot, User, Send, Loader2, Database, Code, LayoutDashboard } from 'lucide-react';
import { loadConnectors, type ConnectorCredential } from '../../lib/connectorStorage';
import { fetchSupabaseSchemaDetailed } from '../../lib/dataFetcher';
import { askUniversalDataAgent, askGlobalKnowledgeAgent, type DataAgentResponse } from '../../lib/dataAgent';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { AppShell } from '../../components/layout/AppShell';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  query_used?: string;
  data_retrieved?: any;
}

export function AskAIPage() {
  const { user } = useAuth();
  const [connectors, setConnectors] = useState<ConnectorCredential[]>([]);
  const [userEngagements, setUserEngagements] = useState<any[]>([]);
  const [activeConnectorId, setActiveConnectorId] = useState<string>('global_knowledge');
  const [schemaStr, setSchemaStr] = useState<string>('');
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadConnectors().then(data => {
        setConnectors(data);
      });
      supabase.from('engagements').select('id, client_name, business_question').eq('owner_id', user.id)
        .then(({ data }) => setUserEngagements(data || []));
    }
  }, [user]);

  const activeConnector = connectors.find(c => c.id === activeConnectorId);

  useEffect(() => {
    if (activeConnector?.connector_id === 'supabase') {
      setLoadingSchema(true);
      let creds = activeConnector.credentials;
      if (typeof creds === 'string') creds = JSON.parse(creds);
      
      fetchSupabaseSchemaDetailed(creds.project_url, creds.service_role_key)
        .then(setSchemaStr)
        .catch(() => setSchemaStr('Failed to fetch schema.'))
        .finally(() => setLoadingSchema(false));
    } else {
      setSchemaStr('');
    }
  }, [activeConnector]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  async function handleSend() {
    if (!input.trim() || (!activeConnector && activeConnectorId !== 'global_knowledge') || isTyping) return;
    
    // For supabase, we still need schema to be loaded
    if (activeConnector?.connector_id === 'supabase' && !schemaStr) {
      setMessages(prev => [...prev, 
        { id: Date.now().toString(), role: 'user', content: input },
        { id: (Date.now() + 1).toString(), role: 'agent', content: 'Database schema is not loaded yet. Please wait.' }
      ]);
      setInput('');
      return;
    }

    const query = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: query }]);
    setIsTyping(true);

    let res: DataAgentResponse;

    if (activeConnectorId === 'global_knowledge') {
      res = await askGlobalKnowledgeAgent(user!.id, query, userEngagements);
    } else if (activeConnector) {
      let creds = activeConnector.credentials;
      if (typeof creds === 'string') creds = JSON.parse(creds);

      res = await askUniversalDataAgent(
        query,
        activeConnector.connector_id,
        activeConnector.display_name,
        creds,
        schemaStr
      );
    } else {
      res = { answer: 'No active connector.' };
    }
    
    setIsTyping(false);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'agent',
      content: res.answer,
      query_used: res.query_used,
      data_retrieved: res.data_retrieved
    }]);
  }

  return (
    <AppShell>
      <div className="page" style={{ height: 'calc(100vh - var(--topbar-h))', display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
        {/* Compact Header Area */}
        <div style={{ padding: '12px 32px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'var(--gold-lo)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', overflow: 'hidden' }}>
              <img src="https://randomuser.me/api/portraits/women/68.jpg" alt="Data Agent" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
            </div>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--t1)', lineHeight: 1.2 }}>Elena Data</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--t3)' }}>Query your connected data</div>
            </div>
          </div>

          {(connectors.length > 0 || true) && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              <button
                onClick={() => setActiveConnectorId('global_knowledge')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: '6px',
                  border: '1px solid',
                  borderColor: activeConnectorId === 'global_knowledge' ? 'var(--b-accent)' : 'var(--b2)',
                  background: activeConnectorId === 'global_knowledge' ? 'var(--gold-lo)' : 'var(--bg-2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '0.75rem',
                  fontWeight: activeConnectorId === 'global_knowledge' ? 600 : 500,
                  color: activeConnectorId === 'global_knowledge' ? 'var(--gold)' : 'var(--t2)'
                }}
              >
                <Bot size={12} />
                Global Knowledge Base
              </button>
              {connectors.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveConnectorId(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: '6px',
                    border: '1px solid',
                    borderColor: activeConnectorId === c.id ? 'var(--b-accent)' : 'var(--b2)',
                    background: activeConnectorId === c.id ? 'var(--gold-lo)' : 'var(--bg-2)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '0.75rem',
                    fontWeight: activeConnectorId === c.id ? 600 : 500,
                    color: activeConnectorId === c.id ? 'var(--gold)' : 'var(--t2)'
                  }}
                >
                  <Database size={12} />
                  {c.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-2)' }}>
        {false ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}>
            Please connect a platform first in the Connectors page.
          </div>
        ) : (
          <>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--t3)', marginTop: '10vh' }}>
                  <Bot size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
                  <h3 style={{ color: 'var(--t2)', marginBottom: 8 }}>What do you want to know?</h3>
                  <p style={{ fontSize: '0.875rem' }}>Ask questions about your {activeConnectorId === 'global_knowledge' ? 'global knowledge base across all engagements' : `${activeConnector?.display_name} data`}.</p>
                  {loadingSchema && (
                    <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '0.8125rem' }}>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      Analyzing database schema...
                    </div>
                  )}
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
                        {msg.role === 'agent' ? <img src="https://randomuser.me/api/portraits/women/68.jpg" alt="Data Agent" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <User size={18} />}
                      </div>
                      <div style={{ flex: 1, paddingTop: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--t1)', marginBottom: 4 }}>
                          {msg.role === 'agent' ? 'Elena Data' : 'You'}
                        </div>
                        <div style={{ color: 'var(--t2)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        {msg.query_used && (
                          <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--r6)', border: '1px solid var(--b1)', fontSize: '0.75rem', fontFamily: 'var(--mono)', color: 'var(--t3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontWeight: 600, color: 'var(--gold)' }}>
                              <Code size={12} /> Query Executed
                            </div>
                            {msg.query_used}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{ 
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                        background: 'var(--gold-lo)', border: '1px solid var(--b-accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)'
                      }}>
                        <img src="https://randomuser.me/api/portraits/women/68.jpg" alt="Data Agent" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                      </div>
                      <div style={{ flex: 1, paddingTop: 10 }}>
                        <div className="thinking-dots">
                          <span /><span /><span />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={endOfMessagesRef} />
                </div>
              )}
            </div>

            {/* Input Box */}
            <div style={{ padding: '24px 32px', borderTop: '1px solid var(--b1)', background: 'var(--bg)' }}>
              <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative' }}>
                <input 
                  type="text" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  placeholder={loadingSchema ? "Loading database schema..." : "Ask a question about your data..."}
                  disabled={loadingSchema || isTyping}
                  style={{
                    width: '100%', padding: '16px 20px', paddingRight: 64,
                    background: 'var(--bg-2)', border: '1px solid var(--b2)',
                    borderRadius: '100px', fontSize: '0.9375rem', color: 'var(--t1)',
                    boxShadow: 'var(--sh2)', outline: 'none'
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loadingSchema || isTyping}
                  style={{
                    position: 'absolute', right: 8, top: 8, bottom: 8,
                    width: 36, borderRadius: '50%',
                    background: input.trim() ? 'var(--gold)' : 'var(--bg-3)',
                    color: input.trim() ? 'var(--bg)' : 'var(--t3)',
                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Send size={16} style={{ marginLeft: -2 }} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </AppShell>
  );
}
