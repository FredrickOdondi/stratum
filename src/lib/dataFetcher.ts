import Papa from 'papaparse';
import { supabase } from './supabase';

export interface DataStream {
  name: string;
  data: any[];
}

export interface ConsolidatedDataResult {
  connector_id: string;
  display_name: string;
  category: 'ecommerce' | 'marketing' | 'finance' | 'customer_support' | 'analytics' | 'database';
  streams: DataStream[];
}

export async function fetchSupabaseTables(projectUrl: string, serviceRoleKey: string): Promise<string[]> {
  try {
    const baseUrl = projectUrl.trim().replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/rest/v1/`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('Supabase schema fetch failed with status:', response.status);
      return [];
    }
    
    const schema = await response.json();
    
    // PostgREST might return OpenAPI 2.0 (definitions) or 3.0 (components.schemas)
    if (schema.definitions) {
      return Object.keys(schema.definitions);
    } else if (schema.components && schema.components.schemas) {
      return Object.keys(schema.components.schemas);
    }
    
    console.error('No definitions or schemas found in OpenAPI spec:', schema);
    return [];
  } catch (err) {
    console.error('Error fetching Supabase schema:', err);
    return [];
  }
}

export async function fetchSupabaseSchemaDetailed(projectUrl: string, serviceRoleKey: string): Promise<string> {
  try {
    const baseUrl = projectUrl.trim().replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/rest/v1/`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) return 'Failed to fetch schema';
    
    const schema = await response.json();
    let schemaStr = '';
    
    const definitions = schema.definitions || (schema.components && schema.components.schemas);
    if (!definitions) return 'No tables found in schema';

    for (const [tableName, def] of Object.entries(definitions)) {
      schemaStr += `Table: ${tableName}\n`;
      const props = (def as any).properties || {};
      for (const [colName, colDef] of Object.entries(props)) {
        const type = (colDef as any).type || 'unknown';
        const format = (colDef as any).format ? ` (${(colDef as any).format})` : '';
        const desc = (colDef as any).description ? ` - ${(colDef as any).description}` : '';
        schemaStr += `  - ${colName}: ${type}${format}${desc}\n`;
      }
      schemaStr += '\n';
    }
    
    return schemaStr.trim();
  } catch (err) {
    return 'Error fetching schema details.';
  }
}

export async function fetchConsolidatedData(
  connectorId: string, 
  displayName: string,
  credentials: Record<string, any>,
  selectedTables?: string[]
): Promise<ConsolidatedDataResult> {
  
  const result: ConsolidatedDataResult = {
    connector_id: connectorId,
    display_name: displayName,
    category: 'analytics',
    streams: []
  };

  try {
    if (connectorId === 'paystack') {
      result.category = 'finance';
      
      const secretKey = credentials['test_secret_key'] || credentials['secret_key'];
      if (!secretKey) throw new Error('No secret key found for Paystack');

      const headers = {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      };

      const [txnsRes, custRes, refundsRes, disputesRes] = await Promise.all([
        fetch('https://api.paystack.co/transaction?perPage=10', { method: 'GET', headers }),
        fetch('https://api.paystack.co/customer?perPage=10', { method: 'GET', headers }),
        fetch('https://api.paystack.co/refund?perPage=10', { method: 'GET', headers }),
        fetch('https://api.paystack.co/dispute?perPage=10', { method: 'GET', headers })
      ]);

      if (!txnsRes.ok) throw new Error(`Paystack API error: ${txnsRes.statusText}`);

      const [txns, custs, refunds, disputes] = await Promise.all([
        txnsRes.json(), custRes.json(), refundsRes.json(), disputesRes.json()
      ]);
      
      if (txns.data && Array.isArray(txns.data)) {
        result.streams.push({
          name: 'Transactions',
          data: txns.data.map((txn: any) => ({
            reference: txn.reference,
            date: new Date(txn.created_at).toLocaleDateString(),
            amount: (txn.amount / 100).toFixed(2),
            currency: txn.currency,
            status: txn.status,
            customer: txn.customer?.email || 'Unknown',
            channel: txn.channel
          }))
        });
      }

      if (custs.data && Array.isArray(custs.data)) {
        result.streams.push({
          name: 'Customers',
          data: custs.data.map((c: any) => ({
            customer_code: c.customer_code,
            email: c.email,
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
            phone: c.phone || 'N/A',
            created: new Date(c.created_at).toLocaleDateString()
          }))
        });
      }

      if (refunds.data && Array.isArray(refunds.data)) {
        result.streams.push({
          name: 'Refunds',
          data: refunds.data.map((r: any) => ({
            id: r.id,
            transaction: r.transaction?.reference || 'N/A',
            amount: (r.amount / 100).toFixed(2),
            currency: r.currency,
            status: r.status,
            date: new Date(r.created_at).toLocaleDateString()
          }))
        });
      }

      if (disputes.data && Array.isArray(disputes.data)) {
        result.streams.push({
          name: 'Disputes',
          data: disputes.data.map((d: any) => ({
            id: d.id,
            transaction: d.transaction?.reference || 'N/A',
            amount: (d.dispute_amount / 100).toFixed(2),
            status: d.status,
            reason: d.reason || 'N/A',
            date: new Date(d.created_at).toLocaleDateString()
          }))
        });
      }
    } else if (connectorId === 'csv') {
      result.category = 'analytics';
      let filePath = credentials['csv_url'];
      if (!filePath) throw new Error('No CSV file path provided');

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('csv_uploads')
        .download(filePath);

      if (downloadError) throw new Error(`Failed to download CSV: ${downloadError.message}`);
      if (!fileData) throw new Error('Downloaded file is empty');
      
      const csvText = await fileData.text();
      
      // If the response is actually an HTML page (e.g. wrong link provided), throw a clear error
      if (csvText.trim().toLowerCase().startsWith('<!doctype html>') || csvText.includes('<html')) {
        throw new Error('The provided URL returned a web page (HTML) instead of a raw CSV file. Please provide a direct download link to the CSV.');
      }

      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      let finalData = parsed.data as any[];

      // If PapaParse completely fails due to malformed quotes, do a naive manual parse
      if (finalData.length === 0 && csvText.trim().length > 0) {
        const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
          finalData = lines.slice(1).map(line => {
            // Naive split that ignores quotes entirely just to get the data out
            const values = line.split(',');
            const row: any = {};
            headers.forEach((h, i) => {
              row[h] = (values[i] || '').replace(/^"|"$/g, '').trim();
            });
            return row;
          });
        }
      }

      if (finalData.length === 0) {
        throw new Error(`CSV is empty or could not be parsed.`);
      }

      result.streams.push({
        name: 'CSV Data',
        data: finalData.slice(0, 50)
      });
    } else if (connectorId === 'supabase') {
      result.category = 'database';
      const projectUrl = credentials['project_url'];
      const serviceRoleKey = credentials['service_role_key'];
      
      if (!projectUrl || !serviceRoleKey) throw new Error('Missing Supabase credentials');

      // Sync user's selected tables, or try some common defaults if none selected yet
      const tablesToSync = selectedTables && selectedTables.length > 0 
        ? selectedTables 
        : ['users', 'customers', 'profiles', 'orders'];

      let fetchedAtLeastOne = false;

      for (const table of tablesToSync) {
        try {
          const response = await fetch(`${projectUrl}/rest/v1/${table}?select=*&limit=50`, {
            headers: {
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
              fetchedAtLeastOne = true;
              result.streams.push({
                name: `Table: ${table}`,
                data: data
              });
            } else if (selectedTables && selectedTables.length > 0) {
              result.streams.push({
                name: `Table: ${table}`,
                data: [{ message: 'No rows found in this table.' }]
              });
            }
          }
        } catch (err) {
          console.error(`Failed to fetch table ${table}:`, err);
        }
      }
      
      if (!fetchedAtLeastOne && (!selectedTables || selectedTables.length === 0)) {
        result.streams.push({
          name: 'Database Info',
          data: [{ message: 'Connected successfully. Select specific tables to view their data.' }]
        });
      }
    } else {
      // Fallback for other connectors that aren't fully implemented with live APIs yet
      result.category = 'analytics';
      result.data = [
        { metric: 'Status', value: 'Live API integration pending for this connector' }
      ];
    }
  } catch (error) {
    console.error(`Failed to fetch data for ${connectorId}:`, error);
    result.data = [
      { error: (error as Error).message || 'Failed to fetch live data' }
    ];
  }

  return result;
}
