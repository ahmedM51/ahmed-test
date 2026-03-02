
import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Clock, Plus, Trash2, CheckCircle, Sparkles, 
  Wand2, Zap, AlertCircle, CalendarDays, List, Star, Loader2,
  X, CheckCircle2, Upload, FileText, ImageIcon
} from 'lucide-react';
import { db } from '../services/db';
import { Subject, Task } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

interface PlannerProps {
  lang?: 'ar' | 'en';
}

export const Planner: React.FC<PlannerProps> = ({ lang = 'ar' }) => {
  const [view, setView] = useState<'list' | 'calendar' | 'smart'>('list');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Direct File Ingest for Smart Planner
  const [plannerFileContent, setPlannerFileContent] = useState<string | null>(null);
  const [plannerFileName, setPlannerFileName] = useState('');
  const [isProcessingPlannerFile, setIsProcessingPlannerFile] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [newDuration, setNewDuration] = useState('ساعة واحدة');
  const [newTaskDay, setNewTaskDay] = useState(0);
  const [selectedLectureId, setSelectedLectureId] = useState<number | null>(null);

  const getWeekDays = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const dayNames = [
      { ar: 'السبت', en: 'Sat', idx: 6 },
      { ar: 'الأحد', en: 'Sun', idx: 0 },
      { ar: 'الاثنين', en: 'Mon', idx: 1 },
      { ar: 'الثلاثاء', en: 'Tue', idx: 2 },
      { ar: 'الأربعاء', en: 'Wed', idx: 3 },
      { ar: 'الخميس', en: 'Thu', idx: 4 },
      { ar: 'الجمعة', en: 'Fri', idx: 5 },
    ];

    return dayNames.map((day, i) => {
      const date = new Date();
      const diffToSaturday = (currentDay + 1) % 7;
      date.setDate(now.getDate() - diffToSaturday + i);
      return {
        ...day,
        date: date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' }),
        fullDate: date.toDateString(),
        isToday: date.toDateString() === now.toDateString(),
        originalIdx: i 
      };
    });
  };

  const weekDays = getWeekDays();
  const [selectedDayIdx, setSelectedDayIdx] = useState(
    weekDays.findIndex(d => d.isToday) !== -1 ? weekDays.findIndex(d => d.isToday) : 0
  );

  const [planDuration, setPlanDuration] = useState('أسبوع');
  const [dailyHours, setDailyHours] = useState(4);
  const [startTime, setStartTime] = useState('07:00');

  useEffect(() => {
    const loadPlannerData = async () => {
      const [t, s] = await Promise.all([db.getTasks(), db.getSubjects()]);
      setTasks(t);
      setSubjects(s);
    };
    loadPlannerData();
  }, []);

  const handlePlannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      alert(lang === 'ar' ? "الملف كبير جداً! الحد الأقصى هو 5 ميجابايت." : "File too large! Maximum size is 5MB.");
      return;
    }

    setIsProcessingPlannerFile(true);
    setPlannerFileName(file.name);
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
        setPlannerFileContent(fullText);
      } else {
        const text = await file.text();
        setPlannerFileContent(text);
      }
    } catch (err) {
      alert("فشل في معالجة الملف المرفوع للمخطط.");
    } finally {
      setIsProcessingPlannerFile(false);
    }
  };

  const handleGenerateSmartPlan = async () => {
    let contextData = "";
    if (plannerFileContent) {
      contextData = plannerFileContent;
    } else {
      const availableLectures = subjects.flatMap(s => 
        s.lectures.filter(l => !l.isCompleted).map(l => ({ 
          title: l.title, 
          subject: s.name, 
          color: s.color 
        }))
      );
      if (availableLectures.length === 0) {
        alert("يرجى رفع ملف 'Syllabus' أو إضافة محاضرات غير مكتملة أولاً ليتمكن المخطط الذكي من العمل.");
        return;
      }
      contextData = JSON.stringify(availableLectures);
    }

    setLoadingAI(true);
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `أنت أستاذ جامعي وخبير في تنظيم الوقت. قم بتحليل المحتوى التالي وتوليد خطة دراسية لـ ${planDuration} بمعدل ${dailyHours} ساعات يومياً تبدأ في ${startTime}.
      المحتوى المرجعي:
      ${contextData.substring(0, 15000)}
      
      المطلوب: توزيع المواضيع أو المحاضرات المذكورة في النص على أيام الأسبوع (0-6 حيث 0 هو السبت).
      
      يجب أن يكون الرد مصفوفة JSON فقط بهذا الهيكل:
      [
        {
          "title": "اسم المادة - اسم الموضوع",
          "time": "HH:MM",
          "duration": "ساعة ونصف مثلاً",
          "dayIndex": 0,
          "subjectColor": "bg-indigo-500" 
        }
      ]
      أجب بالـ JSON فقط.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const text = response.text || '[]';
      console.log("AI Planner Response:", text);
      
      let data;
      try {
        // Robust JSON extraction in case AI adds markdown
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        data = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        throw new Error("فشل في تحليل بيانات الجدول المستلمة من الذكاء الاصطناعي.");
      }

      if (Array.isArray(data)) {
        const updatedTasks = await db.saveBatchTasks(data);
        if (updatedTasks && updatedTasks.length > 0) {
          setTasks(updatedTasks);
          setView('list');
          setPlannerFileContent(null);
        } else {
          console.warn("Batch save returned empty tasks");
          // Try to fetch again just in case
          const freshTasks = await db.getTasks();
          setTasks(freshTasks);
        }
      }
    } catch (e: any) {
      console.error("Smart Plan Generation Error:", e);
      alert(e.message || "عذراً، حدث خطأ أثناء توليد الجدول.");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleAddTaskManually = async () => {
    if (!newTitle.trim() && !selectedLectureId) return;
    
    let finalTitle = newTitle;
    let finalColor = 'bg-indigo-500';
    
    if (selectedLectureId) {
      const subject = subjects.find(s => s.lectures.some(l => l.id === selectedLectureId));
      const lecture = subject?.lectures.find(l => l.id === selectedLectureId);
      if (lecture) {
        finalTitle = `${subject?.name}: ${lecture.title}`;
        finalColor = subject?.color || 'bg-indigo-500';
      }
    }

    const newTask = {
      title: finalTitle,
      time: newTime,
      duration: newDuration,
      dayIndex: newTaskDay,
      subjectColor: finalColor
    };
    const updated = await db.saveTask(newTask);
    if (updated && updated.length > 0) {
      setTasks(updated);
    } else {
      // If empty, try fetching again
      const fresh = await db.getTasks();
      setTasks(fresh);
    }
    setIsTaskModalOpen(false);
    setNewTitle('');
    setSelectedLectureId(null);
  };

  const handleToggleTask = async (id: number) => {
    const updated = await db.toggleTask(id);
    setTasks(updated);
  };

  const handleDeleteTask = async (id: number) => {
    const updated = await db.deleteTask(id);
    setTasks(updated);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 font-cairo">
      {/* Header */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <h2 className="text-4xl font-black dark:text-white flex items-center gap-4">
            <CalendarIcon className="text-indigo-600" size={36} /> المخطط الدراسي الذكي
          </h2>
          <div className="flex gap-2 mt-6 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-3xl w-fit border dark:border-slate-700">
            <button onClick={() => setView('list')} className={`px-8 py-3.5 rounded-2xl font-black flex items-center gap-3 transition-all ${view === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500'}`}><List size={20} /> قائمة المهام</button>
            <button onClick={() => setView('smart')} className={`px-8 py-3.5 rounded-2xl font-black flex items-center gap-3 transition-all ${view === 'smart' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500'}`}><Wand2 size={20} /> المخطط الذكي AI</button>
          </div>
        </div>
        <div className="bg-rose-500 p-8 rounded-[3rem] text-white shadow-2xl flex flex-col justify-between relative overflow-hidden group">
          <AlertCircle size={40} className="relative z-10" />
          <div className="relative z-10">
            <p className="text-5xl font-black">{tasks.filter(t => t.status !== 'completed').length}</p>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mt-1">مهمة متبقية</p>
          </div>
          <Zap className="absolute -bottom-6 -right-6 text-white/10 group-hover:scale-125 transition-transform" size={140} />
        </div>
      </div>

      {view === 'smart' ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-[4rem] border-4 border-indigo-500/10 shadow-2xl space-y-12 animate-in zoom-in">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl"><Sparkles size={40} /></div>
            <h3 className="text-4xl font-black dark:text-white leading-tight">صناعة الخطة من الملفات المرفوعة</h3>
            <p className="text-slate-500 font-bold text-lg max-w-2xl mx-auto">ارفع ملف الـ Syllabus الخاص بك أو أي ملف PDF يحتوي على مواضيع المنهج، وسأقوم بتحويله إلى جدول زمني متكامل.</p>
          </div>

          <div className="max-w-3xl mx-auto w-full">
            {!plannerFileContent ? (
               <label className={`w-full py-12 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-500 transition-all ${isProcessingPlannerFile ? 'opacity-50' : ''}`}>
                {isProcessingPlannerFile ? <Loader2 className="animate-spin text-indigo-500" /> : <Upload className="text-slate-400" size={40} />}
                <div className="text-center">
                  <p className="text-sm font-black text-slate-500 uppercase tracking-widest">رفع ملف المنهج (PDF / Syllabus / Image)</p>
                  <input type="file" className="hidden" accept=".pdf,.txt,image/*" onChange={handlePlannerFileUpload} />
                </div>
              </label>
            ) : (
              <div className="flex items-center justify-between p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-200 shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><FileText size={28} /></div>
                    <div>
                      <p className="font-black text-base dark:text-white">{plannerFileName}</p>
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">المحتوى جاهز لتحليل الجدول</p>
                    </div>
                 </div>
                 <button onClick={() => setPlannerFileContent(null)} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><X size={24} /></button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-right bg-slate-50 dark:bg-slate-800/50 p-10 rounded-[3rem] border dark:border-slate-700">
             <div className="space-y-4">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">معدل الدراسة اليومي</label>
              <input type="number" value={dailyHours} onChange={(e) => setDailyHours(parseInt(e.target.value))} className="w-full px-8 py-5 bg-white dark:bg-slate-800 rounded-2xl border-none font-black text-2xl dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">وقت البدء</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-8 py-5 bg-white dark:bg-slate-800 rounded-2xl border-none font-black text-2xl dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-4">
               <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">مدة الخطة</label>
               <select value={planDuration} onChange={(e) => setPlanDuration(e.target.value)} className="w-full px-8 py-5 bg-white dark:bg-slate-800 rounded-2xl border-none font-black text-lg dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500 appearance-none">
                <option value="أسبوع">هذا الأسبوع</option>
                <option value="شهر">خطة شهرية شاملة</option>
              </select>
            </div>
          </div>

          <button onClick={handleGenerateSmartPlan} disabled={loadingAI || isProcessingPlannerFile} className="w-full py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-2xl shadow-[0_20px_50px_rgba(79,70,229,0.3)] flex items-center justify-center gap-5 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50">
            {loadingAI ? <Loader2 className="animate-spin" size={32} /> : <Zap size={32} />}
            توليد الجدول الدراسي من ملفاتي
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-10">
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-4 mb-2">أيام الأسبوع</h4>
            {weekDays.map((day, idx) => (
              <button key={idx} onClick={() => setSelectedDayIdx(idx)} className={`w-full p-6 rounded-[2.5rem] border-4 flex flex-col items-start transition-all relative group ${selectedDayIdx === idx ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl scale-[1.02]' : 'bg-white dark:bg-slate-900 border-slate-50 dark:border-slate-800 text-slate-500 hover:border-indigo-100'}`}>
                {day.isToday && <span className={`absolute top-5 left-6 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${selectedDayIdx === idx ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'}`}>اليوم</span>}
                <span className="font-black text-2xl">{day.ar}</span>
                <span className="text-xs font-bold mt-1 opacity-60">{day.date}</span>
              </button>
            ))}
          </div>

          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-[4rem] p-12 shadow-2xl border border-slate-100 dark:border-slate-800 min-h-[650px] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="flex justify-between items-center mb-12 relative z-10">
              <div>
                <h4 className="text-3xl font-black dark:text-white">مهام {weekDays[selectedDayIdx].ar}</h4>
                <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">{tasks.filter(t => t.dayIndex === selectedDayIdx).length} مهام مجدولة</p>
              </div>
              <button 
                onClick={() => { 
                  setNewTaskDay(selectedDayIdx); 
                  setIsTaskModalOpen(true); 
                }} 
                className="w-16 h-16 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl hover:scale-110 transition-all active:scale-90"
              >
                <Plus size={32} />
              </button>
            </div>
            
            <div className="flex-1 space-y-6 relative z-10">
              {tasks.filter(t => t.dayIndex === selectedDayIdx).map(task => (
                <div key={task.id} className="group relative flex items-center gap-6 p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[3rem] border-2 border-transparent hover:border-indigo-100 transition-all shadow-sm">
                  <div className={`w-2.5 h-16 absolute right-0 top-1/2 -translate-y-1/2 ${task.subjectColor || 'bg-indigo-500'} rounded-r-full shadow-lg`}></div>
                  <button onClick={() => handleToggleTask(task.id)} className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all border-4 ${task.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-200 shadow-lg' : 'bg-white dark:bg-slate-700 border-slate-200 text-slate-200'}`}>
                    <CheckCircle size={28} />
                  </button>
                  <div className="flex-1 text-right">
                    <h5 className={`font-black text-xl transition-all ${task.status === 'completed' ? 'text-slate-400 line-through' : 'dark:text-white text-slate-800'}`}>{task.title}</h5>
                    <div className="flex gap-6 mt-2">
                       <span className="text-xs font-black text-slate-400 flex items-center gap-1.5"><Clock size={14} className="text-indigo-500" /> {task.time}</span>
                       <span className="text-xs font-black text-indigo-500 flex items-center gap-1.5"><Star size={14} /> {task.duration}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={20} /></button>
                </div>
              ))}
              {tasks.filter(t => t.dayIndex === selectedDayIdx).length === 0 && (
                <div className="py-24 text-center opacity-20 animate-in fade-in">
                  <CalendarDays size={100} className="mx-auto text-indigo-300" />
                  <p className="font-black text-2xl mt-6 uppercase tracking-widest">يوم هادئ، لا مهام بعد</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal إضافة مهمة يدوية */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[4rem] p-12 shadow-[0_50px_100px_rgba(0,0,0,0.3)] relative animate-in zoom-in font-cairo border-4 border-white/10" dir="rtl">
              <button onClick={() => setIsTaskModalOpen(false)} className="absolute top-10 left-10 text-slate-400 hover:text-rose-500 transition-all p-2"><X size={32} /></button>
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6"><CalendarIcon size={40} /></div>
                <h3 className="text-4xl font-black dark:text-white">إضافة مهمة جديدة</h3>
                <p className="text-slate-500 font-bold mt-2">حدد تفاصيل نشاطك الدراسي لليوم</p>
              </div>
              <div className="space-y-8">
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-[0.3em]">ربط بمحاضرة من موادك</label>
                   <select 
                     value={selectedLectureId || ''} 
                     onChange={e => {
                       const val = e.target.value;
                       setSelectedLectureId(val ? parseInt(val) : null);
                       if (val) {
                         const sub = subjects.find(s => s.lectures.some(l => l.id === parseInt(val)));
                         const lec = sub?.lectures.find(l => l.id === parseInt(val));
                         if (lec) setNewTitle(`${sub?.name}: ${lec.title}`);
                       }
                     }}
                     className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 rounded-3xl font-black text-lg border-none dark:text-white focus:ring-4 focus:ring-indigo-100 transition-all appearance-none"
                   >
                     <option value="">-- اختر محاضرة (اختياري) --</option>
                     {subjects.map(sub => (
                       <optgroup key={sub.id} label={sub.name}>
                         {sub.lectures.map(lec => (
                           <option key={lec.id} value={lec.id}>{lec.title}</option>
                         ))}
                       </optgroup>
                     ))}
                   </select>
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-[0.3em]">اسم المهمة</label>
                   <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="مثال: مراجعة الكيمياء العضوية" className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 rounded-3xl font-black text-lg border-none dark:text-white focus:ring-4 focus:ring-indigo-100 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-[0.3em]">وقت البدء</label>
                    <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 rounded-3xl border-none font-black text-xl dark:text-white shadow-inner" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-[0.3em]">اليوم</label>
                    <select value={newTaskDay} onChange={e => setNewTaskDay(parseInt(e.target.value))} className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 rounded-3xl border-none font-black text-lg dark:text-white appearance-none pr-10">
                      {weekDays.map((d, i) => <option key={i} value={i}>{d.ar}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase text-slate-400 px-2 tracking-[0.3em]">المدة المتوقعة</label>
                   <input value={newDuration} onChange={e => setNewDuration(e.target.value)} placeholder="مثال: ساعة ونصف" className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800 rounded-3xl font-black text-lg border-none dark:text-white shadow-inner" />
                </div>
                <button onClick={handleAddTaskManually} className="w-full py-7 bg-indigo-600 text-white rounded-[2.5rem] font-black text-2xl shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4 mt-4">
                  <CheckCircle2 size={28} /> حفظ المهمة
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
