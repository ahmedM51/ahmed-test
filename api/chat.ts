import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const prompt = body.prompt ?? body.message;
    const context = body.context ?? 'عام';
    const useSearch = Boolean(body.useSearch);

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const config: any = {
      systemInstruction: `أنت "المعلم الخصوصي الذكي". مهمتك: شرح المحاضرات، تبسيط العلوم، وحل التدريبات.\nالسياق التعليمي المتاح: ${context}.` ,
      temperature: 0.7,
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config,
    });

    return res.status(200).json({
      text: response.text || '',
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks,
    });
  } catch (e: any) {
    const message = e?.message || 'AI request failed';
    return res.status(500).json({ error: message });
  }
}
