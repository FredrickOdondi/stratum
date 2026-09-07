// Supabase types — mirrors DB schema
export type UserRole = 'client' | 'reviewer' | 'admin';

export type EngagementStage =
  | 'scoping'
  | 'issue_tree'
  | 'research'
  | 'analysis'
  | 'synthesis'
  | 'quality_check'
  | 'deliverable'
  | 'in_review'
  | 'delivered'
  | 'chat';

export type Confidence = 'verified' | 'estimate' | 'assumption';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface UserSubscription {
  user_id: string;
  tier: 'free' | 'pro';
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  granted_at: string;
}

export interface Engagement {
  id: string;
  owner_id: string;
  client_name: string;
  industry: string;
  business_question: string;
  stage: EngagementStage;
  problem_statement: string | null;
  created_at: string;
  updated_at: string;
}

export interface EngagementStageRecord {
  id: string;
  engagement_id: string;
  stage: EngagementStage;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  started_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IntakeAnswer {
  id: string;
  engagement_id: string;
  field: string;
  value: string;
}

export interface Document {
  id: string;
  engagement_id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  size: number;
  parsed_chunks: unknown | null;
  embedded: boolean;
}

export interface IssueNode {
  id: string;
  engagement_id: string;
  parent_id: string | null;
  label: string;
  description: string;
  in_scope: boolean;
  sort_order: number;
  created_at: string;
  children?: IssueNode[];
}

export interface Finding {
  id: string;
  engagement_id: string;
  issue_node_id: string;
  content: string;
  source_url: string | null;
  source_title: string | null;
  confidence: Confidence;
  retrieved_at: string;
}

export interface Claim {
  id: string;
  engagement_id: string;
  issue_node_id: string;
  statement: string;
  framework_used: string | null;
  created_at: string;
  findings?: Finding[];
  chart_config?: {
    type: 'bar' | 'line' | 'pie';
    data: Array<{ label: string; value: number }>;
  } | null;
}

export interface DeliverableSection {
  id: string;
  title: string;
  content: string;
  claim_ids: string[];
  slide_bullets?: string[];
  chart?: {
    type: 'bar' | 'line' | 'pie';
    data: Array<{ label: string; value: number }>;
  };
}

export interface DeliverableDocument {
  governing_thought: string;
  executive_summary: string;
  sections: DeliverableSection[];
  recommendations: Array<{ id: string; title: string; rationale: string; priority: 'high' | 'medium' | 'low' }>;
  roadmap: Array<{ phase: string; timeline: string; actions: string[] }>;
  appendix: Array<{ source_url: string; title: string; retrieved_at: string; used_in: string[] }>;
}

export interface Deliverable {
  id: string;
  engagement_id: string;
  version: number;
  document: DeliverableDocument;
  created_at: string;
  is_current: boolean;
}

export interface QualityFlag {
  id: string;
  claim_id: string;
  section_ref: string;
  issue: string;
  severity: 'critical' | 'warning' | 'suggestion';
  resolved: boolean;
}

export interface ReviewRequest {
  id: string;
  engagement_id: string;
  deliverable_id: string;
  status: 'pending' | 'in_review' | 'changes_requested' | 'signed_off';
  reviewer_id: string | null;
  submitted_at: string;
  resolved_at: string | null;
}

export interface ReviewComment {
  id: string;
  review_request_id: string;
  reviewer_id: string;
  section_ref: string;
  body: string;
  resolved: boolean;
  created_at: string;
}

export interface StageRun {
  id: string;
  engagement_id: string;
  stage: EngagementStage;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'done' | 'error';
  token_count: number | null;
  model: string | null;
}

// Stage metadata for UI
export const STAGE_META: Record<EngagementStage, { label: string; step: number; description: string }> = {
  scoping: { label: 'Intake', step: 1, description: 'Define the engagement scope and business question' },
  issue_tree: { label: 'Issue Tree', step: 2, description: 'Build the MECE issue tree' },
  research: { label: 'Research', step: 3, description: 'Gather data, benchmarks, and competitor intel' },
  analysis: { label: 'Analysis', step: 4, description: 'Apply structured frameworks to findings' },
  synthesis: { label: 'Synthesis', step: 5, description: 'Build the pyramid-principle storyline' },
  quality_check: { label: 'Quality Check', step: 6, description: 'Red-team pass for gaps and contradictions' },
  deliverable: { label: 'Deliverable', step: 7, description: 'Review and export the final report' },
  in_review: { label: 'In Review', step: 8, description: 'Expert reviewer sign-off' },
  delivered: { label: 'Delivered', step: 8, description: 'Engagement complete' },
};

export const STAGE_ORDER: EngagementStage[] = [
  'scoping',
  'issue_tree',
  'research',
  'analysis',
  'synthesis',
  'quality_check',
  'deliverable',
  'in_review',
];
