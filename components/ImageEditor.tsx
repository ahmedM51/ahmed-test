
import React, { useState } from 'react';
import { 
  Image as ImageIcon, Wand2, Download, Upload, Trash2, 
  Loader2, Sparkles, AlertCircle, Printer, Layout, 
  Maximize2, Zap, RefreshCw, Palette, Binary, Save, History, X, ArrowRight
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { db } from '../services/db';

const PRESETS = [
  { id: 'enhance', label: 'تحسين تلقائي', prompt: 'Enhance details, professional lighting, high resolution', icon: Sparkles },
  { id: 'anime', label: 'نمط أنمي', prompt: 'Convert to studio ghibli anime style, vibrant colors', icon: Palette },
  { id: 'bg', label: 'تغيير الخلفية', prompt: 'Change background to a clean professional office environment', icon: ImageIcon },
  { id: 'cinematic', label: 'إضاءة سينمائية', prompt: 'Cinematic lighting, 4k, realistic texture', icon: Zap },
];

export const ImageEditor: React.FC<{ lang?: 'ar' | 'en' }> = ({ lang = 'ar' }) => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16" | "3:4" | "4:3">("1:1");
  const [savedImages, setSavedImages] = useState<any[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    db.getAIImages().then(imgs => setSavedImages(imgs));
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setErrorMsg(lang === 'ar' ? "حجم الصورة كبير جداً. الحد الأقصى 4 ميجا." : "Image is too large. Max 4MB.");
        return;
      }
      setErrorMsg(null);
      const reader = new FileReader();
      reader.onload = () => {
        setSourceImage(reader.result as string);
        setResultImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const processAI = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim() && !sourceImage) return;
    
    setLoading(true);
    setErrorMsg(null);
    
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      let contents: any;
      
      // إذا كانت هناك صورة مرفوعة، نقوم بالتعديل (Edit)
      if (sourceImage) {
        const base64 = sourceImage.split(',')[1];
        contents = {
          parts: [
            { inlineData: { data: base64, mimeType: 'image/png' } },
            { text: `Modify this image: ${finalPrompt}. Maintain consistent objects but apply the requested changes. Return only the image.` }
          ],
        };
      } 
      // إذا لم تكن هناك صورة، نقوم بالتوليد (Generate)
      else {
        contents = {
          parts: [{ text: `Create a high-quality educational illustration: ${finalPrompt}. No text on image, professional style.` }]
        };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contents,
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
          }
        }
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        let found = false;
        for (const part of parts) {
          if (part.inlineData) {
            setResultImage(`data:image/png;base64,${part.inlineData.data}`);
            found = true;
            break;
          }
        }
        if (!found) setErrorMsg(lang === 'ar' ? "لم يقم AI بإرجاع صورة. حاول توضيح الوصف أكثر." : "No image returned. Try a clearer prompt.");
      }
    } catch (e: any) {
      console.error("Image AI Error:", e);
      setErrorMsg(lang === 'ar' ? "حدث خطأ أثناء المعالجة. تأكد من وضوح الطلب." : "Processing error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    const url = resultImage || sourceImage;
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `Smart_Student_Design_${Date.now()}.png`;
    link.click();
  };

  const handleSaveToCloud = async () => {
    const url = resultImage || sourceImage;
    if (!url) return;
    setIsSaving(true);
    try {
      await db.saveAIImage(url, prompt || "AI Generated Image");
      const imgs = await db.getAIImages();
      setSavedImages(imgs);
      alert(lang === 'ar' ? "تم حفظ الصورة في معرضك السحابي!" : "Image saved to cloud gallery!");
    } catch (e) {
      alert("فشل الحفظ.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 font-cairo pb-32 ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl">
             <ImageIcon size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black dark:text-white">مختبر التصميم الذكي</h2>
            <p className="text-slate-500 font-bold text-sm">توليد الصور من النصوص أو تعديل ملفاتك بالذكاء الاصطناعي</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowGallery(true)} className="flex items-center gap-2 px-6 py-4 bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-slate-700 text-indigo-600 rounded-2xl font-black text-xs hover:bg-indigo-50 transition-all shadow-sm">
            <History size={18} /> {lang === 'ar' ? 'المعرض السحابي' : 'Cloud Gallery'} ({savedImages.length})
          </button>
          <label className="flex items-center gap-2 px-8 py-4 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-2xl font-black cursor-pointer hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all shadow-sm dark:text-white group">
            <Upload size={20} className="group-hover:scale-110 transition-transform" /> 
            {lang === 'ar' ? 'رفع صورة للتعديل' : 'Upload to Edit'}
            <input type="file" className="hidden" onChange={handleUpload} accept="image/*" />
          </label>
          {(sourceImage || resultImage) && (
            <button onClick={() => {setSourceImage(null); setResultImage(null); setPrompt('');}} className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={24} /></button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800 p-6 rounded-3xl flex items-center gap-4 text-rose-800 dark:text-rose-400 animate-in slide-in-from-top-4">
          <AlertCircle size={32} />
          <p className="font-black">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Workspace Side */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[4rem] shadow-2xl border dark:border-slate-800 min-h-[600px] flex items-center justify-center relative overflow-hidden group">
             {/* Background Decoration */}
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-30"></div>

            {resultImage || sourceImage ? (
              <div className="relative z-10 w-full h-full p-8 flex items-center justify-center">
                <img 
                  src={resultImage || sourceImage!} 
                  className="max-w-full max-h-[500px] object-contain rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.2)] transition-all duration-500 group-hover:scale-[1.02]" 
                  alt="Result" 
                />
                {resultImage && (
                  <div className="absolute top-12 right-12 bg-emerald-500 text-white px-4 py-2 rounded-full font-black text-[10px] shadow-lg flex items-center gap-2 animate-bounce">
                    <CheckCircle2 size={14} /> تم التعديل بـ AI
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center opacity-20 relative z-10 p-12">
                <div className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Binary size={64} />
                </div>
                <h4 className="text-3xl font-black uppercase tracking-widest leading-relaxed">اكتب وصفاً أو ارفع صورة<br/>لبدء الإبداع التعليمي</h4>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
                <div className="relative">
                  <div className="w-40 h-40 border-[12px] border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin"></div>
                  <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500 animate-pulse" size={48} />
                </div>
                <p className="font-black text-2xl text-indigo-600 animate-pulse mt-8">AI يقوم بالرسم الآن...</p>
              </div>
            )}
          </div>

          <div className="bg-indigo-600 p-10 rounded-[3.5rem] shadow-2xl text-white flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
             <div>
                <h3 className="text-2xl font-black mb-2">جاهز للتصدير؟</h3>
                <p className="text-indigo-100 font-bold opacity-80">يمكنك تحميل الصورة بجودة عالية لاستخدامها في دروسك</p>
             </div>
             <div className="flex gap-4">
                <button onClick={handleSaveToCloud} disabled={isSaving || (!sourceImage && !resultImage)} className="px-10 py-5 bg-indigo-500 text-white rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3">
                   {isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} />} {lang === 'ar' ? 'حفظ في المعرض' : 'Save to Gallery'}
                </button>
                <button onClick={downloadImage} disabled={!sourceImage && !resultImage} className="px-10 py-5 bg-white text-indigo-600 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3">
                   <Download size={24} /> تحميل الصورة
                </button>
             </div>
          </div>
        </div>

        {/* Controls Side */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border dark:border-slate-800 space-y-8">
            <div>
              <h4 className="font-black text-lg mb-6 dark:text-white flex items-center gap-2">
                <Wand2 className="text-indigo-500" size={20} /> وصف التعديل أو الرسم
              </h4>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={sourceImage ? "ماذا تريد أن نغير في الصورة؟" : "صف الصورة التي تتخيلها للدرس..."}
                className="w-full p-6 bg-slate-50 dark:bg-slate-800 border-none rounded-3xl dark:text-white min-h-[160px] font-bold text-lg focus:ring-4 focus:ring-indigo-100 transition-all shadow-inner resize-none"
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-black text-xs uppercase text-slate-400 tracking-widest px-2">الأبعاد المفضلة</h4>
              <div className="grid grid-cols-3 gap-3">
                {(["1:1", "16:9", "9:16"] as const).map((ratio) => (
                  <button 
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`py-3 rounded-xl font-black text-xs border-2 transition-all ${aspectRatio === ratio ? 'bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-black text-xs uppercase text-slate-400 tracking-widest px-2">إجراءات سريعة</h4>
              <div className="grid grid-cols-2 gap-3">
                {PRESETS.map((preset) => (
                  <button 
                    key={preset.id}
                    onClick={() => processAI(preset.prompt)}
                    disabled={loading || (!sourceImage && preset.id === 'enhance')}
                    className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all text-right group disabled:opacity-30"
                  >
                    <div className="w-10 h-10 bg-white dark:bg-slate-700 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <preset.icon size={20} />
                    </div>
                    <span className="text-[11px] font-black">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={() => processAI()}
              disabled={loading || (!prompt.trim() && !sourceImage)}
              className="w-full py-7 bg-indigo-600 text-white rounded-[2rem] font-black text-2xl shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-4"
            >
              {loading ? <Loader2 className="animate-spin" size={32} /> : <Palette size={32} />}
              {sourceImage ? 'تطبيق بـ AI' : 'رسم بـ AI'}
            </button>
          </div>

          <div className="p-8 bg-amber-50 dark:bg-amber-900/10 rounded-[3rem] border border-amber-100 dark:border-amber-800/40">
             <h4 className="font-black text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                <Sparkles size={18} /> نصيحة تعليمية:
             </h4>
             <p className="text-xs font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
               استخدم هذا المحرر لتصميم صور توضيحية لدروسك، أو لتحويل صورك الشخصية لصور بروفايل أكاديمية متميزة.
             </p>
          </div>
        </div>
      </div>

      {showGallery && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[4rem] p-12 shadow-2xl relative animate-in zoom-in border-4 border-white/10">
            <button onClick={() => setShowGallery(false)} className="absolute top-12 left-12 p-3 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"><X size={32} /></button>
            <div className="text-center mb-12">
              <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                <History size={48} />
              </div>
              <h3 className="text-4xl font-black dark:text-white">معرض تصاميمك الذكية</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-6 p-4 custom-scrollbar">
              {savedImages.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-400 font-bold">لا توجد صور محفوظة بعد.</div>
              ) : savedImages.map(img => (
                <div key={img.id} className="group relative aspect-square bg-slate-100 dark:bg-slate-800 rounded-3xl overflow-hidden shadow-lg border-2 border-transparent hover:border-indigo-500 transition-all">
                  <img src={img.image_url} className="w-full h-full object-cover" alt="Saved" />
                  <div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-white text-[10px] font-bold mb-4 line-clamp-3">{img.prompt}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { setSourceImage(img.image_url); setShowGallery(false); }} className="p-2 bg-white text-indigo-600 rounded-lg shadow-lg hover:scale-110 transition-transform"><Wand2 size={16}/></button>
                      <button onClick={() => {
                        const link = document.createElement('a');
                        link.href = img.image_url;
                        link.download = `Saved_Design_${img.id}.png`;
                        link.click();
                      }} className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg hover:scale-110 transition-transform"><Download size={16}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// أيقونة مفقودة
const CheckCircle2 = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
);
