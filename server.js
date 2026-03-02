
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return cb(null, true);
    }
    if (corsOrigins.length === 0) return cb(null, true);
    if (corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
  credentials: true,
}));
app.use(express.json());

/**
 * إعداد Supabase
 */
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = (supabaseUrl && (supabaseServiceRoleKey || supabaseAnonKey))
  ? createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// إعداد Gemini
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

app.get('/api/health', async (req, res) => {
  res.json({ ok: true });
});

async function getUserFromAuthHeader(req) {
  try {
    if (!supabaseAdmin) return null;
    const auth = req.headers?.authorization;
    if (!auth || typeof auth !== 'string') return null;
    const m = auth.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1];
    if (!token) return null;

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

// --- AI Chat Endpoint ---
app.post('/api/chat', async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const prompt = body.prompt ?? body.message;
    const context = body.context ?? 'عام';
    const useSearch = Boolean(body.useSearch);

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const config = {
      systemInstruction: `أنت "المعلم الخصوصي الذكي". مهمتك: شرح المحاضرات، تبسيط العلوم، وحل التدريبات.\nالسياق التعليمي المتاح: ${context}.`,
      temperature: 0.7,
      ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
    };

    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: prompt,
      config,
    });

    const user = await getUserFromAuthHeader(req);
    if (user && supabaseAdmin) {
      const sessionId = body.sessionId;
      const text = response.text || '';

      if (sessionId) {
        await supabaseAdmin.from('ai_conversations').insert([
          { user_id: user.id, session_id: sessionId, role: 'user', content: prompt },
          { user_id: user.id, session_id: sessionId, role: 'ai', content: text },
        ]).catch(() => {});
      }
    }

    return res.json({
      text: response.text || '',
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks,
    });
  } catch (error) {
    console.error('AI error:', error);
    const message = error?.message || 'AI request failed';
    return res.status(500).json({ error: message });
  }
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const message = err?.message || 'Server error';
  return res.status(500).json({ error: message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 خادم المنصة يعمل على المنفذ ${PORT}`);
});

