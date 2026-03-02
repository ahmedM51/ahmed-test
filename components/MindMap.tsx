
import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, Sparkles, Download, ZoomIn, ZoomOut, Move, 
  Upload, X, FileUp, FileText, Image as ImageIcon, Loader2,
  RefreshCcw, Camera, FileDown, FileBox
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { db } from '../services/db';
import PptxGenJS from 'pptxgenjs';

export const MindMap: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapData, setMapData] = useState<any>(null);
  const [zoom, setZoom] = useState(1);
  
  // File Upload States
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | 'text' | null>(null);
  const [fileName, setFileName] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const [savedMaps, setSavedMaps] = useState<any[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    const loadSaved = async () => {
      const maps = await db.getMindMaps();
      setSavedMaps(maps);
    };
    loadSaved();

    if (!(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
  }, []);

  const generateMap = async () => {
    if (!topic.trim() && !fileContent) return alert("يرجى إدخال موضوع أو رفع ملف أولاً");
    
    setLoading(true);
    setZoom(1); 
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    
    try {
      let contents: any = [];
      if (fileType === 'image' && fileContent) {
        contents = {
          parts: [
            { inlineData: { data: fileContent.split(',')[1], mimeType: 'image/png' } },
            { text: `قم بإنشاء خريطة ذهنية هيكلية JSON بناءً على هذه الصورة. الموضوع: ${topic || 'المحتوى المرفق'}. التنسيق: { "name": "العنوان الرئيسي", "children": [ { "name": "فرع1", "children": [] } ] }. أجب بالعربية وبالـ JSON فقط.` }
          ]
        };
      } else {
        const context = fileContent ? `سياق الملف المرفوع:\n${fileContent.substring(0, 15000)}` : "";
        contents = `قم بإنشاء خريطة ذهنية هيكلية JSON للموضوع: "${topic || 'تحليل ذكي'}". 
        ${context}
        التنسيق: { "name": "العنوان الرئيسي", "children": [ { "name": "فرع1", "children": [ {"name": "نقطة1"} ] } ] }. 
        أجب باللغة العربية وبالـ JSON فقط وبدون نصوص توضيحية خارج الـ JSON.`;
      }

      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(res.text || '{}');
      setMapData(data);
      
      // Save to Supabase
      await db.saveMindMap(topic || data.name || 'خريطة ذهنية', data);
      const maps = await db.getMindMaps();
      setSavedMaps(maps);
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء التوليد الذكي.");
    } finally {
      setLoading(false);
    }
  };

  const downloadAsImage = async () => {
    if (!canvasRef.current) return;
    const html2canvas = (window as any).html2canvas;
    if (!html2canvas) return alert("جاري تحميل محرك الصور...");

    try {
      setLoading(true);
      const originalTransform = canvasRef.current.style.transform;
      canvasRef.current.style.transform = 'scale(1)';
      
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      canvasRef.current.style.transform = originalTransform;

      const link = document.createElement('a');
      link.download = `Smart_MindMap_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      alert("فشل تصدير الصورة.");
    } finally {
      setLoading(false);
    }
  };

  const exportPPTX = async () => {
    if (!mapData) return;
    setLoading(true);
    try {
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';

      const slide = pptx.addSlide();
      slide.background = { color: 'FFFFFF' };

      slide.addText(mapData.name, {
        x: 0.5, y: 0.5, w: '90%', h: 1,
        fontSize: 28, color: '4f46e5', bold: true, align: 'center', fontFace: 'Arial'
      });

      const renderNodePPT = (node: any, level: number, startY: number): number => {
        slide.addText(node.name, {
            x: 0.5 + (level * 0.5), y: startY, w: '80%', h: 0.4,
            fontSize: 18 - (level * 2), color: '334155', bullet: level > 0, align: 'right'
        });
        let currentY = startY + 0.4;
        if (node.children) {
            node.children.forEach((child: any) => {
                currentY = renderNodePPT(child, level + 1, currentY);
            });
        }
        return currentY;
      };

      renderNodePPT(mapData, 0, 1.5);

      await pptx.writeFile({ fileName: `MindMap_${mapData.name}.pptx` });
    } catch (e) {
      alert("فشل تصدير ملف PowerPoint.");
    } finally {
      setLoading(false);
    }
  };

  const downloadAsPDF = () => {
    if (!mapData) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("يرجى تفعيل النوافذ المنبثقة.");

    const renderNodeHtml = (node: any, level = 0): string => {
      const childrenHtml = node.children && node.children.length > 0 ? `
        <div style="display: flex; gap: 20px; justify-content: center; margin-top: 30px;">
          ${node.children.map((child: any) => renderNodeHtml(child, level + 1)).join('')}
        </div>
      ` : '';
      const colors = ['#4f46e5', '#8b5cf6', '#3b82f6', '#10b981'];
      const color = colors[level % colors.length];

      return `
        <div style="display: flex; flex-direction: column; align-items: center; min-width: 140px;">
          <div style="background: ${color}; color: white; padding: 12px 24px; border-radius: 14px; font-weight: 900; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-size: ${Math.max(10, 16 - level * 2)}pt; text-align: center;">
            ${node.name}
          </div>
          ${childrenHtml}
        </div>
      `;
    };

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>Mind Map - ${mapData.name}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 50px; background: white; margin: 0; }
            .map-container { display: flex; justify-content: center; align-items: flex-start; padding-top: 30px; }
            h1 { text-align: center; color: #1e293b; margin-bottom: 50px; }
            @page { size: A3 landscape; margin: 10mm; }
            * { -webkit-print-color-adjust: exact; }
          </style>
        </head>
        <body>
          <h1>${mapData.name}</h1>
          <div class="map-container">${renderNodeHtml(mapData)}</div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 1200); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setFileName(file.name);
    try {
      if (file.type === 'application/pdf') {
        const pdfjs = (window as any).pdfjsLib;
        if (!pdfjs) {
            alert("مكتبة معالجة الـ PDF قيد التحميل، يرجى المحاولة بعد لحظات.");
            return;
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((it: any) => it.str).join(' ') + '\n';
        }
        setFileContent(fullText);
        setFileType('pdf');
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setFileContent(event.target?.result as string);
          setFileType('image');
        };
        reader.readAsDataURL(file);
      } else {
        const text = await file.text();
        setFileContent(text);
        setFileType('text');
      }
    } catch (err) {
      console.error(err);
      alert("فشل في استخراج البيانات من الملف.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const canvasRef = useRef<HTMLDivElement>(null);

  const Node: React.FC<{ item: any; level?: number }> = ({ item, level = 0 }) => (
    <div className="flex flex-col items-center">
      <div className={`px-6 py-3 rounded-2xl font-bold shadow-lg mb-8 text-white transition-all hover:scale-105 border-2 border-white/10 ${
        level === 0 ? 'bg-indigo-600 text-xl py-4 px-10' : 
        level === 1 ? 'bg-purple-500' : 
        level === 2 ? 'bg-blue-500' : 'bg-emerald-500 text-sm'
      }`}>
        {item.name}
      </div>
      {item.children && item.children.length > 0 && (
        <div className="flex gap-10 relative px-4">
          <div className="absolute top-[-32px] left-1/2 w-0.5 h-8 bg-slate-200 dark:bg-slate-700"></div>
          {item.children.map((child: any, i: number) => (
            <Node key={i} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in duration-500 font-cairo pb-32">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black dark:text-white flex items-center gap-3">
          <Brain className="text-indigo-600" size={32} /> الخرائط الذهنية الذكية
        </h2>
        <button 
          onClick={() => setShowSaved(!showSaved)}
          className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-indigo-50 transition-all"
        >
          <RefreshCcw size={16} /> {showSaved ? 'إخفاء المحفوظات' : 'عرض خرائطي'}
        </button>
      </div>

      {showSaved && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top duration-300">
          {savedMaps.map((m, i) => (
            <button 
              key={i} 
              onClick={() => { setMapData(m.data); setShowSaved(false); }}
              className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 text-right hover:border-indigo-500 transition-all group"
            >
              <p className="font-black dark:text-white group-hover:text-indigo-600">{m.title}</p>
              <p className="text-[10px] text-slate-400 mt-1">{new Date(m.created_at).toLocaleDateString('ar-EG')}</p>
            </button>
          ))}
          {savedMaps.length === 0 && <p className="col-span-3 text-center py-10 text-slate-400 font-bold">لا توجد خرائط محفوظة بعد</p>}
        </div>
      )}
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Brain className="absolute right-5 top-1/2 -translate-y-1/2 text-indigo-500" size={24} />
            <input 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="اكتب موضوعك أو ارفع ملفاً..."
              className="w-full pr-14 pl-6 py-5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl dark:text-white focus:ring-2 focus:ring-indigo-500 text-lg font-bold"
            />
          </div>
          <button 
            onClick={generateMap}
            disabled={loading || isProcessingFile}
            className="px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
            توليد الخريطة
          </button>
        </div>

        <div className="relative">
          {!fileContent ? (
            <label className={`w-full py-8 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-500 transition-all ${isProcessingFile ? 'opacity-50' : ''}`}>
              {isProcessingFile ? <Loader2 className="animate-spin text-indigo-500" /> : <Upload className="text-slate-400" />}
              <div className="text-center">
                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">رفع ملف (PDF / صورة / نص)</p>
                <input type="file" className="hidden" accept=".pdf,.txt,image/*" onChange={handleFileUpload} />
              </div>
            </label>
          ) : (
            <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-200">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                    {fileType === 'pdf' ? <FileText /> : fileType === 'image' ? <ImageIcon /> : <FileText />}
                  </div>
                  <div>
                    <p className="font-black text-sm dark:text-white truncate max-w-[200px]">{fileName}</p>
                    <p className="text-[10px] font-black text-indigo-500 uppercase">تم التحميل</p>
                  </div>
               </div>
               <button onClick={() => { setFileContent(null); setFileName(''); }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><X /></button>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-[600px] bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 relative flex flex-col overflow-hidden">
        {mapData ? (
          <div className="flex-1 overflow-auto p-20 flex items-start justify-center cursor-move no-scrollbar">
            <div 
              ref={canvasRef} 
              className="p-10 flex items-start justify-center origin-top transition-transform duration-200" 
              style={{ transform: `scale(${zoom})` }}
            >
              <Node item={mapData} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 py-32">
            <div className="w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-8">
              <Brain className="text-indigo-400 animate-pulse" size={64} />
            </div>
            <h3 className="text-2xl font-black dark:text-white">بوابة التخطيط البصري</h3>
            <p className="text-slate-500 max-sm font-bold">ابدأ الآن بتحويل أفكارك إلى خريطة ذهنية تفاعلية.</p>
          </div>
        )}

        <div className="absolute bottom-8 left-8 flex flex-col gap-3 z-30">
          <div className="flex flex-col bg-white dark:bg-slate-800 p-2 rounded-3xl shadow-2xl border dark:border-slate-700">
            <button onClick={() => setZoom(z => Math.min(2.5, z + 0.15))} className="p-4 text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all" title="تكبير"><ZoomIn size={24} /></button>
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} className="p-4 text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all border-y dark:border-slate-700" title="تصغير"><ZoomOut size={24} /></button>
            <button onClick={() => setZoom(1)} className="p-4 text-slate-500 hover:bg-slate-50 rounded-2xl transition-all" title="إعادة ضبط"><RefreshCcw size={24} /></button>
          </div>

          <div className="flex flex-col bg-indigo-600 p-2 rounded-3xl shadow-2xl">
            <button onClick={downloadAsImage} disabled={!mapData} className="p-4 text-white hover:bg-white/10 rounded-2xl transition-all disabled:opacity-50" title="تحميل كصورة"><Camera size={24} /></button>
            <button onClick={exportPPTX} disabled={!mapData} className="p-4 text-white hover:bg-white/10 rounded-2xl transition-all border-t border-white/10 disabled:opacity-50" title="تصدير PowerPoint"><FileBox size={24} /></button>
            <button onClick={downloadAsPDF} disabled={!mapData} className="p-4 text-white hover:bg-white/10 rounded-2xl transition-all border-t border-white/10 disabled:opacity-50" title="تصدير PDF"><FileDown size={24} /></button>
          </div>
        </div>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};
