import { supabase } from './supabase';

export interface DocumentChunk {
  index: number;
  text: string;
  charCount: number;
}

function sanitizeForPostgres(text: string): string {
  return text
    .replace(/\0/g, '') // remove null bytes (PostgreSQL jsonb / text cannot contain \u0000)
    .replace(/[\uD800-\uDFFF]/g, '') // remove lone surrogates
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

import { unzlibSync } from 'fflate';

function extractPdfText(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    let binaryStr = '';
    const chunkSz = 8192;
    for (let i = 0; i < bytes.length; i += chunkSz) {
      binaryStr += String.fromCharCode(...bytes.subarray(i, i + chunkSz));
    }

    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;
    let allText = '';

    while ((match = streamRegex.exec(binaryStr)) !== null) {
      const rawStr = match[1];
      const rawBytes = new Uint8Array(rawStr.length);
      for (let i = 0; i < rawStr.length; i++) {
        rawBytes[i] = rawStr.charCodeAt(i);
      }

      try {
        const unzipped = unzlibSync(rawBytes);
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(unzipped);

        const tjMatches = decoded.match(/\((.*?)\)\s*Tj/g) || [];
        for (const tj of tjMatches) {
          const inner = tj.replace(/^\(/, '').replace(/\)\s*Tj$/, '').trim();
          if (inner.length > 0) allText += inner + ' ';
        }

        const tjArrMatches = decoded.match(/\[(.*?)\]\s*TJ/g) || [];
        for (const arr of tjArrMatches) {
          const parts = arr.match(/\((.*?)\)/g) || [];
          for (const p of parts) {
            allText += p.slice(1, -1);
          }
          allText += ' ';
        }
      } catch {
        // Not a zlib compressed text stream, skip
      }
    }

    return allText.trim();
  } catch (err) {
    console.warn('PDF stream extraction error:', err);
    return '';
  }
}

export async function parseAndChunkFile(file: File, chunkSize = 1200, overlap = 200): Promise<DocumentChunk[]> {
  try {
    let rawText = '';

    const lowerName = file.name.toLowerCase();
    const isPlainText =
      file.type.includes('text') ||
      file.type.includes('json') ||
      file.type.includes('csv') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.json') ||
      lowerName.endsWith('.csv') ||
      lowerName.endsWith('.tsv') ||
      lowerName.endsWith('.html') ||
      lowerName.endsWith('.xml');

    if (isPlainText) {
      rawText = await file.text();
    } else if (lowerName.endsWith('.pdf') || file.type.includes('pdf')) {
      const buffer = await file.arrayBuffer();
      const extracted = extractPdfText(buffer);
      if (extracted && extracted.length > 50) {
        rawText = extracted;
      } else {
        const decoder = new TextDecoder('utf-8', { fatal: false });
        rawText = decoder.decode(buffer);
      }
    } else {
      // For other binary formats, extract printable text runs
      const buffer = await file.arrayBuffer();
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const decoded = decoder.decode(buffer);
      
      const printableMatches = decoded.match(/[\w\s.,;:!?'"()\/\-_=+$%&#@*]{3,}/g);
      if (printableMatches && printableMatches.length > 0) {
        rawText = printableMatches.join(' ');
      } else {
        rawText = decoded;
      }
    }

    if (rawText.length > 80000) {
      rawText = rawText.slice(0, 80000);
    }

    rawText = sanitizeForPostgres(rawText);

    if (!rawText.trim()) {
      return [{ index: 0, text: `[Attachment: ${file.name}, size: ${file.size} bytes]`, charCount: 0 }];
    }

    const chunks: DocumentChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < rawText.length) {
      const end = Math.min(start + chunkSize, rawText.length);
      const chunkText = rawText.slice(start, end).trim();
      if (chunkText.length > 0) {
        chunks.push({
          index,
          text: chunkText,
          charCount: chunkText.length,
        });
        index++;
      }
      start += chunkSize - overlap;
      if (start >= rawText.length || end === rawText.length) break;
    }

    return chunks.length > 0
      ? chunks
      : [{ index: 0, text: `[Attachment: ${file.name}, size: ${file.size} bytes]`, charCount: 0 }];
  } catch (err) {
    console.error('Failed to parse file:', file.name, err);
    return [{ index: 0, text: `[Attachment: ${file.name}, size: ${file.size} bytes]`, charCount: 0 }];
  }
}

import { uploadToS3 } from './s3Storage';
import { indexDataToPinecone } from './pinecone';

export const STORAGE_BUCKET =
  (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string) || 'bamburi111';

export async function uploadAndSaveDocument(engagementId: string, file: File) {
  // 1. Parse and chunk file text for AI model consumption
  const chunks = await parseAndChunkFile(file);

  // 2. Upload raw file to S3 bucket bamburi111
  let storagePath: string | null = null;
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileKey = `${engagementId}/${Date.now()}_${cleanName}`;

  try {
    const s3Result = await uploadToS3(fileKey, file, file.type || 'application/octet-stream');
    if (s3Result.success) {
      storagePath = s3Result.url;
      console.log(`[S3 Storage] Successfully uploaded to bucket "${STORAGE_BUCKET}": ${storagePath}`);
    } else {
      console.warn(`[S3 Storage] Upload notice:`, s3Result.error);
    }
  } catch (err) {
    console.warn(`[S3 Storage] Upload error:`, err);
  }

  // 3. Send to Pinecone
  let embedded = false;
  try {
    const fullText = chunks.map(c => c.text).join('\n\n');
    await indexDataToPinecone(engagementId, [
      { source: file.name, type: 'document', data: [{ content: fullText }] }
    ]);
    embedded = true;
    console.log(`[Pinecone] Successfully embedded ${file.name}`);
  } catch (err) {
    console.error(`[Pinecone] Failed to embed ${file.name}:`, err);
  }

  // 4. Insert record with chunks and storage_path into Supabase documents table
  const { data, error } = await supabase
    .from('documents')
    .insert({
      engagement_id: engagementId,
      name: file.name,
      storage_path: storagePath || fileKey,
      mime_type: file.type || 'application/octet-stream',
      size: file.size,
      parsed_chunks: chunks,
      embedded: embedded,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to insert document row into Supabase:', error);
    throw new Error(`Failed to save document "${file.name}" to database: ${error.message}`);
  }

  return data;
}
