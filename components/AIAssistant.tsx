
import React, { useState, useRef, useEffect } from 'react';
import {
  Send, FileText, ClipboardCheck, Brain, Sparkles, Loader2,
  MessageSquare, X, CheckCircle2, Trophy, ChevronRight, ChevronLeft,
  Printer, BookOpen, ArrowRight, ArrowLeft, Eye, RefreshCcw, PlusCircle,
  Library, Share2, Info, Wand2, Layers, PieChart, FileDown, Undo2,
  Link as LinkIcon, Save, Plus, Trash2, Globe, FileSignature, Clock, ImageIcon, Copy, GraduationCap, History,
  Image as LucideImage
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { db, supabase } from '../services/db';
import { Subject, Lecture, PublishedQuiz } from '../types';
import { translations } from '../i18n';
import { CONFIG } from '../services/config';

interface InternalQuestion {
  id: string;
  type: 'multiple' | 'boolean' | 'short';
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface Flashcard {
  front: string;
  back: string;
  imagePrompt: string;
  imageUrl?: string;
}

interface InfographicData {
  title: string;
  subtitle: string;
  leftSide: { name: string; items: { label: string, desc: string, imagePrompt: string, imageUrl?: string }[]; };
  rightSide: { name: string; items: { label: string, desc: string, imagePrompt: string, imageUrl?: string }[]; };
  summary: string;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    pdfjsLib?: any;
  }
}

export const AIAssistant: React.FC<{ lang?: 'ar' | 'en' }> = ({ lang = 'ar' }) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'chat' | 'quiz' | 'flashcards' | 'infographic'>('chat');
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contexts, setContexts] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessionsSidebar, setShowSessionsSidebar] = useState(false);

  // Persist contexts
  useEffect(() => {
    if (contexts.length > 0) {
      localStorage.setItem('ai_assistant_contexts', JSON.stringify(contexts));
    } else {
      localStorage.removeItem('ai_assistant_contexts');
    }
  }, [contexts]);

  // Restore contexts on mount
  useEffect(() => {
    const savedContexts = localStorage.getItem('ai_assistant_contexts');
    if (savedContexts) {
      try {
        setContexts(JSON.parse(savedContexts));
      } catch (e) {
        localStorage.removeItem('ai_assistant_contexts');
      }
    }
  }, []);

  // Flashcards State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Infographic State
  const [infoData, setInfoData] = useState<InfographicData | null>(null);
  const [isGeneratingInfo, setIsGeneratingInfo] = useState(false);

  // Quiz Logic
  const [quizStep, setQuizStep] = useState<'setup' | 'solving' | 'result' | 'review'>('setup');
  const [quizQuestions, setQuizQuestions] = useState<InternalQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [quizSettings, setQuizSettings] = useState({
    title: lang === 'ar' ? 'اختبار مراجعة ذكي' : 'Smart Revision Quiz',
    count: 10,
    timeLimit: 15,
    type: 'mixed' as 'multiple' | 'boolean' | 'mixed'
  });
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    db.getSubjects().then(s => setSubjects(Array.isArray(s) ? s : []));
    loadSessions();
    if (!(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const printA4 = (title: string, html: string, timeLimit?: number, metaData?: any) => {
    const isAr = /[\u0600-\u06FF]/.test(html);
    const win = window.open('', '_blank');
    if (!win) {
      console.error("Popup blocked");
      return;
    }

    win.document.write(`
      <html dir="${isAr ? 'rtl' : 'ltr'}">
        <head>
          <title>${title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Cairo', sans-serif; color: #1e293b; line-height: 1.6; padding: 10px; background: #fff; }
            .header-banner { border: 2px solid #6366f1; padding: 25px; border-radius: 25px; margin-bottom: 30px; text-align: center; position: relative; }
            .header-banner h1 { color: #4f46e5; margin: 0; font-size: 26pt; font-weight: 900; }
            .header-banner .meta { display: flex; justify-content: space-around; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-weight: bold; color: #64748b; font-size: 11pt; flex-wrap: wrap; gap: 10px; }
            .content-box { margin-bottom: 25px; padding: 25px; border: 1px solid #e2e8f0; border-radius: 20px; page-break-inside: avoid; position: relative; }
            .q-card { border-radius: 20px; border: 1px solid #cbd5e1; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; position: relative; }
            .q-num { background: #4f46e5; color: #fff; width: 30px; height: 30px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 11pt; font-weight: 900; margin-inline-end: 12px; vertical-align: middle; }
            .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; }
            .option-item { padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 11pt; font-weight: bold; display: flex; align-items: center; gap: 10px; }
            .correct { border: 3px solid #10b981 !important; background: #f0fdf4 !important; color: #065f46 !important; }
            .wrong { border: 3px solid #ef4444 !important; background: #fef2f2 !important; color: #991b1b !important; }
            .explanation { margin-top: 15px; padding: 15px; background: #fffbeb; border-radius: 12px; font-size: 10pt; border-inline-start: 5px solid #f59e0b; color: #92400e; }
            .footer { margin-top: 50px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 10pt; color: #94a3b8; font-weight: bold; }
            @media print { * { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <h1>${title}</h1>
            <div class="meta">
              <div>اسم الطالب: .......................................</div>
              <div>المادة: ${(contexts[0]?.title || 'مراجعة ذكية').substring(0, 25)}</div>
              ${timeLimit ? `<div>الزمن: ${timeLimit} دقيقة</div>` : ''}
              <div>التاريخ: ${new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</div>
              ${metaData ? `<div>النسبة: ${metaData.percent}%</div>` : ''}
            </div>
          </div>
          <div class="main-content">${html}</div>
          <div class="footer">تم التوليد بواسطة منصة الطالب الذكي - عالمك التعليمي المتكامل &copy; 2025</div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 1000); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setLoading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (file.type === 'application/pdf') {
          const pdfjs = (window as any).pdfjsLib;
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';
          for (let j = 1; j <= Math.min(pdf.numPages, 15); j++) {
            const page = await pdf.getPage(j);
            const content = await page.getTextContent();
            fullText += content.items.map((it: any) => it.str).join(' ') + '\n';
          }
          setContexts(prev => [...prev, { id: Math.random(), title: file.name, data: fullText, type: 'text' }]);
        } else {
          const text = await file.text();
          setContexts(prev => [...prev, { id: Math.random(), title: file.name, data: text, type: 'text' }]);
        }
      } catch (err) { console.error(err); }
    }
    setLoading(false);
  };

  const loadSessions = async () => {
    try {
      const s = await db.getChatSessions();
      if (s && s.length > 0) {
        setSessions(s);
        if (!currentSessionId) {
          setCurrentSessionId(s[0].id);
          loadMessages(s[0].id);
        }
      } else {
        await handleNewChat();
      }
    } catch (e) {
      console.error("Error loading sessions:", e);
      await handleNewChat();
    }
  };

  const loadMessages = async (sessionId: string | null) => {
    if (!sessionId) return;
    const msgs = await db.getChatMessages(sessionId);
    setMessages(msgs);
  };

  // Safety check: if in solving step but no questions, go back to setup
  useEffect(() => {
    if (quizStep === 'solving' && quizQuestions.length === 0 && !quizLoading) {
      setQuizStep('setup');
    }
  }, [quizStep, quizQuestions, quizLoading]);

  // Persist quiz state
  useEffect(() => {
    if (quizQuestions.length > 0) {
      const state = {
        quizStep,
        quizQuestions,
        userAnswers,
        quizScore,
        quizSettings,
        timestamp: Date.now()
      };
      localStorage.setItem('active_quiz_state', JSON.stringify(state));
    }
  }, [quizStep, quizQuestions, userAnswers, quizScore, quizSettings]);

  // Restore quiz state on mount
  useEffect(() => {
    const savedState = localStorage.getItem('active_quiz_state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        // Only restore if it's less than 24 hours old
        if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          setIsRestoring(true);
        }
      } catch (e) {
        localStorage.removeItem('active_quiz_state');
      }
    }
  }, []);

  const confirmRestore = () => {
    const savedState = localStorage.getItem('active_quiz_state');
    if (savedState) {
      const state = JSON.parse(savedState);
      setQuizStep(state.quizStep);
      setQuizQuestions(state.quizQuestions);
      setUserAnswers(state.userAnswers);
      setQuizScore(state.quizScore);
      setQuizSettings(state.quizSettings);
    }
    setIsRestoring(false);
  };

  const discardRestore = () => {
    localStorage.removeItem('active_quiz_state');
    setIsRestoring(false);
  };

  const handleNewChat = async () => {
    const title = lang === 'ar' ? `دردشة جديدة ${new Date().toLocaleTimeString('ar-EG')}` : `New Chat ${new Date().toLocaleTimeString()}`;
    let newSession = await db.createChatSession(title);
    
    if (!newSession) {
      // Fallback to local session if DB fails (e.g. table missing)
      newSession = {
        id: 'local_' + Math.random().toString(36).substr(2, 9),
        title: title,
        isLocal: true,
        created_at: new Date().toISOString()
      };
    }
    
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    setContexts([]);
  };

  const handleSwitchSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    loadMessages(sessionId);
    setShowSessionsSidebar(false);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Direct deletion because confirm() is blocked in sandboxed iframes
    await db.deleteChatSession(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
      handleNewChat();
    }
  };

  const handleImportFromLibrary = async (lec: Lecture) => {
    setLibraryLoading(true);
    try {
      let extractedText = '';
      if (lec.content.startsWith('data:application/pdf')) {
        const pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) throw new Error("PDF.js not loaded");
        const base64 = lec.content.split(',')[1];
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        const pdf = await pdfjs.getDocument({ data: array }).promise;
        for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          extractedText += content.items.map((it: any) => it.str).join(' ') + '\n';
        }
      } else if (lec.type === 'file' && !lec.content.startsWith('http')) {
        extractedText = lec.content;
      } else {
        extractedText = `هذا المرجع عبارة عن رابط للمحاضرة بعنوان: ${lec.title}. المحتوى: ${lec.content}`;
      }
      
      const newContext = { id: Math.random(), title: lec.title, data: extractedText, type: 'text' };
      setContexts(prev => [...prev, newContext]);
      setShowLibraryModal(false);

      // Recognition Message
      const recognitionMsg = lang === 'ar' 
        ? `لقد قمت باستيراد ملف "${lec.title}" بنجاح. أنا الآن جاهز لمساعدتك في فهم محتواه. هل تريد مني تلخيصه لك أو طرح أسئلة حوله؟`
        : `I have successfully imported "${lec.title}". I am now ready to help you understand its content. Would you like me to summarize it or ask questions about it?`;
      
      setMessages(prev => [...prev, { role: 'ai', text: recognitionMsg }]);
      await db.saveChatMessage('ai', recognitionMsg, currentSessionId);

    } catch (err) {
      console.error(err);
      alert("فشل في استيراد وقراءة الملف من المكتبة.");
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading || (contexts || []).length === 0) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    await db.saveChatMessage('user', userMsg, currentSessionId);
    setLoading(true);
    try {
      const apiKey = CONFIG.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key not found");
      const ai = new GoogleGenAI({ apiKey });
      const contextText = contexts.map(c => c.data).join('\n\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: { systemInstruction: `أنت "المعلم الخصوصي الذكي". المرجع: ${contextText.substring(0, 15000)}\nتعرف تلقائياً على لغة الطالب وأجب بنفس لغة ملفه بأسلوب تعليمي مبسط جداً ومبهر.` }
      });
      const aiText = response.text || '';
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
      await db.saveChatMessage('ai', aiText, currentSessionId);
    } catch (e) { 
      const errorMsg = "فشل الاتصال بالمعلم.";
      setMessages(prev => [...prev, { role: 'ai', text: errorMsg }]); 
      await db.saveChatMessage('ai', errorMsg, currentSessionId);
    } finally { setLoading(false); }
  };

  const generateCards = async () => {
    if ((contexts || []).length === 0) {
      console.error("No context for cards");
      return;
    }
    setLoading(true);
    try {
      const apiKey = CONFIG.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key not found");
      const ai = new GoogleGenAI({ apiKey });
      const context = contexts.map(c => c.data).join('\n\n');
      const prompt = `بناءً على المحتوى التالي، قم بإنشاء 10 بطاقات تعليمية (Flashcards).
      المحتوى: ${context.substring(0, 12000)}
      يجب أن يكون الرد JSON فقط بهذا التنسيق:
      [
        {
          "front": "المصطلح أو السؤال",
          "back": "التعريف أو الإجابة المختصرة",
          "imagePrompt": "A simple 3D educational icon of [concept], white background, high quality"
        }
      ]`;

      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const cards: Flashcard[] = JSON.parse(res.text || '[]');
      
      const cardsWithImages = await Promise.all(cards.map(async (card) => {
        try {
          const imgRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: card.imagePrompt }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
          });
          let b64 = "";
          const parts = imgRes.candidates?.[0]?.content?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData) {
                b64 = `data:image/png;base64,${part.inlineData.data}`;
                break;
              }
            }
          }
          return { ...card, imageUrl: b64 };
        } catch (e) { return card; }
      }));

      setFlashcards(cardsWithImages);
      setCurrentCardIdx(0);
      setIsFlipped(false);
    } catch (e) { console.error("Error generating cards", e); } finally { setLoading(false); }
  };

  const generateInfographic = async () => {
    if ((contexts || []).length === 0) {
      console.error("No context for infographic");
      return;
    }
    setIsGeneratingInfo(true);
    setLoading(true);
    try {
      const apiKey = CONFIG.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key not found");
      const ai = new GoogleGenAI({ apiKey });
      const context = contexts.map(c => c.data).join('\n\n');
      const prompt = `قم بتحليل المحتوى المرفق وتوليد بيانات لإنفوجرافيك تعليمي للمقارنة بين جانبين أو شرح هيكلية.
      المحتوى: ${context.substring(0, 12000)}
      يجب أن يكون الرد JSON فقط بهذا التنسيق:
      {
        "title": "عنوان اللوحة",
        "subtitle": "وصف فرعي",
        "leftSide": { "name": "الجانب الأول", "items": [{ "label": "عنوان", "desc": "شرح", "imagePrompt": "icon prompt" }] },
        "rightSide": { "name": "الجانب الثاني", "items": [{ "label": "عنوان", "desc": "شرح", "imagePrompt": "icon prompt" }] },
        "summary": "الخلاصة"
      }`;

      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data: InfographicData = JSON.parse(res.text || '{}');

      const processItems = async (items: any[]) => {
        return await Promise.all(items.map(async (it) => {
          try {
            const imgRes = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts: [{ text: it.imagePrompt }] },
              config: { imageConfig: { aspectRatio: "1:1" } }
            });
            let b64 = "";
            const parts = imgRes.candidates?.[0]?.content?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData) { b64 = `data:image/png;base64,${part.inlineData.data}`; break; }
              }
            }
            return { ...it, imageUrl: b64 };
          } catch (e) { return it; }
        }));
      };

      if (data.leftSide && data.rightSide) {
        data.leftSide.items = await processItems(data.leftSide.items);
        data.rightSide.items = await processItems(data.rightSide.items);
      }
      setInfoData(data);
    } catch (e) { console.error("Error generating infographic", e); } finally { setLoading(false); setIsGeneratingInfo(false); }
  };

  const generateAITest = async () => {
    const currentContexts = contexts || [];
    if (currentContexts.length === 0) {
      alert(lang === 'ar' ? "يرجى رفع ملفات أو استيراد محتوى أولاً" : "Please upload files or import content first");
      return;
    }

    setQuizLoading(true);
    setShareUrl('');
    try {
      const apiKey = CONFIG.GEMINI_API_KEY;
      if (!apiKey) throw new Error(lang === 'ar' ? "لم يتم العثور على مفتاح API. يرجى إدخاله أولاً." : "API Key not found. Please select it first.");
      
      const ai = new GoogleGenAI({ apiKey });
      const context = currentContexts.map(c => c.data).join('\n\n');
      const prompt = `أنت خبير تعليمي محترف. قم بتحويل النص المرفق إلى ${quizSettings.count} أسئلة مراجعة دقيقة وشاملة.
اللغة: يجب أن تكون لغة الأسئلة مطابقة للغة النص المرفق (إذا كان النص بالإنجليزية، اجعل الأسئلة بالإنجليزية. إذا كان بالعربية، اجعلها بالعربية).
نوع الأسئلة المطلوبة: ${quizSettings.type === 'multiple' ? 'اختيار من متعدد' : quizSettings.type === 'boolean' ? 'صح أو خطأ' : 'إجابات قصيرة'}.
يجب أن يكون الرد بتنسيق JSON فقط كصفوفة من الكائنات.
كل كائن يجب أن يحتوي على:
- id: معرف فريد (مثلاً q1, q2)
- type: نوع السؤال (multiple أو boolean أو short)
- question: نص السؤال
- options: مصفوفة من الخيارات (مطلوب لـ multiple و boolean). في حالة multiple يجب أن تكون 4 خيارات. في حالة boolean يجب أن تكون ["صح", "خطأ"] أو ["True", "False"] حسب لغة النص.
- correctAnswer: رقم الفهرس للإجابة الصحيحة (يبدأ من 0)
- explanation: شرح مبسط وواضح للإجابة الصحيحة.

النص المرجعي: ${context.substring(0, 15000)}`;
      
      const responsePromise = ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt, 
        config: { responseMimeType: "application/json" } 
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(lang === 'ar' ? "استغرق الطلب وقتاً طويلاً، يرجى المحاولة مرة أخرى" : "Request timed out, please try again")), 60000)
      );

      const res = await Promise.race([responsePromise, timeoutPromise]) as any;
      
      if (!res || !res.text) throw new Error(lang === 'ar' ? "فشل الذكاء الاصطناعي في الاستجابة" : "AI failed to respond");

      const parsed = JSON.parse(res.text.trim() || '[]');
      const validQuestions = parsed.filter((q: any) => 
        q.question && 
        (q.type === 'boolean' || (q.options && Array.isArray(q.options) && q.options.length > 0))
      ).map((q: any) => ({
        ...q,
        options: q.options || (q.type === 'boolean' ? [lang === 'ar' ? 'صح' : 'True', lang === 'ar' ? 'خطأ' : 'False'] : [])
      }));
      
      if (validQuestions.length === 0) throw new Error(lang === 'ar' ? "لم يتم توليد أسئلة صالحة من هذا المحتوى" : "No valid questions generated from this content");
      
      setQuizQuestions(validQuestions);
      setQuizStep('solving');
      setCurrentQuestionIdx(0);
      setUserAnswers({});
    } catch (e: any) { 
      console.error("Quiz generation error:", e);
      alert(lang === 'ar' ? `خطأ: ${e.message || 'فشل في توليد الاختبار'}` : `Error: ${e.message || 'Failed to generate quiz'}`); 
    } finally { 
      setQuizLoading(false); 
    }
  };

  const handlePublishQuiz = async () => {
    if (quizQuestions.length === 0) return;
    setIsPublishing(true);
    try {
      const session = await db.getSafeSession();
      const user = session?.user;
      
      const quizId = 'quiz_' + Math.random().toString(36).substr(2, 9);
      const quizToPublish: PublishedQuiz = {
        id: quizId,
        creatorId: user?.id || 'anonymous',
        settings: {
          title: quizSettings.title,
          description: `اختبار مراجعة ذكي تم إنشاؤه من ملفات دراسية بمدة ${quizSettings.timeLimit} دقيقة.`,
          timeLimit: quizSettings.timeLimit,
          showScore: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          language: lang === 'ar' ? 'ar' : 'en',
          difficulty: 'medium',
          requireLogin: false,
          maxAttempts: 1
        },
        questions: quizQuestions.map(q => ({
            id: q.id,
            type: q.type,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation
        })),
        createdAt: new Date().toISOString()
      };
      
      const result = await db.publishQuiz(quizToPublish);
      
      if (!result.success) {
        console.warn("Database publish failed, but quiz is saved locally:", result.error);
        // We still proceed because it's saved in LocalStorage for the current user
      }

      const url = `${window.location.origin}${window.location.pathname}?share=${quizId}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url);
      
      // Show success toast/alert
      if (lang === 'ar') {
        alert("تم نشر الاختبار ونسخ الرابط بنجاح! يمكنك الآن مشاركته.");
      } else {
        alert("Quiz published and link copied successfully!");
      }

    } catch (e) { 
      console.error("Error publishing quiz", e); 
      alert("فشل في نشر الاختبار. يرجى المحاولة مرة أخرى.");
    } finally { 
      setIsPublishing(false); 
    }
  };

  const calculateScore = () => quizQuestions.reduce((acc, q) => acc + (userAnswers[q.id] === q.correctAnswer ? 1 : 0), 0);

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-10rem)] ${lang === 'ar' ? 'rtl' : 'ltr'} font-cairo`}>
      {/* Sidebar */}
      <div className="lg:col-span-3 space-y-4 flex flex-col overflow-y-auto no-scrollbar">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="flex flex-col gap-2">
            <button onClick={() => setActiveTab('chat')} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><MessageSquare size={18} /> {t.ai_tab_chat}</button>
            <button onClick={() => { setActiveTab('quiz'); setQuizStep('setup'); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black transition-all ${activeTab === 'quiz' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><ClipboardCheck size={18} /> {t.ai_tab_quiz}</button>
            <button onClick={() => setActiveTab('flashcards')} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black transition-all ${activeTab === 'flashcards' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><Layers size={18} /> {t.ai_tab_flashcards}</button>
            <button onClick={() => setActiveTab('infographic')} className={`w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black transition-all ${activeTab === 'infographic' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}><PieChart size={18} /> {t.ai_tab_infographic}</button>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2.5rem] border border-indigo-100 flex flex-col gap-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase px-2">{t.ai_source_active} ({contexts.length})</h4>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar">
            {contexts.map(c => (
              <div key={c.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-indigo-50 flex items-center justify-between group shadow-sm">
                <div className="flex items-center gap-2 truncate"><FileText size={14} className="text-indigo-500" /><span className="text-[11px] font-bold truncate max-w-[140px]">{c.title}</span></div>
                <button onClick={() => setContexts(prev => prev.filter(x => x.id !== c.id))} className="text-rose-400 opacity-0 group-hover:opacity-100"><X size={14} /></button>
              </div>
            ))}
          </div>
          
          <div className="space-y-3">
            <label className="w-full flex items-center justify-center gap-2 p-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black cursor-pointer shadow-lg hover:bg-indigo-700 transition-all"><PlusCircle size={16} /> {t.ai_upload_btn} <input type="file" multiple className="hidden" accept=".pdf,.txt" onChange={handleFileUpload} /></label>
            <button 
              onClick={() => {
                setShowLibraryModal(true);
                db.getSubjects().then(s => setSubjects(Array.isArray(s) ? s : []));
              }}
              className="w-full flex items-center justify-center gap-2 p-4 bg-white border-2 border-indigo-100 text-indigo-600 rounded-2xl text-[11px] font-black shadow-sm hover:bg-indigo-50 transition-all"
            >
              <Library size={16} /> {t.ai_import_lib}
            </button>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="lg:col-span-9 bg-white dark:bg-slate-900 rounded-[4rem] shadow-2xl flex flex-col border border-slate-100 overflow-hidden relative">
        {(loading || isGeneratingInfo) && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm z-[80] flex flex-col items-center justify-center space-y-4 animate-in fade-in">
            <div className="relative">
              <div className="w-24 h-24 border-8 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
              <Brain className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse" size={32} />
            </div>
            <p className="font-black text-indigo-600 animate-pulse">{lang === 'ar' ? 'جاري التحليل والتوليد بذكاء...' : 'Smart Generating...'}</p>
          </div>
        )}

        {activeTab === 'chat' && (
          <>
            <div className="bg-slate-50/50 px-10 py-6 border-b flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowSessionsSidebar(!showSessionsSidebar)} className="p-3 text-slate-400 hover:text-indigo-600 bg-white rounded-xl border shadow-sm transition-all hover:scale-105 lg:hidden">
                  <Clock size={18} />
                </button>
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><Brain size={24} /></div>
                <div>
                  <h4 className="text-sm font-black">المعلم الخصوصي الذكي</h4>
                  <p className="text-[9px] font-bold text-slate-400">
                    {sessions.find(s => s.id === currentSessionId)?.title || 'دردشة نشطة'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleNewChat} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] hover:bg-indigo-100 transition-all">
                  <Plus size={14} /> {lang === 'ar' ? 'دردشة جديدة' : 'New Chat'}
                </button>
                <button onClick={() => {
                  const html = messages.map(m => `<div class="content-box" style="border-inline-start: 10px solid ${m.role==='user'?'#4f46e5':'#10b981'}; background: ${m.role==='user'?'#f8fafc':'#fff'};"><div class="label">${m.role==='user'?'سؤال الطالب':'شرح المعلم'}</div><div class="text">${m.text.replace(/\n/g, '<br/>')}</div></div>`).join('');
                  printA4('سجل جلسة المذاكرة الذكية', html);
                }} disabled={messages.length === 0} className="p-3 text-slate-400 hover:text-indigo-600 bg-white rounded-xl border shadow-sm transition-all hover:scale-105 disabled:opacity-30"><Printer size={18} /></button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
              {/* Sessions Sidebar (Desktop always visible, Mobile toggle) */}
              <div className={`${showSessionsSidebar ? 'absolute inset-0 z-[90] bg-white dark:bg-slate-900' : 'hidden'} lg:flex lg:relative w-full lg:w-64 border-l dark:border-slate-800 flex-col bg-slate-50/30 dark:bg-slate-950/20`}>
                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ الدردشات</h5>
                  <button onClick={() => setShowSessionsSidebar(false)} className="lg:hidden p-1 text-slate-400"><X size={16}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {sessions.map(s => (
                    <div 
                      key={s.id} 
                      onClick={() => handleSwitchSession(s.id)}
                      className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${currentSessionId === s.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-indigo-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare size={14} />
                        <span className="text-[11px] font-bold truncate max-w-[140px]">{s.title}</span>
                      </div>
                      <button onClick={(e) => handleDeleteSession(s.id, e)} className={`opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all ${currentSessionId === s.id ? 'text-white' : 'text-slate-400'}`}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat View */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar bg-white dark:bg-slate-950/20">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 text-center scale-90">
                      <GraduationCap size={120} className="mb-8 text-indigo-400" />
                      <h3 className="text-3xl font-black">{t.ai_welcome_title}</h3>
                      <p className="font-bold text-lg max-w-xs mt-2 text-slate-600">{t.ai_welcome_desc}</p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                      <div className={`max-w-[85%] p-6 rounded-[2.5rem] text-[13px] font-bold leading-relaxed shadow-sm border border-slate-50 ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-50 dark:bg-slate-800 dark:text-white rounded-bl-none'}`}>{m.text}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-8 border-t dark:border-slate-800">
                  <div className="flex gap-4 bg-slate-50 dark:bg-slate-950 p-2 rounded-[2.5rem] border shadow-inner">
                    <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} className="flex-1 px-8 py-4 bg-transparent outline-none font-bold text-base dark:text-white" placeholder={t.ai_input_placeholder} />
                    <button onClick={handleSendMessage} disabled={loading || !input.trim() || contexts.length === 0} className="w-14 h-14 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-30"><Send size={24} /></button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'quiz' && (
          <div className="flex-1 flex flex-col overflow-hidden">
             {quizStep === 'setup' && (
               <div className="flex-1 p-12 overflow-y-auto flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in">
                  {isRestoring && (
                    <div className="mb-8 p-6 bg-indigo-50 border border-indigo-100 rounded-2xl max-w-md w-full shadow-sm animate-in fade-in slide-in-from-bottom-4">
                      <h5 className="font-black text-indigo-900 mb-2 flex items-center gap-2">
                        <History size={18} />
                        {lang === 'ar' ? 'وجدنا اختباراً سابقاً!' : 'Previous Quiz Found!'}
                      </h5>
                      <p className="text-sm text-indigo-700 mb-4">
                        {lang === 'ar' 
                         ? 'هل ترغب في استكمال مراجعة الاختبار الأخير الذي قمت بتوليده؟' 
                         : 'Would you like to continue reviewing the last quiz you generated?'}
                      </p>
                      <div className="flex gap-3">
                        <button 
                          onClick={confirmRestore}
                          className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                        >
                          {lang === 'ar' ? 'استكمال المراجعة' : 'Continue Review'}
                        </button>
                        <button 
                          onClick={discardRestore}
                          className="flex-1 py-2 bg-white text-gray-600 border border-gray-200 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors"
                        >
                          {lang === 'ar' ? 'بدء جديد' : 'Start New'}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="w-24 h-24 bg-indigo-600 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl"><Sparkles size={48} /></div>
                  <h3 className="text-4xl font-black dark:text-white">{t.ai_quiz_title}</h3>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[3rem] grid grid-cols-3 gap-6 shadow-inner border border-slate-100 w-full max-w-xl">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.ai_quiz_count}</label><input type="number" value={quizSettings.count} onChange={e => setQuizSettings({...quizSettings, count: parseInt(e.target.value) || 5})} className="w-full p-4 bg-white rounded-2xl text-center font-black text-xl" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المدة (د)</label><input type="number" value={quizSettings.timeLimit} onChange={e => setQuizSettings({...quizSettings, timeLimit: parseInt(e.target.value) || 10})} className="w-full p-4 bg-white rounded-2xl text-center font-black text-xl" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.ai_quiz_type}</label>
                      <select value={quizSettings.type} onChange={e => setQuizSettings({...quizSettings, type: e.target.value as any})} className="w-full p-4 bg-white rounded-2xl text-center font-black text-xs appearance-none">
                        <option value="mixed">{t.ai_quiz_type_mixed}</option><option value="multiple">{t.ai_quiz_type_multi}</option><option value="boolean">{t.ai_quiz_type_bool}</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={generateAITest} disabled={quizLoading || contexts.length === 0} className="w-full max-w-xl py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-2xl shadow-xl flex items-center justify-center gap-4 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50">
                    {quizLoading ? <Loader2 className="animate-spin" size={32} /> : <Sparkles size={32} />} {t.ai_quiz_start}
                  </button>
               </div>
             )}

             {quizStep === 'solving' && (
               <div className="flex-1 flex flex-col h-full overflow-y-auto p-12">
                  {quizQuestions.length > 0 && quizQuestions[currentQuestionIdx] ? (
                    <div className="max-w-4xl mx-auto w-full space-y-10">
                      <div className="flex justify-between items-center bg-indigo-50 p-6 rounded-3xl border border-indigo-100 shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">{currentQuestionIdx + 1}</div>
                          <div><h4 className="font-black text-sm">جاري الاختبار...</h4><div className="w-40 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden"><div className="h-full bg-indigo-600 transition-all duration-700" style={{width: `${((currentQuestionIdx+1)/quizQuestions.length)*100}%`}}></div></div></div>
                        </div>
                        <button onClick={() => {
                          const html = quizQuestions.map((q, i) => `<div class="q-card"><div class="q-num">${i+1}</div><div style="font-size:14pt; margin-bottom:15px; font-weight:900;">${q.question}</div><div class="options-grid">${(q.options || []).map(opt => `<div class="option-item">▢ ${opt}</div>`).join('')}</div></div>`).join('');
                          printA4('اختبار مراجعة ورقي فارغ', html, quizSettings.timeLimit);
                        }} className="flex items-center gap-2 text-indigo-600 font-bold text-xs"><Printer size={14}/> تصدير ورقي فارغ</button>
                      </div>
                      <h2 className="text-3xl font-black leading-relaxed dark:text-white text-center">{quizQuestions[currentQuestionIdx].question}</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(quizQuestions[currentQuestionIdx]?.options || []).map((opt, i) => (
                          <button key={i} onClick={() => setUserAnswers({...userAnswers, [quizQuestions[currentQuestionIdx].id]: i})} className={`p-8 rounded-[3rem] text-right font-black text-lg transition-all border-4 flex items-center gap-6 shadow-xl relative ${userAnswers[quizQuestions[currentQuestionIdx].id] === i ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'border-white dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-100'}`}>
                            <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 font-black transition-colors ${userAnswers[quizQuestions[currentQuestionIdx].id] === i ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-300'}`}>{String.fromCharCode(65+i)}</div>
                            <span className="flex-1">{opt}</span>
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between pt-10 border-t items-center">
                        <button onClick={() => setCurrentQuestionIdx(i => Math.max(0, i-1))} disabled={currentQuestionIdx === 0} className="px-10 py-5 bg-slate-100 dark:bg-slate-800 rounded-3xl font-black flex items-center gap-2 transition-all hover:bg-slate-200">{t.ai_quiz_prev}</button>
                        {currentQuestionIdx === quizQuestions.length - 1 ? 
                          <button onClick={() => setQuizStep('result')} disabled={userAnswers[quizQuestions[currentQuestionIdx].id] === undefined} className="px-16 py-5 bg-emerald-600 text-white rounded-3xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">{t.ai_quiz_submit}</button> :
                          <button onClick={() => setCurrentQuestionIdx(i => i + 1)} disabled={userAnswers[quizQuestions[currentQuestionIdx].id] === undefined} className="px-16 py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">{t.ai_quiz_next}</button>
                        }
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                      <Loader2 className="animate-spin text-indigo-600" size={48} />
                      <p className="font-bold text-slate-500">جاري تحضير الأسئلة...</p>
                    </div>
                  )}
               </div>
             )}

             {quizStep === 'result' && (
               <div className="flex-1 p-12 flex flex-col items-center justify-center text-center animate-in zoom-in space-y-10 overflow-y-auto">
                 <div className="w-32 h-32 bg-indigo-100 rounded-full flex items-center justify-center mx-auto shadow-2xl border-[10px] border-white animate-bounce"><Trophy size={80} className="text-indigo-600" /></div>
                 <h2 className="text-5xl font-black dark:text-white">{t.ai_quiz_report}</h2>
                 <div className="grid grid-cols-2 gap-8 w-full max-w-2xl">
                    <div className="bg-white dark:bg-slate-800 p-10 rounded-[3.5rem] shadow-xl border-2 border-slate-100 flex flex-col items-center">
                       <span className="text-7xl font-black text-slate-800 dark:text-white">{quizQuestions.length}</span>
                       <span className="text-[12px] font-black text-slate-400 mt-2 uppercase tracking-widest">{t.ai_quiz_total_label}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-10 rounded-[3.5rem] shadow-xl border-2 border-emerald-100 flex flex-col items-center">
                       <span className="text-7xl font-black text-emerald-500">{calculateScore()}</span>
                       <span className="text-[12px] font-black text-slate-400 mt-2 uppercase tracking-widest">{t.ai_quiz_score_label}</span>
                    </div>
                 </div>

                 {shareUrl && (
                   <div className="w-full max-w-xl bg-indigo-50 p-4 rounded-2xl border border-indigo-200 flex items-center gap-4 animate-in slide-in-from-top-4">
                      <LinkIcon className="text-indigo-600" size={20}/>
                      <input readOnly value={shareUrl} className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-indigo-700" />
                      <button onClick={() => { navigator.clipboard.writeText(shareUrl); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black">نسخ</button>
                   </div>
                 )}

                 <div className="flex flex-wrap justify-center gap-4">
                    <button onClick={handlePublishQuiz} disabled={isPublishing} className="px-8 py-5 bg-white border-2 border-indigo-600 text-indigo-600 rounded-3xl font-black shadow-sm flex items-center gap-3 hover:bg-indigo-600 hover:text-white transition-all">
                      {isPublishing ? <Loader2 className="animate-spin" size={20}/> : <Share2 size={20}/>} نشر الاختبار ونسخ الرابط
                    </button>
                    <button onClick={() => setQuizStep('review')} className="px-8 py-5 bg-indigo-50 text-indigo-600 rounded-3xl font-black shadow-sm flex items-center gap-2 hover:scale-105 transition-all"><Eye size={20}/> مراجعة الإجابات والشرح</button>
                    <button onClick={() => setQuizStep('setup')} className="px-8 py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-xl hover:scale-105 transition-all"><RefreshCcw size={20} className="ml-2"/> {t.ai_quiz_retry}</button>
                 </div>
               </div>
             )}

             {quizStep === 'review' && (
               <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div className="px-10 py-6 border-b flex justify-between items-center bg-white shadow-sm z-10">
                    <h4 className="text-2xl font-black">تحليل الأسئلة بالتفصيل 🎯</h4>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={handlePublishQuiz} 
                        disabled={isPublishing}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        {isPublishing ? <Loader2 className="animate-spin" size={16}/> : <Share2 size={16}/>}
                        {shareUrl ? (lang === 'ar' ? 'تم النسخ!' : 'Copied!') : (lang === 'ar' ? 'نشر ومشاركة' : 'Publish & Share')}
                      </button>
                      <button onClick={() => {
                        const html = quizQuestions.map((q, i) => {
                          const isCorrect = userAnswers[q.id] === q.correctAnswer;
                          const opts = q.options || [];
                          return `<div class="q-card ${isCorrect?'correct':'wrong'}"><div class="q-num" style="background:${isCorrect?'#10b981':'#ef4444'}">${i+1}</div><div style="font-weight:900; margin-bottom:10px;">${q.question}</div><div style="font-weight:bold; color:#475569;">إجابتك: ${opts[userAnswers[q.id]]||'--'} ${isCorrect?'✅':'❌'}</div>${!isCorrect?`<div style="color:#059669; font-weight:bold;">الصحيحة: ${opts[q.correctAnswer] || '--'}</div>`:''}<div class="explanation"><b>شرح المعلم الخصوصي:</b> ${q.explanation}</div></div>`;
                        }).join('');
                        printA4('تقرير مراجعة الاختبار الشامل', html, quizSettings.timeLimit, { percent: Math.round((calculateScore()/quizQuestions.length)*100) });
                      }} className="px-6 py-3 bg-amber-500 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg hover:bg-amber-600 transition-all"><Printer size={16}/> طباعة التقرير PDF</button>
                      <button onClick={() => setQuizStep('result')} className="p-3 bg-slate-100 text-slate-400 hover:text-rose-500 rounded-xl transition-all shadow-sm" title="إغلاق"><X size={20} /></button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar bg-slate-50/30">
                    {quizQuestions.map((q, i) => {
                      const isCorrect = userAnswers[q.id] === q.correctAnswer;
                      return (
                        <div key={i} className={`bg-white dark:bg-slate-900 p-10 rounded-[3rem] border-4 shadow-xl relative animate-in slide-in-from-bottom-4 ${isCorrect ? 'border-emerald-100' : 'border-rose-100'}`}>
                           <div className="flex items-center gap-6 mb-8">
                             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg ${isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`}>{i + 1}</div>
                             <h4 className="text-2xl font-black leading-relaxed">{q.question}</h4>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                              {(q.options || []).map((opt, oi) => {
                                const isUser = userAnswers[q.id] === oi;
                                const isAns = oi === q.correctAnswer;
                                return (
                                  <div key={oi} className={`p-6 rounded-[2rem] border-4 font-bold flex items-center gap-4 ${isAns ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : isUser ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${isAns ? 'bg-emerald-500 text-white' : isUser ? 'bg-rose-500 text-white' : 'bg-slate-200'}`}>{String.fromCharCode(65+oi)}</div>
                                    {opt}
                                  </div>
                                );
                              })}
                           </div>
                           <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border-r-8 border-amber-400 rounded-2xl text-sm leading-relaxed font-bold shadow-inner flex items-start gap-4">
                              <Info className="text-amber-500 shrink-0" size={24}/>
                              <p><b>شرح المعلم:</b><br/>{q.explanation}</p>
                           </div>
                        </div>
                      );
                    })}
                  </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'flashcards' && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 overflow-y-auto">
            {flashcards.length === 0 ? (
              <div className="text-center space-y-6">
                <Layers size={100} className="text-indigo-400 mx-auto" />
                <h2 className="text-3xl font-black">بطاقات المذاكرة بالصور</h2>
                <p className="text-slate-500 font-bold max-w-sm mx-auto">سأقوم بتحويل مادتك إلى بطاقات وجه وخلفية مع صور توضيحية ذكية.</p>
                <button onClick={generateCards} disabled={loading || contexts.length === 0} className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3">
                  {loading && <Loader2 className="animate-spin" size={20} />}
                  توليد البطاقات الآن
                </button>
              </div>
            ) : (
              <div className="w-full max-w-md animate-in zoom-in">
                <div onClick={() => setIsFlipped(!isFlipped)} className={`relative h-[450px] w-full cursor-pointer transition-all duration-700 preserve-3d shadow-2xl rounded-[3.5rem] ${isFlipped ? 'rotate-y-180' : ''}`}>
                  <div className="absolute inset-0 bg-white dark:bg-slate-800 border-[10px] border-indigo-50 dark:border-indigo-950 flex flex-col items-center justify-center p-10 text-center backface-hidden rounded-[3.5rem]">
                    {flashcards[currentCardIdx]?.imageUrl ? (
                      <img src={flashcards[currentCardIdx].imageUrl} className="w-40 h-40 mb-6 object-contain rounded-2xl" alt="concept"/>
                    ) : (
                      <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-6 opacity-20"><LucideImage size={64}/></div>
                    )}
                    <span className="text-[10px] font-black text-indigo-400 uppercase mb-4 tracking-widest">المصطلح / المفهوم</span>
                    <h3 className="text-2xl font-black dark:text-white leading-tight">{flashcards[currentCardIdx]?.front}</h3>
                  </div>
                  <div className="absolute inset-0 bg-indigo-600 text-white flex items-center justify-center p-10 text-center rotate-y-180 backface-hidden rounded-[3.5rem] shadow-2xl">
                    <p className="text-xl font-bold leading-relaxed">{flashcards[currentCardIdx]?.back}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-12 px-6">
                   <button onClick={() => {setCurrentCardIdx(i=>Math.max(0, i-1)); setIsFlipped(false);}} className="p-5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-indigo-50 dark:border-slate-700 hover:scale-110 transition-all"><ChevronRight size={24}/></button>
                   <div className="text-center"><p className="text-2xl font-black dark:text-white">{currentCardIdx + 1}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">من {flashcards.length}</p></div>
                   <button onClick={() => {setCurrentCardIdx(i=>Math.min(flashcards.length-1, i+1)); setIsFlipped(false);}} className="p-5 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-indigo-50 dark:border-slate-700 hover:scale-110 transition-all"><ChevronLeft size={24}/></button>
                </div>
                <button onClick={() => {
                  const html = flashcards.map(c => `<div style="display:flex; border:2px dashed #4f46e5; margin-bottom:20px; page-break-inside:avoid; border-radius:15px; padding:20px;"><div style="flex:1; border-inline-end:2px dashed #4f46e5; text-align:center;">${c.imageUrl?`<img src="${c.imageUrl}" style="width:60px;"/>`:''}<div><b>${c.front}</b></div></div><div style="flex:1; padding:10px; text-align:center;">${c.back}</div></div>`).join('');
                  printA4('بطاقات المراجعة الذكية للطباعة والقص', html);
                }} className="w-full mt-8 py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><Printer size={16}/> طباعة للقص (PDF)</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'infographic' && (
          <div className="flex-1 p-12 overflow-y-auto">
            {!infoData ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <PieChart size={100} className="text-indigo-400 mx-auto" />
                <h3 className="text-3xl font-black">{t.ai_tab_infographic}</h3>
                <p className="text-slate-500 font-bold max-w-sm mx-auto">سأقوم بتحليل موضوعك وتحويله لمقارنة بصرية مدعومة بالصور.</p>
                <button onClick={generateInfographic} disabled={loading || contexts.length === 0} className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black mx-auto shadow-xl hover:scale-105 transition-all flex items-center gap-3">
                  {loading && <Loader2 className="animate-spin" size={20} />}
                  تحليل وبناء الإنفوجرافيك
                </button>
              </div>
            ) : (
              <div className="space-y-10 animate-in zoom-in pb-10">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-8 rounded-[3rem] border border-indigo-50 shadow-sm">
                  <div className="text-right">
                    <h2 className="text-4xl font-black dark:text-white">{infoData.title}</h2>
                    <p className="text-slate-500 font-bold mt-2 text-lg">{infoData.subtitle}</p>
                  </div>
                  <button onClick={() => {
                    const html = `
                      <div style="text-align:center; margin-bottom:30px;"><h1 style="color:#4f46e5; margin:0;">${infoData.title}</h1><p style="color:#64748b; font-weight:bold;">${infoData.subtitle}</p></div>
                      <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                        <div class="content-box" style="border-color:#fda4af; background:#fff1f2;">
                           <h2 style="color:#e11d48; border-bottom:2px solid #fda4af; padding-bottom:10px;">${infoData.leftSide.name}</h2>
                           ${infoData.leftSide.items.map(it => `<div style="margin-top:20px;">${it.imageUrl?`<img src="${it.imageUrl}" style="width:50px;"/>`:''}<b>• ${it.label}:</b><br/>${it.desc}</div>`).join('')}
                        </div>
                        <div class="content-box" style="border-color:#c7d2fe; background:#f8faff;">
                           <h2 style="color:#4f46e5; border-bottom:2px solid #c7d2fe; padding-bottom:10px;">${infoData.rightSide.name}</h2>
                           ${infoData.rightSide.items.map(it => `<div style="margin-top:20px;">${it.imageUrl?`<img src="${it.imageUrl}" style="width:50px;"/>`:''}<b>• ${it.label}:</b><br/>${it.desc}</div>`).join('')}
                        </div>
                      </div>
                      <div class="content-box" style="background:#0f172a; color:#fff; margin-top:30px; text-align:center;">
                        <h3>الخلاصة العلمية المركزة:</h3><p style="font-size:13pt; line-height:1.8;">${infoData.summary}</p>
                      </div>
                    `;
                    printA4(infoData.title, html);
                  }} className="px-8 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl flex items-center gap-3 hover:scale-105 transition-all"><FileDown size={24}/> تصدير اللوحة (PDF)</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-10 bg-rose-50 dark:bg-rose-900/10 rounded-[3.5rem] border-4 border-rose-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-rose-500 opacity-20"></div>
                    <h4 className="text-2xl font-black text-rose-600 mb-8 border-b-2 border-rose-200 pb-4">{infoData.leftSide.name}</h4>
                    <div className="space-y-8">
                       {infoData.leftSide.items.map((it, i) => (
                         <div key={i} className="animate-in slide-in-from-right-2 flex gap-4">
                            {it.imageUrl && <img src={it.imageUrl} className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-md border-2 border-white" alt="icon"/>}
                            <div><b>• {it.label}:</b> <span className="text-sm block mt-2 text-slate-600 dark:text-slate-400 leading-relaxed font-bold">{it.desc}</span></div>
                         </div>
                       ))}
                    </div>
                  </div>
                  <div className="p-10 bg-indigo-50 dark:bg-indigo-900/10 rounded-[3.5rem] border-4 border-indigo-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-indigo-600 opacity-20"></div>
                    <h4 className="text-2xl font-black text-indigo-600 mb-8 border-b-2 border-indigo-200 pb-4">{infoData.rightSide.name}</h4>
                    <div className="space-y-8">
                       {infoData.rightSide.items.map((it, i) => (
                         <div key={i} className="animate-in slide-in-from-left-2 flex gap-4">
                            {it.imageUrl && <img src={it.imageUrl} className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-md border-2 border-white" alt="icon"/>}
                            <div><b>• {it.label}:</b> <span className="text-sm block mt-2 text-slate-600 dark:text-slate-400 leading-relaxed font-bold">{it.desc}</span></div>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
                <div className="p-12 bg-slate-900 text-white rounded-[4rem] font-bold shadow-2xl relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-indigo-500/10 to-transparent"></div>
                   <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6 text-indigo-400"><Brain size={32} /><span className="text-xs uppercase tracking-[0.4em] font-black">الخلاصة العلمية المركزة</span></div>
                      <p className="text-2xl leading-relaxed text-indigo-50">{infoData.summary}</p>
                   </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Library Modal */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[4rem] p-12 shadow-2xl relative animate-in zoom-in border-4 border-white/10">
            <button onClick={() => setShowLibraryModal(false)} className="absolute top-12 left-12 p-3 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"><X size={32} /></button>
            <div className="text-center mb-12"><div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner"><Library size={48} /></div><h3 className="text-4xl font-black dark:text-white">الاستيراد من المكتبة</h3></div>
            <div className="max-h-[450px] overflow-y-auto space-y-8 custom-scrollbar">
              {libraryLoading ? (
                <div className="py-20 text-center space-y-6">
                  <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="font-black text-indigo-600 animate-pulse">جاري استيراد وقراءة محتوى الملف...</p>
                </div>
              ) : subjects.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <BookOpen size={64} className="mx-auto text-slate-200" />
                  <p className="font-bold text-slate-400">لا توجد مواد دراسية في مكتبتك حالياً.</p>
                  <p className="text-xs text-slate-400">قم بإضافة مواد ومحاضرات من صفحة "المواد الدراسية" أولاً.</p>
                </div>
              ) : subjects.map(sub => (
                <div key={sub.id} className="space-y-4">
                  <div className="flex items-center gap-4 px-6"><div className={`w-3.5 h-3.5 rounded-full ${sub.color} shadow-lg`}></div><span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">{sub.name}</span></div>
                  <div className="grid grid-cols-1 gap-4">
                    {sub.lectures.length === 0 ? (
                      <div className="p-4 text-center text-[10px] font-bold text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl">لا توجد محاضرات لهذه المادة</div>
                    ) : sub.lectures.map(lec => (
                      <button key={lec.id} onClick={() => handleImportFromLibrary(lec)} className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-transparent hover:border-indigo-500 transition-all shadow-md text-right group">
                        <div className="flex items-center gap-5"><div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm"><FileText size={28} /></div><span className="font-black text-lg dark:text-white">{lec.title}</span></div>
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"><ArrowRight size={24} /></div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .rotate-y-180 { transform: rotateY(180deg); }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4f46e5; border-radius: 10px; }
      `}</style>
    </div>
  );
};
