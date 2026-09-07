import { useState, useEffect } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Database, RefreshCw, Loader2, AlertCircle, Table as TableIcon, Link2 } from 'lucide-react';
import { loadConnectors, type ConnectorCredential } from '../../lib/connectorStorage';
import { fetchConsolidatedData, fetchSupabaseTables, type ConsolidatedDataResult } from '../../lib/dataFetcher';
import { useAuth } from '../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

function DataGrid({ streamName, data }: { streamName: string, data: any[] }) {
  const [page, setPage] = useState(0);
  const rowsPerPage = 30;
  
  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0]);
  const totalPages = Math.ceil(data.length / rowsPerPage);
  const paginatedData = data.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-1)' }}>
        <table style={{ 
          width: '100%', borderCollapse: 'collapse', textAlign: 'left',
          fontFamily: 'var(--mono), monospace', fontSize: '0.8125rem'
        }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-2)' }}>
            <tr>
              {headers.map(h => (
                <th key={h} style={{ 
                  padding: '8px 12px', fontWeight: 500, color: 'var(--t2)', 
                  borderRight: '1px solid var(--b2)', borderBottom: '1px solid var(--b2)',
                  whiteSpace: 'nowrap'
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--b1)' }}>
                {headers.map(h => {
                  let value = row[h];
                  const isNull = value === null || value === undefined;
                  
                  return (
                    <td key={h} style={{ 
                      padding: '6px 12px', color: isNull ? 'var(--t3)' : 'var(--t1)', 
                      borderRight: '1px solid var(--b2)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300
                    }}>
                      {isNull ? 'NULL' : (typeof value === 'object' ? JSON.stringify(value) : String(value))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      {data.length > rowsPerPage && (
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          padding: '12px 24px', background: 'var(--bg-2)', borderTop: '1px solid var(--b2)' 
        }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--t3)' }}>
            Showing {page * rowsPerPage + 1} - {Math.min((page + 1) * rowsPerPage, data.length)} of {data.length} rows
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '4px 12px', background: 'var(--bg-3)', border: '1px solid var(--b2)', 
                borderRadius: 6, cursor: page === 0 ? 'not-allowed' : 'pointer',
                color: page === 0 ? 'var(--t4)' : 'var(--t2)', fontSize: '0.8125rem',
                transition: 'all 0.2s ease'
              }}
            >
              Previous
            </button>
            <button 
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{
                padding: '4px 12px', background: 'var(--bg-3)', border: '1px solid var(--b2)', 
                borderRadius: 6, cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer',
                color: page === totalPages - 1 ? 'var(--t4)' : 'var(--t2)', fontSize: '0.8125rem',
                transition: 'all 0.2s ease'
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConsolidatedDataPage() {
  const { user } = useAuth();
  const [connectors, setConnectors] = useState<ConnectorCredential[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('stratum_active_tab');
      return saved ? parseInt(saved, 10) : 0;
    } catch { return 0; }
  });
  const [activeStreamIndices, setActiveStreamIndices] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('stratum_active_streams');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  
  const [schemas, setSchemas] = useState<Record<string, string[]>>({});
  const [selectedTables, setSelectedTables] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('stratum_selected_tables');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [fetchingSchemas, setFetchingSchemas] = useState<Record<string, boolean>>({});

  const activeConnector = connectors[activeTabIndex];

  useEffect(() => {
    localStorage.setItem('stratum_active_tab', activeTabIndex.toString());
  }, [activeTabIndex]);

  useEffect(() => {
    localStorage.setItem('stratum_active_streams', JSON.stringify(activeStreamIndices));
  }, [activeStreamIndices]);

  useEffect(() => {
    localStorage.setItem('stratum_selected_tables', JSON.stringify(selectedTables));
  }, [selectedTables]);

  useEffect(() => {
    if (activeConnector?.connector_id === 'supabase' && !schemas[activeConnector.id] && !fetchingSchemas[activeConnector.id]) {
      const fetchSchema = async () => {
        setFetchingSchemas(prev => ({ ...prev, [activeConnector.id]: true }));
        let credentials = activeConnector.credentials;
        if (typeof credentials === 'string') credentials = JSON.parse(credentials);
        
        const tables = await fetchSupabaseTables(credentials.project_url, credentials.service_role_key);
        setSchemas(prev => ({ ...prev, [activeConnector.id]: tables }));
        setFetchingSchemas(prev => ({ ...prev, [activeConnector.id]: false }));
      };
      fetchSchema();
    }
  }, [activeTabIndex, activeConnector, schemas, fetchingSchemas]);

  useEffect(() => {
    if (user) {
      loadConnectors().then(setConnectors);
    }
  }, [user]);

  const { data: results = [], isFetching: syncing, refetch } = useQuery({
    queryKey: ['consolidatedData', connectors.map(c => c.id), selectedTables],
    queryFn: async () => {
      const fetchPromises = connectors.map(conn => {
        let creds = conn.credentials;
        if (typeof creds === 'string') creds = JSON.parse(creds);
        
        let tablesToSync: string[] | undefined;
        if (conn.connector_id === 'supabase') {
          tablesToSync = selectedTables[conn.id] || [];
        }
        return fetchConsolidatedData(conn.connector_id, conn.display_name, creds, tablesToSync);
      });
      return await Promise.all(fetchPromises);
    },
    enabled: false, // User must explicitly click sync
  });

  async function handleSync() {
    if (connectors.length === 0) {
      setError('No integrations connected. Please connect at least one platform first.');
      return;
    }
    
    setError(null);
    try {
      await refetch();
    } catch (err) {
      setError('An error occurred while fetching data from your integrations.');
    }
  }

  // Format currency appropriately
  const formatMoney = (amount: string | number, currency = 'USD') => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(num);
  };

  // Format currency appropriately

  return (
    <AppShell>
      <div className="consolidated-data-container">
        {/* Header */}
        <div className="consolidated-data-header">
          <div>
            <div className="section-heading" style={{ marginBottom: '12px' }}>Platform Data</div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--t1)', lineHeight: 1.1, fontFamily: 'var(--font-sans)', margin: 0 }}>
              Consolidated Data
            </h1>
            <p style={{ fontSize: '0.9375rem', color: 'var(--t3)', marginTop: '8px' }}>
              View raw data streams pulled directly from your active integrations.
            </p>
          </div>
          <button 
            className="btn btn-gold" 
            onClick={handleSync}
            disabled={syncing}
            style={{ gap: 8, padding: '10px 20px', fontSize: '0.875rem', borderRadius: '100px', boxShadow: 'var(--sh2)' }}
          >
            {syncing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}
            {syncing ? 'Syncing Data...' : 'Sync All Data'}
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--r8)', color: 'var(--red)', marginBottom: 32 }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {/* Active App Tabs */}
        {connectors.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 8 }}>
              Connected Sources:
            </span>
            {connectors.map((conn, index) => {
              const domainMap: Record<string, string> = {
                shopify: 'shopify.com', woocommerce: 'woocommerce.com', bigcommerce: 'bigcommerce.com',
                amazon_seller: 'amazon.com', tiktok_shop: 'tiktok.com', stripe: 'stripe.com',
                paystack: 'paystack.com', paypal: 'paypal.com', recharge: 'rechargepayments.com',
                meta_ads: 'meta.com', google_ads: 'google.com', tiktok_ads: 'tiktok.com',
                pinterest_ads: 'pinterest.com', amazon_ads: 'amazon.com', klaviyo: 'klaviyo.com',
                attentive: 'attentive.com', postscript: 'postscript.io', omnisend: 'omnisend.com',
                mailchimp: 'mailchimp.com', ga4: 'google.com', triple_whale: 'triplewhale.com',
                northbeam: 'northbeam.io', yotpo: 'yotpo.com', okendo: 'okendo.io',
                smile: 'smile.io', loox: 'loox.app', shipstation: 'shipstation.com',
                cin7: 'cin7.com', gorgias: 'gorgias.com', zendesk: 'zendesk.com', skio: 'skio.com',
                supabase: 'supabase.com'
              };
              const iconOverride: Record<string, string> = {
                paystack: 'https://website-v3-assets.s3.amazonaws.com/assets/img/hero/Paystack-mark-white-twitter.png',
                csv: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Jonkerz_Icon_CSV.svg'
              };
              const domain = domainMap[conn.connector_id];
              const icon = iconOverride[conn.connector_id];
              const label = conn.display_name || conn.connector_id.replace(/_/g, ' ');
              
              const isActive = activeTabIndex === index;

              return (
                <button
                  key={conn.id}
                  title={label}
                  onClick={() => setActiveTabIndex(index)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', borderRadius: '100px',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--b3)' : 'transparent',
                    background: isActive ? 'var(--bg-2)' : 'transparent',
                    boxShadow: isActive ? 'var(--sh1)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 4,
                    background: icon ? 'transparent' : 'var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, overflow: 'hidden',
                  }}>
                    {icon
                      ? <img src={icon} alt={label} style={{ width: 12, height: 12, objectFit: 'contain' }} />
                      : domain
                        ? <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt={label} style={{ width: 12, height: 12, objectFit: 'contain' }} />
                        : <Link2 size={10} color="var(--t3)" />
                    }
                  </div>
                  <span style={{ 
                    fontSize: '0.8125rem', 
                    color: isActive ? 'var(--t1)' : 'var(--t3)', 
                    fontWeight: isActive ? 600 : 500, 
                    textTransform: 'capitalize' 
                  }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Supabase Table Selection UI */}
        {activeConnector?.connector_id === 'supabase' && (
          <div style={{ marginBottom: 48 }}>
            <div className="section-heading">Select Tables to Sync</div>
            {fetchingSchemas[activeConnector.id] ? (
               <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t3)' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Fetching tables...</div>
            ) : schemas[activeConnector.id] && schemas[activeConnector.id].length > 0 ? (
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                 {schemas[activeConnector.id].map(table => {
                   const isSelected = (selectedTables[activeConnector.id] || []).includes(table);
                   return (
                     <label key={table} style={{ 
                       display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', 
                       padding: '12px 16px', borderRadius: 'var(--r8)', 
                       background: isSelected ? 'var(--bg-2)' : 'transparent', 
                       border: '1px solid',
                       borderColor: isSelected ? 'var(--b3)' : 'var(--b2)',
                       transition: 'all 0.2s ease',
                       boxShadow: isSelected ? 'var(--sh1)' : 'none'
                     }}>
                       <input 
                         type="checkbox" 
                         checked={isSelected}
                         onChange={(e) => {
                           const current = selectedTables[activeConnector.id] || [];
                           const next = e.target.checked ? [...current, table] : current.filter(t => t !== table);
                           setSelectedTables(prev => ({ ...prev, [activeConnector.id]: next }));
                         }}
                         style={{ accentColor: 'var(--gold)', width: 16, height: 16 }}
                       />
                       <span style={{ 
                         fontSize: '0.875rem', 
                         textTransform: 'capitalize',
                         fontWeight: isSelected ? 500 : 400,
                         color: isSelected ? 'var(--t1)' : 'var(--t2)'
                       }}>{table.replace(/_/g, ' ')}</span>
                     </label>
                   )
                 })}
               </div>
            ) : (
               <p style={{ color: 'var(--t3)', margin: 0, fontSize: '0.875rem' }}>No public tables found or invalid service key.</p>
            )}
            
            {(schemas[activeConnector.id] || []).length > 0 && (
              <button 
                onClick={handleSync} 
                disabled={syncing} 
                className="btn btn-outline" 
                style={{ marginTop: 24, gap: 8, borderRadius: '100px' }}
              >
                {syncing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}
                {syncing ? 'Syncing Tables...' : 'Sync Selected Tables'}
              </button>
            )}
          </div>
        )}

        {/* Content Area */}
        {results.length > 0 && results[activeTabIndex] ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {(() => {
               const res = results[activeTabIndex];
               const label = res.display_name || res.connector_id.replace(/_/g, ' ');
               return (
                 <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--r16)', border: '1px solid var(--b2)', overflow: 'hidden' }}>
                   <div style={{ padding: '20px 24px 12px 24px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-3)' }}>
                     <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <TableIcon size={16} color="var(--t2)" />
                     </div>
                     <div>
                       <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--t1)', margin: 0, textTransform: 'capitalize' }}>
                         {label}
                       </h3>
                       <p style={{ fontSize: '0.75rem', color: 'var(--t3)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                         {res.category} Data Stream
                       </p>
                     </div>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
                     {res.streams && res.streams.length > 0 ? (
                       <>
                         <div style={{ padding: '16px 24px', background: 'var(--bg-2)', borderBottom: '1px solid var(--b2)' }}>
                           <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, marginTop: 0 }}>
                             Data Streams
                           </h4>
                           <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                             {res.streams.map((stream, idx) => {
                               const activeStreamIdx = activeStreamIndices[res.connector_id] || 0;
                               const isActive = activeStreamIdx === idx;
                               return (
                                 <button
                                   key={idx}
                                   onClick={() => setActiveStreamIndices(prev => ({ ...prev, [res.connector_id]: idx }))}
                                   style={{
                                     padding: '6px 16px', 
                                     background: isActive ? 'color-mix(in srgb, var(--gold) 10%, transparent)' : 'var(--bg-2)',
                                     color: isActive ? 'var(--gold)' : 'var(--t1)',
                                     border: isActive ? '1px solid var(--gold)' : '1px solid var(--b2)',
                                     borderRadius: '20px', cursor: 'pointer',
                                     fontWeight: isActive ? 600 : 500, fontSize: '0.8125rem',
                                     transition: 'all 0.2s ease',
                                     boxShadow: isActive ? '0 0 0 1px var(--gold)' : 'none'
                                   }}
                                 >
                                   {stream.name.replace('Table: ', '')}
                                 </button>
                               )
                             })}
                           </div>
                         </div>
                         <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-1)' }}>
                           {(() => {
                             const activeStreamIdx = activeStreamIndices[res.connector_id] || 0;
                             const activeStream = res.streams[activeStreamIdx] || res.streams[0];
                             return <DataGrid streamName={activeStream.name} data={activeStream.data} />;
                           })()}
                         </div>
                       </>
                     ) : (
                       <div style={{ padding: 32, textAlign: 'center' }}>
                         <p style={{ color: 'var(--t3)', fontSize: '0.875rem', margin: 0 }}>No data streams found.</p>
                       </div>
                     )}
                   </div>
                 </div>
               );
            })()}
          </div>
        ) : !syncing && (
          <div style={{ 
            padding: '80px 40px', textAlign: 'center', 
            border: '1px dashed var(--b3)', borderRadius: 'var(--r12)',
            background: 'var(--bg-2)'
          }}>
            <Database style={{ opacity: 0.2, width: 48, height: 48, margin: '0 auto 16px', display: 'block', color: 'var(--t1)' }} />
            <h3 style={{ fontSize: '1.25rem', color: 'var(--t1)', marginBottom: '8px', fontWeight: 600 }}>No data synced yet</h3>
            <p style={{ fontSize: '0.9375rem', color: 'var(--t3)', maxWidth: 400, margin: '0 auto' }}>
              Click "Sync All Data" to simulate pulling live streams from your connected integrations.
            </p>
          </div>
        )}

      </div>
    </AppShell>
  );
}
