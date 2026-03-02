
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Brain, Trophy, TrendingUp, Zap, Clock, Settings, BookOpen, CheckCircle2, Coffee } from 'lucide-react';
import { db } from '../services/db';
import { Subject, StudyStats } from '../types';

export const Timer: React.FC<{ lang?: 'ar' | 'en' }> = ({ lang = 'ar' }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [studyMins, setStudyMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [isConfiguring, setIsConfiguring] = useState(true);

  const [seconds, setSeconds] = useState(studyMins * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'study' | 'break'>('study');
  
  const [stats, setStats] = useState<StudyStats>({ sessionsCompleted: 0, totalMinutes: 0, topSubject: 'غير محدد', focusRate: 0 });
  const [showSummary, setShowSummary] = useState(false);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    const loadData = async () => {
      const subs = await db.getSubjects();
      const st = await db.getStudyStats();
      setSubjects(subs);
      setStats(st);
    };
    loadData();
  }, []);

  const handleComplete = useCallback(async () => {
    setIsActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(() => {});

    if (mode === 'study') {
      const subName = subjects.find(s => s.id === selectedSubId)?.name || 'دراسة عامة';
      const newStats = await db.saveStudySession(studyMins, subName);
      setStats(newStats);
      setShowSummary(true);
      setMode('break');
      setSeconds(breakMins * 60);
    } else {
      setMode('study');
      setSeconds(studyMins * 60);
    }
  }, [mode, subjects, selectedSubId, studyMins, breakMins]);

  useEffect(() => {
    if (isActive && seconds > 0) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s - 1);
      }, 1000);
    } else if (seconds === 0 && isActive) {
      setTimeout(() => handleComplete(), 0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, seconds, handleComplete]);

  const startTimer = () => {
    if (!selectedSubId && mode === 'study') {
      alert(lang === 'ar' ? 'يرجى اختيار مادة للمذاكرة أولاً' : 'Please select a subject first');
      return;
    }
    setIsConfiguring(false);
    setIsActive(true);
    setSeconds(mode === 'study' ? studyMins * 60 : breakMins * 60);
  };

  const toggle = () => setIsActive(!isActive);
  const reset = () => {
    setIsActive(false);
    setSeconds(mode === 'study' ? studyMins * 60 : breakMins * 60);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sc = s % 60;
    return `${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
  };

  const activeSubject = subjects.find(s => s.id === selectedSubId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in zoom-in duration-500 pb-20">
      <div className="space-y-6">
        <h3 className="text-2xl font-black dark:text-white flex items-center gap-3">
          <TrendingUp className="text-indigo-600" />
          {lang === 'ar' ? 'إحصائيات المذاكرة' : 'Study Stats'}
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {[
            { label: 'الجلسات المكتملة', val: stats.sessionsCompleted, icon: Trophy, color: 'text-amber-500' },
            { label: 'إجمالي دقائق التركيز', val: `${Math.round(stats.totalMinutes)} دقيقة`, icon: Clock, color: 'text-indigo-500' },
            { label: 'المادة الأكثر دراسة', val: stats.topSubject, icon: BookOpen, color: 'text-rose-500' },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center gap-4 shadow-sm transition-all hover:scale-105">
              <div className={`w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center ${s.color}`}>
                <s.icon size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                <p className="text-lg font-black dark:text-white">{s.val}</p>
              </div>
            </div>
          ))}
        </div>

        {isActive && mode === 'study' && (
          <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden animate-pulse">
             <div className="relative z-10">
                <h4 className="font-black text-lg mb-1">جلسة تركيز نشطة:</h4>
                <p className="text-indigo-100 font-black text-2xl truncate">{activeSubject?.name || 'دراسة حرة'}</p>
             </div>
             <Brain className="absolute -bottom-4 -right-4 opacity-20 rotate-12" size={120} />
          </div>
        )}
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-12 rounded-[4rem] shadow-2xl border dark:border-slate-800 text-center flex flex-col items-center justify-center relative overflow-hidden">
        {isConfiguring ? (
          <div className="w-full max-w-md space-y-10 animate-in fade-in">
             <div className="space-y-4">
                <h3 className="text-3xl font-black dark:text-white">{lang === 'ar' ? 'إعداد جلسة المذاكرة' : 'Session Settings'}</h3>
                <p className="text-slate-500 font-bold">{lang === 'ar' ? 'حدد المادة والوقت المناسب لك' : 'Set your subject and time'}</p>
             </div>

             <div className="space-y-6 text-right">
                <div className="space-y-3">
                   <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">اختر المادة</label>
                   <select 
                    value={selectedSubId || ''} 
                    onChange={e => setSelectedSubId(Number(e.target.value))}
                    className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold dark:text-white focus:ring-2 focus:ring-indigo-500 appearance-none shadow-inner"
                   >
                      <option value="">{lang === 'ar' ? '-- اختر من موادك --' : '-- Select Subject --'}</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">وقت الدراسة (د)</label>
                      <input type="number" value={studyMins} onChange={e => setStudyMins(Number(e.target.value))} className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-black text-center text-3xl dark:text-white" />
                   </div>
                   <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">وقت الراحة (د)</label>
                      <input type="number" value={breakMins} onChange={e => setBreakMins(Number(e.target.value))} className="w-full p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-black text-center text-3xl dark:text-white" />
                   </div>
                </div>
             </div>

             <button onClick={startTimer} className="w-full py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4">
                <Play size={28} /> {lang === 'ar' ? 'ابدأ الجلسة' : 'Start Session'}
             </button>
          </div>
        ) : (
          <>
            <div className="flex gap-4 mb-12 p-2 bg-slate-100 dark:bg-slate-800 rounded-3xl">
              <button disabled className={`px-10 py-4 rounded-2xl font-black transition-all ${mode === 'study' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 opacity-50'}`}>مذاكرة</button>
              <button disabled className={`px-10 py-4 rounded-2xl font-black transition-all ${mode === 'break' ? 'bg-emerald-600 text-white shadow-xl' : 'text-slate-500 opacity-50'}`}>استراحة</button>
            </div>

            <div className="relative w-80 h-80 mb-12 flex items-center justify-center">
               <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  <circle cx="160" cy="160" r="140" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                  <circle cx="160" cy="160" r="140" stroke="currentColor" strokeWidth="12" fill="transparent" 
                    strokeDasharray={880}
                    strokeDashoffset={880 - (880 * seconds) / (mode === 'study' ? studyMins*60 : breakMins*60)}
                    className={`${mode === 'study' ? 'text-indigo-600' : 'text-emerald-500'} transition-all duration-1000 stroke-round`}
                  />
               </svg>
               <div className="flex flex-col items-center justify-center z-10">
                  <span className="text-7xl font-black dark:text-white tracking-tighter">{formatTime(seconds)}</span>
                  <span className="text-xs font-black uppercase text-slate-400 mt-2 tracking-[0.3em]">{mode === 'study' ? 'جلسة تركيز' : 'وقت الراحة'}</span>
               </div>
            </div>

            <div className="flex gap-6">
              <button onClick={() => setIsConfiguring(true)} className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center text-slate-500 hover:scale-105 transition-all shadow-sm"><Settings size={32} /></button>
              <button onClick={toggle} className={`w-28 h-28 ${isActive ? 'bg-rose-500 shadow-rose-200' : 'bg-indigo-600 shadow-indigo-200'} text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all`}>
                {isActive ? <Pause size={48} /> : <Play size={48} className="ml-2" />}
              </button>
              <button onClick={reset} className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center text-slate-500 hover:scale-105 transition-all shadow-sm"><RotateCcw size={32} /></button>
            </div>
          </>
        )}

        {showSummary && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in zoom-in">
             <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3.5rem] p-10 shadow-2xl text-center space-y-8 border-4 border-emerald-500/20">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-lg border-4 border-white">
                   <CheckCircle2 size={64} className="text-emerald-600" />
                </div>
                <div className="space-y-2">
                   <h2 className="text-3xl font-black">{lang === 'ar' ? 'إنجاز رائع!' : 'Great Work!'}</h2>
                   <p className="text-slate-500 font-bold">{lang === 'ar' ? 'لقد اكتسبت نقاط XP جديدة' : 'You earned new XP points'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl grid grid-cols-2 gap-4">
                   <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase">الوقت</p>
                      <p className="text-2xl font-black text-indigo-600">{studyMins} د</p>
                   </div>
                   <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase">المكافأة</p>
                      <p className="text-2xl font-black text-amber-500">+{studyMins} XP</p>
                   </div>
                </div>
                <button onClick={() => setShowSummary(false)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:scale-105 transition-all">استمر في النجاح</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
