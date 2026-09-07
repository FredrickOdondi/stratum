import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, ChevronRight, ChevronDown,
  Eye, EyeOff, CheckCircle, ArrowRight, Sparkles, GripVertical
} from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { supabase } from '../../lib/supabase';
import { refineIssueTree } from '../../lib/openai';
import { saveStageOutput } from '../../lib/engagementStages';
import type { Engagement, IssueNode } from '../../types';

function buildTree(nodes: IssueNode[]): IssueNode[] {
  const map = new Map<string, IssueNode>();
  nodes.forEach(n => map.set(n.id, { ...n, children: [] }));
  const roots: IssueNode[] = [];
  map.forEach(n => {
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children!.push(n);
    } else {
      roots.push(n);
    }
  });
  return roots.sort((a, b) => a.sort_order - b.sort_order);
}

function TreeNode({
  node,
  depth = 0,
  onToggleScope,
  onDelete,
  onAddChild,
  onLabelChange,
}: {
  node: IssueNode;
  depth?: number;
  onToggleScope: (id: string) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onLabelChange: (id: string, label: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div className="tree-node">
      <div className={`tree-node-row ${!node.in_scope ? 'out-of-scope' : ''}`}>
        <GripVertical size={14} style={{ color: 'var(--warm-grey2)', flexShrink: 0, cursor: 'grab' }} />

        {/* Expand toggle */}
        <button
          className="tree-toggle"
          onClick={() => setExpanded(!expanded)}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Scope toggle */}
        <button
          className={`tree-scope-toggle ${node.in_scope ? 'in-scope' : ''}`}
          onClick={() => onToggleScope(node.id)}
          title={node.in_scope ? 'Remove from scope' : 'Add to scope'}
        />

        {/* Label */}
        {editing ? (
          <input
            className="form-input"
            style={{ padding: '4px 8px', fontSize: '0.875rem', flex: 1 }}
            value={node.label}
            onChange={e => onLabelChange(node.id, e.target.value)}
            onBlur={() => setEditing(false)}
            autoFocus
          />
        ) : (
          <span
            style={{ fontSize: '0.9rem', flex: 1, fontWeight: depth === 0 ? 500 : 400, cursor: 'text' }}
            onDoubleClick={() => setEditing(true)}
          >
            {node.label}
          </span>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.15s' }} className="node-actions">
          <button className="btn btn-ghost btn-icon" style={{ padding: 4 }} onClick={() => onAddChild(node.id)} title="Add sub-branch">
            <Plus size={13} />
          </button>
          <button className="btn btn-ghost btn-icon" style={{ padding: 4 }} onClick={() => onDelete(node.id)} title="Delete branch">
            <Trash2 size={13} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            style={{ padding: 4 }}
            onClick={() => onToggleScope(node.id)}
            title={node.in_scope ? 'Remove from scope' : 'Add to scope'}
          >
            {node.in_scope ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="tree-children">
          {node.children!.sort((a, b) => a.sort_order - b.sort_order).map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onToggleScope={onToggleScope}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onLabelChange={onLabelChange}
            />
          ))}
        </div>
      )}
      <style>{`.tree-node-row:hover .node-actions { opacity: 1 !important; }`}</style>
    </div>
  );
}

export function IssueTreePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [nodes, setNodes] = useState<IssueNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [refining, setRefining] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    if (!id) return;
    const [{ data: eng }, { data: nodeData }] = await Promise.all([
      supabase.from('engagements').select('*').eq('id', id).single(),
      supabase.from('issue_nodes').select('*').eq('engagement_id', id).order('sort_order'),
    ]);
    if (eng) setEngagement(eng as Engagement);
    if (nodeData) setNodes(nodeData as IssueNode[]);
    setLoading(false);
  }

  async function handleToggleScope(nodeId: string) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const updated = { in_scope: !node.in_scope };
    await supabase.from('issue_nodes').update(updated).eq('id', nodeId);
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updated } : n));
  }

  async function handleDelete(nodeId: string) {
    await supabase.from('issue_nodes').delete().eq('id', nodeId);
    setNodes(prev => prev.filter(n => n.id !== nodeId && n.parent_id !== nodeId));
  }

  async function handleAddChild(parentId: string) {
    const { data } = await supabase.from('issue_nodes').insert({
      engagement_id: id,
      parent_id: parentId,
      label: 'New branch',
      description: '',
      in_scope: true,
      sort_order: 99,
    }).select().single();
    if (data) setNodes(prev => [...prev, data as IssueNode]);
  }

  async function handleAddRoot() {
    const { data } = await supabase.from('issue_nodes').insert({
      engagement_id: id,
      parent_id: null,
      label: 'New top-level branch',
      description: '',
      in_scope: true,
      sort_order: nodes.filter(n => !n.parent_id).length,
    }).select().single();
    if (data) setNodes(prev => [...prev, data as IssueNode]);
  }

  async function handleLabelChange(nodeId: string, label: string) {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, label } : n));
    await supabase.from('issue_nodes').update({ label }).eq('id', nodeId);
  }

  async function handleRefineAI() {
    if (!id || !engagement?.problem_statement) return;
    setRefining(true);
    try {
      const refined = await refineIssueTree(engagement.problem_statement, nodes);
      if (refined && refined.length > 0) {
        // Save to engagement_stages
        await saveStageOutput(id, 'issue_tree', {
          refined_nodes: refined,
          refined_count: refined.length,
          last_refined_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Refine failed', err);
    }
    setRefining(false);
  }

  async function handleApprove() {
    if (!id) return;
    setApproving(true);
    await supabase
      .from('engagements')
      .update({ stage: 'research', updated_at: new Date().toISOString() })
      .eq('id', id);

    // Save issue tree snapshot to engagement_stages
    const rootNodes = nodes.filter(n => !n.parent_id);
    await saveStageOutput(id, 'issue_tree', {
      branches_count: nodes.length,
      in_scope_count: inScopeCount,
      root_branches: rootNodes.map(n => n.label),
      nodes: nodes.map(n => ({ id: n.id, label: n.label, parent_id: n.parent_id, in_scope: n.in_scope })),
      approved_at: new Date().toISOString(),
    }, 'completed');

    navigate(`/engagement/${id}/research`);
  }

  const tree = buildTree(nodes);
  const inScopeCount = nodes.filter(n => n.in_scope).length;

  return (
    <AppShell
      engagementId={id}
      currentStage="issue_tree"
      completedStages={['scoping']}
    >
      <div className="page">
        <div className="page-header flex items-center justify-between">
          <div>
            <div className="badge badge-gold" style={{ marginBottom: 12 }}>Stage 2 — Issue Tree</div>
            <h1 className="page-title">MECE Issue Tree</h1>
            <p>
              {engagement?.client_name} · {inScopeCount} branches in scope.
              Double-click any label to rename. Uncheck a branch to exclude it from research.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={handleRefineAI} disabled={refining}>
              {refining ? <span className="spinner spinner-sm" /> : <Sparkles size={15} />}
              Refine with AI
            </button>
            <button className="btn btn-outline" onClick={handleAddRoot}>
              <Plus size={15} />
              Add Branch
            </button>
            <button className="btn btn-gold" onClick={handleApprove} disabled={approving || inScopeCount === 0}>
              {approving ? <span className="spinner spinner-sm spinner-gold" /> : <CheckCircle size={16} />}
              Approve & Start Research
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: 'var(--radius-sm)' }} />
            ))}
          </div>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 className="card-title">{engagement?.business_question}</h3>
                <p style={{ fontSize: '0.8125rem', margin: '4px 0 0' }}>
                  Root question — all branches should be mutually exclusive and collectively exhaustive
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="badge badge-success">{inScopeCount} in scope</span>
                <span className="badge badge-muted">{nodes.length - inScopeCount} excluded</span>
              </div>
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {tree.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  onToggleScope={handleToggleScope}
                  onDelete={handleDelete}
                  onAddChild={handleAddChild}
                  onLabelChange={handleLabelChange}
                />
              ))}
            </div>

            {tree.length === 0 && (
              <div className="empty-state" style={{ padding: '40px 24px' }}>
                <Sparkles className="empty-icon" />
                <h3>No branches yet</h3>
                <p>Add branches or go back to the scoping stage to regenerate the issue tree.</p>
              </div>
            )}

            <div className="divider" style={{ marginTop: 20 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-gold" onClick={handleApprove} disabled={approving || inScopeCount === 0}>
                {approving ? <span className="spinner spinner-sm spinner-gold" /> : <CheckCircle size={16} />}
                Approve & Start Research
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
