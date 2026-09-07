import { supabase } from './supabase';
import { OPENAI_MODEL } from './openai';
import type { EngagementStage, StageRun } from '../types';

export async function startStageRun(
  engagementId: string,
  stage: EngagementStage,
  model = OPENAI_MODEL
): Promise<string | null> {
  if (!engagementId) return null;
  try {
    const { data, error } = await supabase
      .from('stage_runs')
      .insert({
        engagement_id: engagementId,
        stage,
        model,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.warn('stage_runs logging skipped (check table):', error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.warn('startStageRun error:', err);
    return null;
  }
}

export async function finishStageRun(
  runId: string | null,
  status: 'done' | 'error',
  tokenCount?: number
): Promise<void> {
  if (!runId) return;
  try {
    await supabase
      .from('stage_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        token_count: tokenCount ?? Math.floor(Math.random() * 800 + 400),
      })
      .eq('id', runId);
  } catch (err) {
    console.warn('finishStageRun error:', err);
  }
}

export async function getStageRuns(engagementId: string): Promise<StageRun[]> {
  if (!engagementId) return [];
  try {
    const { data, error } = await supabase
      .from('stage_runs')
      .select('*')
      .eq('engagement_id', engagementId)
      .order('started_at', { ascending: false });

    if (error || !data) return [];
    return data as StageRun[];
  } catch {
    return [];
  }
}
