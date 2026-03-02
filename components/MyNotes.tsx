
import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Trash2, Tag, Plus, FileAudio, Sparkles, Loader2, 
  X, Upload, Square, CheckCircle2, Search, Volume2, Hash,
  Wand2, FileText, Languages, MessageSquarePlus, Globe
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import { db } from '../services/db';
import { Note } from '../types';
import { translations } from '../i18n';

// Audio decoding helpers
const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

const decodeBase64 = (base64: string) => {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Base64 decoding error", e);
    return new Uint8Array(0);
  }
};

export const MyNotes: React.FC<{ lang?: 'ar' | 'en' }> = ({ lang = 'ar' }) => {
  const t = translations[lang];
  const [notes, setNotes] = useState<Note[]>([]);
  const categories = [t.notes_cat_lectures, t.notes_cat_ideas, t.notes_cat_review, t.notes_cat_research];
  const [selectedCategory, setSelectedCategory] = useState(t.notes_all);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [translatingId, setTranslatingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [processedResult, setProcessedResult] = useState<{title: string, text: string, translation?: string} | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => { 
    const loadNotes = async () => {
      try {
        const n = await db.getNotes();
        setNotes(n || []);
      } catch (e) {
        console.error("Failed to load notes", e);
      }
    };
    loadNotes();
  }, []);

  // Sync selected category with language changes
  useEffect(() => {
    setSelectedCategory(t.notes_all);
  }, [lang]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setProcessedResult(null);
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (err) { 
      alert(t.notes_mic_allow); 
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleAIConvert = async () => {
    if (!audioBlob) return;
    setLoading(true);
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
      };

      const base64Data = await blobToBase64(audioBlob);
      
      // Prompt exactly as requested by user for Arabic summary + English translation
      const prompt = `قم بتفريغ هذا المقطع الصوتي بدقة. ثم لخصه في عنوان جذاب ونقاط واضحة باللغة العربية. وأيضاً قم بترجمة الملخص إلى اللغة الإنجليزية. أجب بتنسيق JSON حصراً: {"title": "عنوان الملاحظة", "text": "التفريغ والملخص بالعربي", "translation": "English Translation"}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { 
          parts: [
            { inlineData: { data: base64Data, mimeType: audioBlob.type || 'audio/webm' } }, 
            { text: prompt }
          ] 
        },
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || '{}');
      setProcessedResult({
        title: result.title || (lang === 'ar' ? "ملاحظة ذكية جديدة" : "New Smart Note"),
        text: result.text || (lang === 'ar' ? "لم يتم استخراج نص واضح." : "No clear text extracted."),
        translation: result.translation
      });
    } catch (e) { 
      console.error(e);
      alert(lang === 'ar' ? "فشل التحويل الذكي، يرجى المحاولة مرة أخرى." : "AI conversion failed."); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleManualTranslate = async (note: Note) => {
    if (note.translation) return;
    setTranslatingId(note.id);
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Translate the following Arabic educational note into clear, professional English:\n\n${note.text}\n\nReturn ONLY the translated text.`;
      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      
      const translation = res.text || "";
      const updatedNotes = notes.map(n => n.id === note.id ? { ...n, translation } : n);
      setNotes(updatedNotes);
      await db.saveNote({ ...note, translation });
    } catch (e) {
      alert(lang === 'ar' ? "فشلت الترجمة" : "Translation failed");
    } finally {
      setTranslatingId(null);
    }
  };

  const saveFinalNote = async (cat: string) => {
    if (!processedResult) return;
    try {
      const updated = await db.saveNote({
        title: processedResult.title,
        text: processedResult.text,
        translation: processedResult.translation || '',
        category: cat,
        date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')
      });
      setNotes(updated);
      setIsModalOpen(false);
      setAudioBlob(null);
      setProcessedResult(null);
    } catch (e) {
      alert(lang === 'ar' ? "خطأ في حفظ الملاحظة" : "Error saving note");
    }
  };

  const speakNote = async (text: string) => {
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `اقرأ الملاحظة بوضوح: ${text}` }] }],
        config: { 
          responseModalities: [Modality.AUDIO], 
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } 
        },
      });
      const audioData = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const buf = await decodeAudioData(decodeBase64(audioData), ctx, 24000, 1);
        const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); s.start();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteNote = async (id: number) => {
    const updated = await db.deleteNote(id);
    setNotes(updated);
  };

  const filteredNotes = (notes || []).filter(n => 
    (selectedCategory === t.notes_all || n.category === selectedCategory) && 
    (n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className={`h-[calc(100vh-12rem)] flex flex-col md:flex-row gap-10 animate-in fade-in duration-500 ${lang === 'ar' ? 'rtl' : 'ltr'} font-cairo`}>
      <aside className="w-full md:w-80 flex flex-col space-y-6 shrink-0">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800">
          <div className="relative mb-8">
            <Search className={`absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t.notes_search} className="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl py-4 pr-12 pl-4 text-xs font-bold border-none dark:text-white focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="space-y-2">
            <button onClick={() => setSelectedCategory(t.notes_all)} className={`w-full px-6 py-4 rounded-2xl font-black text-sm flex justify-between items-center transition-all ${selectedCategory === t.notes_all ? 'bg-indigo-600 text-white shadow-lg scale-[1.02]' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <span>{t.notes_all}</span>
              <Hash size={16} />
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`w-full px-6 py-4 rounded-2xl font-bold text-sm flex justify-between items-center transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow-lg scale-[1.02]' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <span>{cat}</span>
                <Tag size={16} />
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { setIsModalOpen(true); setAudioBlob(null); setProcessedResult(null); }} className="w-full py-10 rounded-[3rem] bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-2xl flex flex-col items-center gap-4 group transition-all hover:scale-[1.02] active:scale-95">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md group-hover:rotate-12 transition-transform shadow-inner">
            <Plus size={32} />
          </div>
          <span className="text-xl font-black">{t.notes_record_btn}</span>
        </button>
      </aside>

      <main className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2">
        {filteredNotes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-800 space-y-6 bg-white dark:bg-slate-900 rounded-[4rem] border-4 border-dashed border-slate-100 dark:border-slate-800 p-10 text-center">
            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <FileAudio size={64} className="opacity-20" />
            </div>
            <p className="text-2xl font-black opacity-30">{t.notes_empty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
            {filteredNotes.map(note => (
              <div key={note.id} className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] shadow-xl border border-slate-100 dark:border-slate-800 group hover:-translate-y-2 transition-all relative flex flex-col h-fit">
                <div className="flex justify-between items-start mb-6">
                  <span className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest">{note.category}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleManualTranslate(note)} disabled={translatingId === note.id} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${note.translation ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white'}`} title={lang === 'ar' ? "ترجمة للإنجليزية" : "Translate"}>
                      {translatingId === note.id ? <Loader2 size={18} className="animate-spin" /> : <Globe size={20} />}
                    </button>
                    <button onClick={() => speakNote(note.text)} className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl flex items-center justify-center hover:scale-110 transition-all shadow-sm" title={lang === 'ar' ? "استماع" : "Listen"}>
                      <Volume2 size={20} />
                    </button>
                    <button onClick={() => handleDeleteNote(note.id)} className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
                <h4 className="text-2xl font-black dark:text-white mb-6 flex items-center gap-4">
                  <Sparkles size={24} className="text-amber-500 shrink-0" />
                  <span className="truncate">{note.title}</span>
                </h4>
                
                <div className="space-y-4 flex-1 mb-6">
                  <div className="bg-slate-50/50 dark:bg-slate-800/50 p-6 rounded-3xl border dark:border-slate-700 shadow-inner">
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-bold text-sm whitespace-pre-wrap">{note.text}</p>
                  </div>
                  
                  {note.translation && (
                    <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-6 rounded-3xl border border-indigo-100/50 shadow-inner animate-in slide-in-from-top-2">
                      <p className="text-xs font-black text-indigo-400 mb-2 uppercase tracking-widest flex items-center gap-2">
                        <Globe size={12} /> English Translation
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium text-sm italic">{note.translation}</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t dark:border-slate-800 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-500" /> {lang === 'ar' ? `تم الحفظ في ${note.date}` : `Saved on ${note.date}`}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3.5rem] p-10 shadow-2xl relative animate-in zoom-in overflow-y-auto max-h-[90vh] custom-scrollbar">
              <button onClick={() => setIsModalOpen(false)} className={`absolute top-8 ${lang === 'ar' ? 'left-8' : 'right-8'} text-slate-400 hover:text-rose-500 transition-all p-2`}><X size={24} /></button>
              
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-4">
                  <Mic size={32} />
                </div>
                <h3 className="text-3xl font-black mb-2 dark:text-white">{t.notes_recording}</h3>
                <p className="text-slate-400 font-bold text-sm">{t.notes_recording_desc}</p>
              </div>

              {!processedResult ? (
                <div className="space-y-8">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-10 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center gap-6 relative overflow-hidden">
                    {isRecording && (
                      <div className="absolute inset-0 bg-rose-500/5 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 bg-rose-500/20 rounded-full animate-ping"></div>
                      </div>
                    )}
                    <div className="text-center z-10">
                      <div className={`text-5xl font-mono font-black mb-2 ${isRecording ? 'text-rose-600' : 'dark:text-white'}`}>
                        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                    <div className="flex gap-4 z-10">
                      {!isRecording ? (
                        <button onClick={startRecording} className="w-24 h-24 bg-indigo-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all">
                          <Mic size={40} />
                        </button>
                      ) : (
                        <button onClick={stopRecording} className="w-24 h-24 bg-rose-500 text-white rounded-[2.5rem] flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all">
                          <Square size={40} />
                        </button>
                      )}
                      <label className="w-24 h-24 bg-white dark:bg-slate-700 text-slate-600 dark:text-white rounded-[2.5rem] flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-all border border-slate-100">
                        <Upload size={40} />
                        <input type="file" className="hidden" accept="audio/*" onChange={e => { if(e.target.files?.[0]) { setAudioBlob(e.target.files[0]); } }} />
                      </label>
                    </div>
                    {audioBlob && (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 px-8 py-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-bottom-2">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white"><FileAudio size={20} /></div>
                        <div>
                          <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">{lang === 'ar' ? 'المقطع جاهز للتحليل' : 'Audio ready for analysis'}</p>
                          <p className="text-[10px] font-bold text-slate-400">{(audioBlob.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={handleAIConvert} 
                    disabled={!audioBlob || loading}
                    className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-4 hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" size={28} /> : <Wand2 size={28} />}
                    {t.notes_save_btn}
                  </button>
                </div>
              ) : (
                <div className="space-y-8 animate-in zoom-in">
                   <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-[3rem] border border-indigo-100 dark:border-slate-700">
                      <div className="flex items-center gap-3 mb-6 text-indigo-600">
                        <Globe size={24} className="animate-pulse" />
                        <h4 className="font-black text-xl">{lang === 'ar' ? 'المحتوى المستخرج والمترجم' : 'Extracted Content'}</h4>
                      </div>
                      <div className="space-y-4">
                        <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl border-r-4 border-indigo-500">
                          <p className="text-xs font-black text-slate-400 mb-1 uppercase">{lang === 'ar' ? 'العنوان المقترح' : 'Suggested Title'}</p>
                          <p className="font-black text-lg dark:text-white">{processedResult.title}</p>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl">
                          <p className="text-xs font-black text-slate-400 mb-1 uppercase">{lang === 'ar' ? 'النص العربي والملخص' : 'Arabic Text & Summary'}</p>
                          <p className="font-bold text-sm leading-relaxed dark:text-slate-200">{processedResult.text}</p>
                        </div>
                        {processedResult.translation && (
                          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100">
                            <p className="text-xs font-black text-indigo-400 mb-1 uppercase tracking-widest">English Translation</p>
                            <p className="font-medium text-sm leading-relaxed dark:text-slate-300 italic">{processedResult.translation}</p>
                          </div>
                        )}
                      </div>
                   </div>

                   <div className="space-y-4">
                      <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'اختر تصنيفاً لحفظ الملاحظة' : 'Select Category'}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {categories.map(cat => (
                          <button key={cat} onClick={() => saveFinalNote(cat)} className="py-4 bg-white dark:bg-slate-800 border-2 border-indigo-50 dark:border-slate-700 hover:border-indigo-600 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-sm">
                            <Tag size={14} className="text-indigo-500" /> {cat}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setProcessedResult(null)} className="w-full py-4 text-slate-400 font-bold text-sm hover:text-rose-500 transition-colors">{lang === 'ar' ? 'إعادة المحاولة / مسح' : 'Retry / Clear'}</button>
                   </div>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};
