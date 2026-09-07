import { supabase } from './supabase';

export interface ConnectorCredential {
  id: string;
  user_id: string;
  connector_id: string;
  display_name: string | null;
  credentials: Record<string, string>;
  status: 'connected' | 'error';
  connected_at: string;
}

export async function saveConnector(
  connectorId: string,
  credentials: Record<string, string>,
  displayName?: string
): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase.from('connector_credentials').upsert({
    user_id: user.id,
    connector_id: connectorId,
    display_name: displayName ?? null,
    credentials,
    status: 'connected',
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id,connector_id' });

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteConnector(connectorId: string): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('connector_credentials')
    .delete()
    .eq('user_id', user.id)
    .eq('connector_id', connectorId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function loadConnectors(): Promise<ConnectorCredential[]> {
  const { data, error } = await supabase
    .from('connector_credentials')
    .select('*')
    .order('connected_at', { ascending: false });

  if (error || !data) return [];
  return data as ConnectorCredential[];
}
