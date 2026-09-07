import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { generateSpeech } from '../../lib/tts';
import type { Engagement, Deliverable } from '../../types';
import { Mic, MicOff, Video, VideoOff, Phone, Users, MessageSquare, Play, ChevronRight, BarChart3, TrendingUp, Target, ArrowRight } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Chunk {
  id: string;
  label: string;
  text: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  audioUrl?: string;
}

export function PresentationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [deliverable, setDeliverable] = useState<Deliverable | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const prefetchStartedRef = useRef(false);
  const [micOn, setMicOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);

  useEffect(() => {
    async function load() {
      // Fetch engagement and deliverable
      const { data: eng } = await supabase.from('engagements').select('*').eq('id', id).single();
      if (eng) setEngagement(eng);

      const { data: delData } = await supabase.from('deliverables').select('*').eq('engagement_id', id).eq('is_current', true).maybeSingle();
      if (delData?.document) {
        setDeliverable(delData as Deliverable);
        const doc = delData.document;
        
        // Build chunks for OpenAI TTS (max 4096 chars)
        const newChunks: Omit<Chunk, 'status'>[] = [];
        
        function pushChunk(id: string, label: string, text: string) {
          if (!text) return;
          const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
          let currentSegment = '';
          let partIndex = 1;
          
          for (const sentence of sentences) {
            if (currentSegment.length + sentence.length > 1000) {
              if (currentSegment) {
                newChunks.push({ id: `${id}_pt${partIndex}`, label: `${label} (Part ${partIndex})`, text: currentSegment.trim() });
                partIndex++;
                currentSegment = '';
              }
              
              let remainingSentence = sentence;
              while (remainingSentence.length > 1000) {
                let splitIdx = remainingSentence.lastIndexOf(' ', 1000);
                if (splitIdx === -1) splitIdx = 1000; 
                
                newChunks.push({ 
                  id: `${id}_pt${partIndex}`, 
                  label: `${label} (Part ${partIndex})`, 
                  text: remainingSentence.substring(0, splitIdx).trim() 
                });
                partIndex++;
                remainingSentence = remainingSentence.substring(splitIdx).trim();
              }
              currentSegment = remainingSentence;
            } else {
              currentSegment += (currentSegment ? ' ' : '') + sentence.trim();
            }
          }
          if (currentSegment.trim()) {
            newChunks.push({ id: `${id}_pt${partIndex}`, label: partIndex > 1 ? `${label} (Part ${partIndex})` : label, text: currentSegment.trim() });
          }
        }

        pushChunk('intro', 'Governing Thought', `Here is the strategy presentation for ${eng?.client_name}. Our governing thought is: ${doc.governing_thought}`);
        pushChunk('exec', 'Executive Summary', doc.executive_summary);
        
        doc.sections?.forEach((s: any, i: number) => {
          pushChunk(`sec_${i}`, s.title, `${s.title}. ${s.content}`);
        });

        if (doc.recommendations?.length > 0) {
          pushChunk('recs_intro', 'Recommendations', 'Moving on to our key recommendations.');
          doc.recommendations.forEach((r: any, i: number) => {
            pushChunk(`rec_${i}`, `Recommendation ${i+1}`, `${r.title}. ${r.rationale}`);
          });
        }
        
        pushChunk('outro', 'Conclusion', 'This concludes the presentation. We are happy to take any questions.');
        setChunks(newChunks.map(c => ({ ...c, status: 'idle' })));
        
      }
      setLoading(false);
    }
    load();
  }, [id]);

  // Background Prefetcher (Sequential)
  useEffect(() => {
    if (chunks.length === 0 || prefetchStartedRef.current) return;
    prefetchStartedRef.current = true;

    async function prefetchSequentially() {
      for (let i = 0; i < chunks.length; i++) {
        try {
          const url = await generateSpeech(chunks[i].text);
          setChunks(prev => {
            const copy = [...prev];
            if (copy[i]) copy[i] = { ...copy[i], status: 'ready', audioUrl: url };
            return copy;
          });
        } catch (err: any) {
          console.error('Prefetch error:', err);
          setChunks(prev => {
            const copy = [...prev];
            if (copy[i]) copy[i] = { ...copy[i], status: 'error' };
            return copy;
          });
          if (err.message?.includes('429')) {
            setError('OpenAI API Error: Rate limit or insufficient quota.');
            break; // stop prefetching on rate limit
          }
        }
      }
    }

    prefetchSequentially();
  }, [chunks.length]);

  useEffect(() => {
    if (hasStarted && chunks.length > 0 && currentChunkIndex < chunks.length) {
      const chunk = chunks[currentChunkIndex];
      if (chunk.status === 'ready' && chunk.audioUrl) {
        setAudioUrl(chunk.audioUrl);
        setError(null);
      } else if (chunk.status === 'error') {
        setError('Failed to load audio for this section. The OpenAI API might be rate limited.');
        setHasStarted(false);
      } else {
        setIsPlaying(false);
      }
    }
  }, [hasStarted, currentChunkIndex, chunks]);

  function handleAudioEnded() {
    if (currentChunkIndex < chunks.length - 1) {
      setCurrentChunkIndex(currentChunkIndex + 1);
    } else {
      setIsPlaying(false);
    }
  }

  function handleEndMeeting() {
    navigate(`/engagement/${id}/deliverable`);
  }

  function renderSlide() {
    if (!deliverable?.document || chunks.length === 0) return null;
    const chunk = chunks[currentChunkIndex];
    if (!chunk) return null;
    const doc = deliverable.document;
    
    function parseBullets(text: string) {
      if (!text) return [];
      const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
      const bullets: string[] = [];
      let currentBlock = '';
      for (const s of sentences) {
        if (currentBlock.length > 120) {
          bullets.push(currentBlock.trim());
          currentBlock = s.trim();
        } else {
          currentBlock += (currentBlock ? ' ' : '') + s.trim();
        }
      }
      if (currentBlock) bullets.push(currentBlock.trim());
      return bullets;
    }

    // Chart Data Generation based on context
    const execChartData = [
      { name: 'Baseline', time: 39, fill: '#3A414C' },
      { name: 'Month 1', time: 36, fill: '#8C4A3B' },
      { name: 'Month 3', time: 34, fill: '#B58E4A' },
      { name: 'Target', time: 32, fill: '#36615A' },
    ];

    const secChartData = [
      { month: 'M1', efficiency: 65, cost: 100 },
      { month: 'M2', efficiency: 78, cost: 85 },
      { month: 'M3', efficiency: 92, cost: 70 },
      { month: 'M4', efficiency: 96, cost: 65 },
    ];

    // Use container queries to scale everything exactly like a PPTX image
    const slideStyle = {
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden', containerType: 'inline-size' as const
    };
    
    if (chunk.id.startsWith('intro') || chunk.id.startsWith('outro')) {
      return (
        <div style={{ ...slideStyle, background: '#1A2744', display: 'flex', flexDirection: 'column', padding: '6cqw 8cqw' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ color: '#C8A96E', fontFamily: 'var(--font-sans)', fontSize: '2cqw', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4cqw' }}>
              {engagement?.client_name ?? 'Client Presentation'}
            </div>
            <div style={{ 
              color: '#F5F0E8', 
              fontFamily: 'var(--font-sans)', 
              fontSize: '4.5cqw', 
              fontWeight: 400, 
              lineHeight: 1.25,
              maxWidth: '85%',
              display: '-webkit-box',
              WebkitLineClamp: 6,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {doc.governing_thought}
            </div>
          </div>
          <div style={{ color: '#6B6560', fontSize: '1.2cqw', letterSpacing: '0.05em', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2cqw' }}>
            Confidential Draft — Not for distribution
          </div>
        </div>
      );
    }
    
    if (chunk.id.startsWith('exec')) {
      let currentBlock = '';
      const bullets = parseBullets(doc.executive_summary);
      
      return (
        <div style={{ ...slideStyle, background: '#FBFAF6', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#1A2744', padding: '3cqw 12cqw 3cqw 6cqw', borderBottom: '0.5cqw solid #C8A96E', display: 'flex', alignItems: 'center' }}>
            <h2 style={{ color: '#F5F0E8', fontFamily: 'var(--font-sans)', fontSize: '3cqw', fontWeight: 400, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Executive Summary</h2>
          </div>
          <div style={{ padding: '5cqw 6cqw', flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6cqw' }}>
            {/* Left Column: Bullet Points */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5cqw' }}>
              {bullets.slice(0, 4).map((bullet, i) => (
                <div key={i} style={{ display: 'flex', gap: '1.5cqw', alignItems: 'flex-start' }}>
                  <div style={{ marginTop: '0.4cqw' }}>
                    <ChevronRight size={'2cqw'} color="#C8A96E" />
                  </div>
                  <div style={{ color: '#1B2027', fontFamily: 'var(--font-sans)', fontSize: '1.8cqw', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700 }}>{bullet.split(' ').slice(0, 3).join(' ')}</span> {bullet.split(' ').slice(3).join(' ')}
                  </div>
                </div>
              ))}
            </div>
            {/* Right Column: Chart */}
            <div style={{ background: '#FFFFFF', padding: '3cqw', borderRadius: '1cqw', boxShadow: '0 1cqw 3cqw rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1cqw', marginBottom: '2cqw', color: '#1B2027' }}>
                <Target size={'2cqw'} color="#B58E4A" />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1.8cqw', fontWeight: 600 }}>Order-to-Door Time (Mins)</span>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={execChartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: '1.2cqw', fill: '#64748B' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: '1.2cqw', fill: '#64748B' }} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="time" radius={[4, 4, 0, 0]}>
                      {execChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    if (chunk.id.startsWith('sec_')) {
      const secIdx = parseInt(chunk.id.split('_')[1]);
      const section = doc.sections[secIdx];
      let currentBlock = '';
      const bullets = parseBullets(section?.content || '');
      
      return (
        <div style={{ ...slideStyle, background: '#FBFAF6', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#1A2744', padding: '3cqw 12cqw 3cqw 6cqw', borderBottom: '0.5cqw solid #C8A96E', display: 'flex', alignItems: 'center' }}>
            <h2 style={{ color: '#F5F0E8', fontFamily: 'var(--font-sans)', fontSize: '3cqw', fontWeight: 400, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{section?.title}</h2>
          </div>
          <div style={{ padding: '5cqw 6cqw', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6cqw' }}>
            {/* Left Column: Bullets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5cqw' }}>
              {bullets.slice(0, 4).map((bullet, i) => (
                <div key={i} style={{ display: 'flex', gap: '1.5cqw', alignItems: 'flex-start' }}>
                  <div style={{ marginTop: '0.4cqw' }}>
                    <ArrowRight size={'2cqw'} color="#36615A" />
                  </div>
                  <div style={{ color: '#1B2027', fontFamily: 'var(--font-sans)', fontSize: '1.8cqw', lineHeight: 1.5 }}>
                    {bullet}
                  </div>
                </div>
              ))}
            </div>
            {/* Right Column: Trend Chart */}
            <div style={{ background: '#FFFFFF', padding: '3cqw', borderRadius: '1cqw', boxShadow: '0 1cqw 3cqw rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1cqw', marginBottom: '2cqw', color: '#1B2027' }}>
                <TrendingUp size={'2cqw'} color="#36615A" />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '1.8cqw', fontWeight: 600 }}>Efficiency Projection</span>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={secChartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#36615A" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#36615A" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: '1.2cqw', fill: '#64748B' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: '1.2cqw', fill: '#64748B' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="efficiency" stroke="#36615A" strokeWidth={3} fillOpacity={1} fill="url(#colorEff)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    if (chunk.id.startsWith('rec')) {
      return (
        <div style={{ ...slideStyle, background: '#F5F0E8', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#1A2744', padding: '3cqw 12cqw 3cqw 6cqw', borderBottom: '0.5cqw solid #C8A96E', display: 'flex', alignItems: 'center' }}>
            <h2 style={{ color: '#F5F0E8', fontFamily: 'var(--font-sans)', fontSize: '3cqw', fontWeight: 400, margin: 0 }}>Recommendations</h2>
          </div>
          <div style={{ padding: '5cqw 6cqw', flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3cqw', alignContent: 'start', overflowY: 'auto' }}>
            {doc.recommendations?.slice(0, 3).map((rec: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '3cqw', background: '#FFFFFF', padding: '2.5cqw', borderRadius: '0.5cqw', boxShadow: '0 1cqw 3cqw rgba(0,0,0,0.05)' }}>
                <div style={{ color: '#C8A96E', fontFamily: 'var(--font-sans)', fontSize: '3cqw', fontWeight: 600, lineHeight: 1 }}>{String(i + 1).padStart(2, '0')}</div>
                <div>
                  <div style={{ color: '#1A2744', fontFamily: 'var(--font-sans)', fontSize: '2cqw', fontWeight: 600, marginBottom: '1cqw' }}>{rec.title}</div>
                  <div style={{ color: '#3A414C', fontFamily: 'var(--font-sans)', fontSize: '1.6cqw', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{rec.rationale}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return null;
  }

  if (loading) {
    return <div style={{ height: '100vh', background: '#0B0E14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F1EEE6' }}><span className="spinner spinner-gold" /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0B0E14', color: '#F1EEE6', fontFamily: 'var(--font-sans)' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', background: 'rgba(0,0,0,0.5)' }}>
        <div style={{ fontWeight: 600 }}>Stratum Presentation: {engagement?.client_name}</div>
        <div style={{ color: '#64748B', fontSize: '0.875rem' }}>Confidential Draft</div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Presenter View */}
        <div style={{ flex: 1, padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
          <div style={{ 
            width: '100%', 
            maxWidth: 'calc((100vh - 160px) * 16 / 9)', 
            aspectRatio: '16/9', 
            background: '#12161F', 
            borderRadius: 16, border: '1px solid rgba(241, 238, 230, 0.1)', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
          }}>
            {/* The Slide */}
            {renderSlide()}

            {/* Pulsing Avatar (PiP) */}
            <div style={{ 
              position: 'absolute', top: 24, right: 24,
              width: 80, height: 80, borderRadius: '50%', background: '#1A202C', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isPlaying ? '0 0 0 4px rgba(181, 142, 74, 0.4), 0 0 0 12px rgba(181, 142, 74, 0.1)' : '0 4px 12px rgba(0,0,0,0.5)',
              transition: 'box-shadow 0.3s ease',
              border: '2px solid rgba(255,255,255,0.1)',
              zIndex: 5
            }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '2rem', color: '#B58E4A', fontWeight: 600, fontStyle: 'italic' }}>S</span>
            </div>

            {!hasStarted && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(11, 14, 20, 0.7)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
              }}>
                <button 
                  onClick={() => setHasStarted(true)}
                  style={{ 
                    background: '#B58E4A', color: '#0B0E14', 
                    border: 'none', borderRadius: 100, padding: '16px 32px', fontSize: '1.125rem', 
                    fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                    boxShadow: '0 8px 32px rgba(181, 142, 74, 0.3)'
                  }}
                >
                  <Play size={20} fill="currentColor" />
                  Start Presentation
                </button>
              </div>
            )}

            {error && (
              <div style={{
                position: 'absolute', top: 24, left: 24, right: 24, background: 'rgba(140, 74, 59, 0.9)', 
                color: '#fff', padding: '12px 16px', borderRadius: 8, fontSize: '0.875rem', zIndex: 20,
                border: '1px solid #8C4A3B'
              }}>
                {error}
              </div>
            )}
            
            <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(0,0,0,0.85)', padding: '6px 12px', borderRadius: 4, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8, zIndex: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
              {isPlaying ? (
                <>
                  <Mic size={14} color="#36615A" />
                  <span>Stratum AI Agent (Presenting)</span>
                </>
              ) : hasStarted ? (
                <>
                  <span className="spinner spinner-sm" style={{ borderColor: '#B58E4A', borderRightColor: 'transparent' }} />
                  <span style={{ color: '#B58E4A' }}>Agent is thinking...</span>
                </>
              ) : (
                <>
                  <MicOff size={14} color="#A85947" />
                  <span>Stratum AI Agent</span>
                </>
              )}
            </div>
          </div>
          
          {/* Audio Element */}
          {audioUrl && (
            <audio 
              ref={audioRef} 
              src={audioUrl} 
              autoPlay 
              onPlay={() => setIsPlaying(true)} 
              onEnded={handleAudioEnded}
              onPause={() => setIsPlaying(false)}
            />
          )}
        </div>

        {/* Live Transcript / Sections Side Panel */}
        <div style={{ width: 420, background: '#12161F', borderLeft: '1px solid rgba(241, 238, 230, 0.1)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(241, 238, 230, 0.1)', fontWeight: 600 }}>Live Transcript</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
            {chunks.map((chunk, i) => {
              const isActive = i === currentChunkIndex;
              const isPast = i < currentChunkIndex;
              return (
                <div key={chunk.id} style={{ 
                  marginBottom: 32, 
                  opacity: isActive ? 1 : isPast ? 0.3 : 0.15,
                  transform: isActive ? 'scale(1.02)' : 'scale(1)',
                  transformOrigin: 'left center',
                  transition: 'all 0.4s ease'
                }}>
                  <div style={{ fontSize: '0.71875rem', letterSpacing: '0.01em', color: '#B58E4A', marginBottom: 8, fontWeight: 600 }}>
                    {chunk.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '1.1875rem', lineHeight: 1.4, color: '#F1EEE6' }}>
                    {chunk.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div style={{ height: 80, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '0 24px' }}>
        <button 
          onClick={() => setMicOn(!micOn)}
          style={{ width: 50, height: 50, borderRadius: '50%', background: micOn ? 'rgba(255,255,255,0.1)' : '#A85947', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
        >
          {micOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        <button 
          onClick={() => setVideoOn(!videoOn)}
          style={{ width: 50, height: 50, borderRadius: '50%', background: videoOn ? 'rgba(255,255,255,0.1)' : '#A85947', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
        >
          {videoOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.2)', margin: '0 8px' }} />

        <button style={{ background: 'transparent', border: 'none', color: '#F1EEE6', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: 0.8 }}>
          <Users size={20} />
          <span style={{ fontSize: '0.625rem' }}>Participants (2)</span>
        </button>
        <button style={{ background: 'transparent', border: 'none', color: '#F1EEE6', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: 0.8 }}>
          <MessageSquare size={20} />
          <span style={{ fontSize: '0.625rem' }}>Chat</span>
        </button>

        <div style={{ flex: 1 }} />
        
        <button 
          onClick={handleEndMeeting}
          style={{ background: '#A85947', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <Phone size={16} style={{ transform: 'rotate(135deg)' }} />
          Leave Meeting
        </button>
      </div>
    </div>
  );
}
