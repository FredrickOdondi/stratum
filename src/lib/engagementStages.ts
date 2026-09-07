import { supabase } from './supabase';
import type { EngagementStage } from '../types';

export async function saveStageOutput(
  engagementId: string,
  stage: EngagementStage,
  data: Record<string, unknown>,
  status?: 'pending' | 'in_progress' | 'completed' | 'skipped'
) {
  if (!engagementId) return;

  try {
    const payload: Record<string, unknown> = {
      metadata: data,
      updated_at: new Date().toISOString(),
    };

    if (status) {
      payload.status = status;
      if (status === 'completed') {
        payload.completed_at = new Date().toISOString();
      } else if (status === 'in_progress') {
        payload.started_at = new Date().toISOString();
      }
    }

    const { data: updated, error } = await supabase
      .from('engagement_stages')
      .update(payload)
      .eq('engagement_id', engagementId)
      .eq('stage', stage)
      .select();

    // Fallback: If row doesn't exist yet (e.g. legacy engagement before trigger), upsert it
    if (!error && (!updated || updated.length === 0)) {
      await supabase
        .from('engagement_stages')
        .upsert(
          {
            engagement_id: engagementId,
            stage,
            status: status ?? 'in_progress',
            metadata: data,
            started_at: new Date().toISOString(),
            completed_at: status === 'completed' ? new Date().toISOString() : null,
          },
          { onConflict: 'engagement_id,stage' }
        );
    }
  } catch (err) {
    console.error(`Failed to save stage output for ${stage}:`, err);
  }
}
