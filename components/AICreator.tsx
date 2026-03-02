
import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Presentation, Download, Wand2, Loader2,
  Upload, CheckCircle2, FileUp, ImageIcon,
  ArrowRight, ArrowLeft, Image as LucideImage,
  FileDown, X
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import PptxGenJS from 'pptxgenjs';
import { translations } from '../i18n';
import { db } from '../services/db';

interface Slide {
  title: string;
  content: string[];
  imagePrompt: string;
  imageUrl?: string;
}

interface PresentationProject {
  title: string;
  slides: Slide[];
  detectedLanguage: 'ar' | 'en';
}

export const AICreator: React.FC<{ lang?: 'ar' | 'en' }> = ({ lang = 'ar' }) => {
  const t = translations[lang];
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [generationStep, setGenerationStep] = useState<'idle' | 'text' | 'images' | 'completed'>('idle');
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [project, setProject] = useState<PresentationProject | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [showSavedModal, setShowSavedModal] = useState(false);
  
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  useEffect(() => {
    db.getPresentations().then(p => setSavedProjects(p));
    if (!(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingFile(true);
    setFileName(file.name);
    try {
      if (file.type === 'application/pdf') {
        const pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) throw new Error("PDF.js not loaded");
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((it: any) => it.str).join(' ') + '\n';
        }
        setFileContent(fullText);
      } else {
        const text = await file.text();
        setFileContent(text);
      }
    } catch (err) { 
      alert("خطأ في معالجة الملف."); 
    } finally { 
      setIsProcessingFile(false); 
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim() && !fileContent) return alert("يرجى إدخال عنوان أو رفع ملف مرجعي.");
    setLoading(true);
    setGenerationStep('text');
    
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `أنت خبير في تصميم العروض التقديمية التعليمية الاحترافية.
      قم بإنشاء محتوى عرض تقديمي جذاب بناءً على الموضوع التالي: "${topic || 'الملف المرفق'}". 
      
      المحتوى المرجعي: ${fileContent?.substring(0, 10000) || 'لا يوجد، اعتمد على معلوماتك العامة.'}
      
      **قواعد هامة جداً**:
      1. عدد الشرائح المطلوبة: ${slideCount}.
      2. كشف اللغة التلقائي: إذا كان العنوان أو الملف المرفوع بالإنجليزية، اجعل كامل محتوى العرض بالإنجليزية. إذا كان بالعربية اجعله بالعربية.
      3. لا تخلط اللغتين في الشريحة الواحدة.
      
      يجب أن يكون الرد JSON فقط بهذا التنسيق:
      {
        "detectedLanguage": "ar" أو "en",
        "slides": [
          {
            "title": "عنوان الشريحة",
            "content": ["نقطة 1", "نقطة 2", "نقطة 3"],
            "imagePrompt": "Detailed descriptive English prompt for a professional educational visual, cinematic style, 4k, strictly no text on image"
          }
        ]
      }`;

      const textRes = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(textRes.text || '{}');
      const rawSlides: Slide[] = data.slides || [];
      const detectedLang = data.detectedLanguage || (lang === 'ar' ? 'ar' : 'en');
      
      setGenerationStep('images');
      const finalSlides: Slide[] = [];

      for (let i = 0; i < rawSlides.length; i++) {
        setCurrentImgIndex(i + 1);
        const slide = rawSlides[i];
        try {
          const imgRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: `High quality educational visualization, 4k, professional photography style, no text: ${slide.imagePrompt}` }] },
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
          finalSlides.push({ ...slide, imageUrl: b64 });
        } catch (e) {
          console.error("Error slide image", i, e);
          finalSlides.push(slide);
        }
      }

      const finalProject: PresentationProject = { 
        title: topic || fileName || "Presentation", 
        slides: finalSlides, 
        detectedLanguage: detectedLang 
      };
      setProject(finalProject);
      await db.savePresentation(finalProject.title, finalProject.slides, finalProject.detectedLanguage);
      db.getPresentations().then(p => setSavedProjects(p));
      setGenerationStep('completed');
    } catch (e) {
      alert("فشل في توليد العرض التقديمي.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPPTX = () => {
    if (!project) return;
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    project.slides.forEach((slide) => {
      const s = pptx.addSlide();
      const isAr = project.detectedLanguage === 'ar';
      
      // Text Background (Left half)
      s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '50%', h: '100%',
        fill: { color: '0F172A' }
      });

      // Slide Image (Right half)
      if (slide.imageUrl) {
        // Fix: Added missing w and h to sizing property to satisfy type requirements
        s.addImage({
          data: slide.imageUrl,
          x: 5, y: 0, w: 5, h: 5.625,
          sizing: { type: 'cover', w: 5, h: 5.625 }
        });
      }

      // Title & Content on the Left
      s.addText(slide.title, {
        x: 0.4, y: 0.8, w: 4.2, h: 1,
        fontSize: 28, color: 'FFFFFF', bold: true, align: isAr ? 'right' : 'left', fontFace: 'Arial'
      });

      slide.content.forEach((text, idx) => {
        s.addText(text, {
          x: 0.4, y: 2.2 + (idx * 0.6), w: 4.2, h: 0.5,
          fontSize: 16, color: 'CBD5E1', align: isAr ? 'right' : 'left', fontFace: 'Arial',
          // Fix: Removed unsupported 'color' property from bullet object
          bullet: { type: 'bullet' }
        });
      });
    });

    pptx.writeFile({ fileName: `${project.title}.pptx` });
  };

  const handleDownloadPDF = () => {
    if (!project) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isAr = project.detectedLanguage === 'ar';

    const slidesHtml = project.slides.map((slide, i) => `
      <div class="slide" style="display: flex; width: 100vw; height: 100vh; overflow: hidden; background: #0f172a; page-break-after: always; flex-direction: row;">
        <!-- Left half: Text -->
        <div style="width: 50%; padding: 60px; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box; text-align: ${isAr ? 'right' : 'left'};">
          <h2 style="color: #ffffff; font-size: 34pt; margin-bottom: 35px; border-${isAr ? 'right' : 'left'}: 8px solid #6366f1; padding-${isAr ? 'right' : 'left'}: 25px; line-height: 1.2; font-weight: 900;">${slide.title}</h2>
          <ul style="list-style-type: none; padding: 0; margin: 0; direction: ${isAr ? 'rtl' : 'ltr'};">
            ${slide.content.map(point => `
              <li style="font-size: 20pt; margin-bottom: 22px; color: #cbd5e1; display: flex; align-items: flex-start; gap: 15px; font-weight: 700;">
                <span style="color: #818cf8;">•</span>
                ${point}
              </li>
            `).join('')}
          </ul>
          <div style="margin-top: auto; color: #475569; font-size: 11pt; font-weight: bold; text-transform: uppercase;">
             ${project.title} | ${i + 1}
          </div>
        </div>

        <!-- Right half: Full Image -->
        <div style="width: 50%; height: 100%; position: relative;">
          ${slide.imageUrl ? `<img src="${slide.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<div style="width: 100%; height: 100%; background: #1e293b;"></div>`}
          <div style="position: absolute; inset: 0; box-shadow: inset 60px 0 100px rgba(15,23,42,0.6);"></div>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <html dir="${isAr ? 'rtl' : 'ltr'}">
        <head>
          <title>${project.title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: landscape; margin: 0; }
            body { margin: 0; padding: 0; font-family: 'Cairo', sans-serif; background: #000; overflow: hidden; }
            .no-print { position: fixed; top: 20px; right: 20px; z-index: 999; }
            button { background: #6366f1; color: white; border: none; padding: 15px 30px; border-radius: 12px; font-weight: 900; font-size: 16px; cursor: pointer; box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">${isAr ? 'حفظ بصيغة PDF' : 'Save as PDF'}</button>
          </div>
          ${slidesHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className={`flex flex-col space-y-10 animate-in fade-in duration-700 font-cairo pb-32 ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 space-y-8 relative overflow-hidden">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl mx-auto mb-4">
            <Presentation size={36} />
          </div>
          <h2 className="text-3xl font-black dark:text-white leading-tight">{t.creator_title}</h2>
          <p className="text-slate-500 font-bold text-sm">{t.creator_desc}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-6 space-y-2">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">{t.creator_topic_label}</label>
             <input value={topic} onChange={e => setTopic(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-base font-black focus:ring-4 focus:ring-indigo-100 border-none dark:text-white transition-all" placeholder={lang === 'ar' ? 'اكتب الموضوع أو ارفع ملفاً...' : 'Enter topic or upload file...'} />
          </div>
          <div className="lg:col-span-2 space-y-2">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">{t.creator_slides_label}</label>
             <input type="number" min="1" max="25" value={slideCount} onChange={e => setSlideCount(Math.max(1, parseInt(e.target.value) || 10))} className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center text-xl font-black focus:ring-4 focus:ring-indigo-100 border-none dark:text-white transition-all" />
          </div>
          <div className="lg:col-span-4 flex gap-2">
            <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-dashed font-black text-[10px] cursor-pointer transition-all ${fileContent ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 hover:border-indigo-400 text-slate-400'}`}>
               {isProcessingFile ? <Loader2 className="animate-spin" /> : fileContent ? <CheckCircle2 /> : <FileUp />}
               <span className="truncate">{fileContent ? fileName : t.creator_upload_label}</span>
               <input type="file" className="hidden" accept=".pdf,.txt" onChange={handleFileUpload} />
            </label>
            <button onClick={handleGenerate} disabled={loading || isProcessingFile} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" /> : <Wand2 size={18} />} {t.creator_btn}
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <button 
            onClick={() => setShowSavedModal(true)}
            className="flex items-center gap-2 text-indigo-600 font-black text-xs hover:underline"
          >
            <Presentation size={14} /> عرض العروض المحفوظة ({savedProjects.length})
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-in fade-in">
           <div className="relative">
              <div className="w-32 h-32 border-[10px] border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin shadow-xl"></div>
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse" size={24} />
           </div>
           <div className="text-center">
              <h3 className="text-xl font-black dark:text-white mb-2">
                {generationStep === 'text' ? (lang === 'ar' ? 'جاري كشف اللغة وتوليد المحتوى...' : 'Detecting language & writing content...') : (lang === 'ar' ? `جاري رسم الشريحة ${currentImgIndex}...` : `Drawing slide ${currentImgIndex}...`)}
              </h3>
           </div>
        </div>
      )}

      {project && !loading && (
        <div className="space-y-6 animate-in zoom-in duration-700">
           <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-xl border border-slate-100">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black">{activeSlide + 1}</div>
                 <h3 className="font-black text-sm dark:text-white truncate max-w-md">{project.slides[activeSlide].title}</h3>
                 <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-full uppercase tracking-widest">{project.detectedLanguage} Mode</span>
              </div>
              <div className="flex gap-2">
                 <button onClick={handleDownloadPDF} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] shadow-lg flex items-center gap-2 transition-all"><FileDown size={14} /> تصدير (PDF)</button>
                 <button onClick={handleDownloadPPTX} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] shadow-lg flex items-center gap-2 transition-all"><Download size={14} /> تصدير (PPTX)</button>
                 <button onClick={() => setProject(null)} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><X size={16} /></button>
              </div>
           </div>

           <div className="bg-slate-950 rounded-[4rem] aspect-video relative overflow-hidden group shadow-2xl border-4 border-white/5">
              {project.slides.map((slide, i) => (
                <div key={i} className={`absolute inset-0 transition-all duration-1000 ${activeSlide === i ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'}`}>
                   <div className="flex h-full flex-row">
                      {/* Left: Content */}
                      <div className="w-1/2 p-10 md:p-16 flex flex-col justify-center bg-slate-900 shadow-2xl z-10">
                         <h3 className={`text-2xl md:text-4xl font-black text-white mb-8 border-indigo-600 leading-tight ${project.detectedLanguage === 'ar' ? 'border-r-8 pr-6 text-right' : 'border-l-8 pl-6 text-left'}`}>
                           {slide.title}
                         </h3>
                         <ul className={`space-y-4 ${project.detectedLanguage === 'ar' ? 'text-right' : 'text-left'}`}>
                            {slide.content.map((p, pi) => (
                              <li key={pi} className="text-sm md:text-lg text-slate-300 font-bold flex items-start gap-4">
                                <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full mt-2.5 shrink-0 shadow-[0_0_15px_rgba(79,70,229,0.8)]"></div>
                                {p}
                              </li>
                            ))}
                         </ul>
                      </div>
                      {/* Right: Full Visual */}
                      <div className="w-1/2 relative overflow-hidden bg-slate-800">
                        {slide.imageUrl ? (
                          <img src={slide.imageUrl} className="w-full h-full object-cover" alt="Slide Visual" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                             <LucideImage size={80} className="text-slate-700 animate-pulse" />
                          </div>
                        )}
                        <div className="absolute inset-0 shadow-[inset_80px_0_120px_rgba(15,23,42,0.4)]"></div>
                      </div>
                   </div>
                </div>
              ))}

              <div className={`absolute inset-y-0 ${lang === 'ar' ? 'left-0' : 'right-0'} w-24 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20`}>
                <button onClick={() => setActiveSlide(s => Math.min(project.slides.length - 1, s + 1))} className="w-14 h-14 bg-white/10 hover:bg-indigo-600 text-white rounded-full backdrop-blur-xl transition-all active:scale-90 border border-white/10 flex items-center justify-center shadow-2xl"><ArrowLeft size={28} /></button>
              </div>
              <div className={`absolute inset-y-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-24 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20`}>
                <button onClick={() => setActiveSlide(s => Math.max(0, s - 1))} className="w-14 h-14 bg-white/10 hover:bg-indigo-600 text-white rounded-full backdrop-blur-xl transition-all active:scale-90 border border-white/10 flex items-center justify-center shadow-2xl"><ArrowRight size={28} /></button>
              </div>
           </div>
        </div>
      )}

      {showSavedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[4rem] p-12 shadow-2xl relative animate-in zoom-in border-4 border-white/10">
            <button onClick={() => setShowSavedModal(false)} className="absolute top-12 left-12 p-3 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"><X size={32} /></button>
            <div className="text-center mb-12">
              <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Presentation size={48} />
              </div>
              <h3 className="text-4xl font-black dark:text-white">العروض المحفوظة</h3>
            </div>
            <div className="max-h-[450px] overflow-y-auto space-y-4 custom-scrollbar">
              {savedProjects.length === 0 ? (
                <p className="text-center text-slate-400 font-bold py-10">لا توجد عروض محفوظة بعد.</p>
              ) : savedProjects.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => {
                    setProject({
                      title: p.title,
                      slides: p.slides,
                      detectedLanguage: p.lang
                    });
                    setShowSavedModal(false);
                  }}
                  className="w-full flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-transparent hover:border-indigo-500 transition-all shadow-md text-right group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm">
                      <Presentation size={28} />
                    </div>
                    <div>
                      <span className="font-black text-lg dark:text-white block">{p.title}</span>
                      <span className="text-[10px] text-slate-400 font-bold">{new Date(p.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">
                    <ArrowRight size={24} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
