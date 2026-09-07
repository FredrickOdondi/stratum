const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// 'onyx' provides a deep, authoritative consulting voice. 'nova' is a great professional female alternative.
const VOICE_ID = 'onyx'; 

export async function generateSpeech(text: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    console.error('Missing VITE_OPENAI_API_KEY in environment.');
    throw new Error('Missing OpenAI API Key');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: VOICE_ID,
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('OpenAI TTS API error:', errData);
      
      // Specifically handle billing/quota errors
      if (response.status === 429) {
        throw new Error('OpenAI API Error: Insufficient quota or rate limit exceeded. Please check your OpenAI billing details.');
      }
      
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to generate speech:', error);
    throw error;
  }
}
