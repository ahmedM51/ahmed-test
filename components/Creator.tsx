
import React, { useState } from 'react';
import { Sparkles, FileText, Download, Send, Loader2, Printer } from 'lucide-react';
import { getAIResponse } from '../services/geminiService';

export const Creator: React.FC<{ lang?: 'ar' | 'en' }> = ({ lang = 'ar' }) => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    const fullPrompt = `قم بإنشاء ملخص تعليمي شامل ومنظم عن: ${prompt}. استخدم العناوين، النقاط، وأمثلة توضيحية.`;
    const res = await getAIResponse(fullPrompt);
    setResult(res.text);
    setLoading(false);
  };

  const exportToPDF = () => {
    if (!result) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert(lang === 'ar' ? "يرجى تفعيل النوافذ المنبثقة." : "Please enable popups.");

    printWindow.document.write(`
      <html dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
        <head>
          <title>Smart Student - ${prompt}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 40px; background: #fff; color: #1e293b; line-height: 1.8; }
            .header { border-bottom: 4px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .header h1 { color: #4f46e5; margin: 0; font-size: 28px; font-weight: 900; }
            .content { white-space: pre-wrap; font-size: 16px; text-align: justify; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; font-weight: bold; }
            @media print { * { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>منصة الطالب الذكي - ملخص تعليمي</h1>
            <p style="margin-top: 10px; font-weight: bold;">الموضوع: ${prompt}</p>
          </div>
          <div class="content">${result}</div>
          <div class="footer">تم التوليد بواسطة الذكاء الاصطناعي - Smart Student Platform 2025</div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.addEventListener('afterprint', () => { window.close(); });
              }, 1000);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 font-cairo pb-20">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl">
           <Sparkles className="animate-pulse" size={40} />
        </div>
        <h2 className="text-4xl font-black dark:text-white flex items-center justify-center gap-4">
           منشئ المحتوى الذكي
        </h2>
        <p className="text-gray-500 text-lg font-medium">حول أي فكرة أو موضوع إلى ملخص تعليمي متكامل في ثوانٍ</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col md:flex-row gap-4">
          <input 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="مثال: قوانين نيوتن للحركة، تاريخ الدولة الأموية..."
            className="flex-1 px-8 py-5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl dark:text-white focus:ring-4 focus:ring-indigo-100 text-lg font-bold transition-all shadow-inner"
          />
          <button 
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Send size={24} />}
            توليد
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="flex justify-between items-center mb-10 pb-6 border-b dark:border-slate-800 relative z-10">
            <h3 className="text-2xl font-black dark:text-white flex items-center gap-3">
              <FileText className="text-indigo-600" /> المحتوى المولد
            </h3>
            <button 
              onClick={exportToPDF}
              className="px-6 py-3 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-xs hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2 group shadow-sm"
            >
              <Printer size={18} />
              تصدير PDF
            </button>
          </div>
          
          <div className="prose prose-indigo dark:prose-invert max-w-none whitespace-pre-wrap dark:text-gray-300 leading-loose text-lg font-bold relative z-10">
            {result}
          </div>
          
          <div className="mt-12 pt-8 border-t dark:border-slate-800 flex justify-center">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">تمت المراجعة بواسطة خوارزميات الطالب الذكي</p>
          </div>
        </div>
      )}
    </div>
  );
};
