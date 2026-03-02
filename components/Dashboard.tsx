
import React, { useState, useEffect } from 'react';
import { User, PageId, Subject, Task } from '../types';
import { translations } from '../i18n';
import { 
  ChartLine, Calendar as CalendarIcon, Clock,
  Sparkles, ArrowUpRight, Zap, ListChecks,
  Target, GraduationCap, PlayCircle, Facebook, MessageCircle, Phone,
  ArrowRight, Brain, Timer, LayoutDashboard, Plus, Flame, Award,
  ArrowRightCircle, CheckCircle2, BookOpen, Layers, Star, TrendingUp
} from 'lucide-react';
import { db } from '../services/db';

interface DashboardProps {
  user: User;
  lang: 'ar' | 'en';
  setPage: (p: PageId) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, lang, setPage }) => {
  const t = translations[lang];
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    const loadInitialData = async () => {
      const [loadedTasks, loadedSubs] = await Promise.all([
        db.getTasks(),
        db.getSubjects()
      ]);
      setTasks(loadedTasks);
      setSubjects(loadedSubs);
      if (loadedSubs.length > 0) {
        const avg = loadedSubs.reduce((acc, curr) => acc + curr.progress, 0) / loadedSubs.length;
        setOverallProgress(Math.round(avg));
      }
    };
    loadInitialData();
  }, []);

  const quickActions = [
    { id: 'ai-assistant', label: lang === 'ar' ? 'المعلم الذكي' : 'AI Tutor', icon: Brain, color: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-500/20' },
    { id: 'timer', label: lang === 'ar' ? 'مؤقت التركيز' : 'Focus Timer', icon: Timer, color: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/20' },
    { id: 'mindmap', label: lang === 'ar' ? 'خريطة ذهنية' : 'Mind Map', icon: Layers, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20' },
    { id: 'creator', label: lang === 'ar' ? 'منشئ العروض' : 'Slide Creator', icon: LayoutDashboard, color: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/20' },
  ];

  const pendingTasks = tasks.filter(t => t.status !== 'completed').length;

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-20">
      
      {/* Premium Hero Section */}
      <section className="relative overflow-hidden bg-slate-900 dark:bg-slate-900 rounded-[3.5rem] p-10 md:p-16 text-white shadow-2xl border border-white/5 group">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-indigo-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-purple-600/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full shadow-xl">
              <Sparkles size={16} className="text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">{lang === 'ar' ? 'نظام التعلم الذكي نشط' : 'Smart Learning Active'}</span>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-5xl md:text-7xl font-black leading-tight tracking-tighter">
                {lang === 'ar' ? 'أهلاً بك،' : 'Hello,'} <br/> 
                <span className="bg-gradient-to-r from-indigo-300 via-white to-purple-300 bg-clip-text text-transparent drop-shadow-sm">
                  {user.full_name.split(' ')[0]}
                </span>
              </h2>
              <p className="text-slate-300 text-xl font-bold leading-relaxed max-w-xl opacity-80">
                {lang === 'ar' 
                  ? 'يوم دراسي جديد يعني فرصة جديدة للتميز. المخطط الذكي جاهز لمساعدتك.' 
                  : 'A new study day is a new chance to excel. Your Smart Planner is ready.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <button onClick={() => setPage('planner')} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-base flex items-center gap-3 hover:bg-indigo-700 hover:scale-105 transition-all shadow-xl shadow-indigo-500/20 group">
                {lang === 'ar' ? 'ابدأ خطتك اليوم' : 'Start Today\'s Plan'} 
                <ArrowRightCircle size={24} className={`${lang === 'ar' ? 'rotate-180' : ''} group-hover:translate-x-1 transition-transform`} />
              </button>
              <button onClick={() => setPage('voice')} className="px-8 py-4 bg-white/5 backdrop-blur-xl text-white rounded-2xl font-black text-base border border-white/10 hover:bg-white/10 transition-all flex items-center gap-3">
                {lang === 'ar' ? 'نقاش صوتي' : 'Voice AI'} <MessageCircle size={24} />
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative hidden lg:block">
            <div className="aspect-square bg-white/5 rounded-[4rem] p-3 backdrop-blur-3xl border border-white/10 shadow-2xl relative">
               <div className="w-full h-full rounded-[3.5rem] overflow-hidden relative border border-white/10">
                  <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-[4s]" alt="Education" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                  <div className="absolute bottom-8 left-0 right-0 text-center px-6">
                     <h4 className="text-2xl font-black">{lang === 'ar' ? 'قمة الإنجاز' : 'Peak Performance'}</h4>
                  </div>
               </div>
               <div className="absolute -top-4 -right-4 bg-white text-indigo-600 p-4 rounded-3xl shadow-2xl animate-bounce duration-[3s]">
                  <div className="text-center">
                    <p className="text-[8px] font-black uppercase text-slate-400">XP Points</p>
                    <p className="text-xl font-black">{user.xp}</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action, i) => (
              <button 
                key={i}
                onClick={() => setPage(action.id as PageId)}
                className={`flex flex-col items-center justify-center p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden`}
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${action.color} text-white flex items-center justify-center mb-4 shadow-lg ${action.shadow} group-hover:rotate-6 transition-transform`}>
                  <action.icon size={20} />
                </div>
                <span className="font-black text-[11px] dark:text-slate-100">{action.label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between group relative overflow-hidden transition-all">
               <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 dark:bg-indigo-900/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
               <div className="flex justify-between items-start mb-10">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 shadow-inner">
                    <CheckCircle2 size={24} />
                  </div>
                  <TrendingUp className="text-slate-200 dark:text-slate-700" size={24} />
               </div>
               <div>
                  <p className="text-5xl font-black text-slate-900 dark:text-white mb-2">{overallProgress}%</p>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{lang === 'ar' ? 'معدل الإنجاز العام' : 'Overall Progress'}</h3>
               </div>
            </div>

            <div className="bg-slate-900 dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl text-white flex flex-col justify-between relative overflow-hidden transition-all border border-white/5">
               <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-transparent"></div>
               <div className="flex justify-between items-start relative z-10 mb-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white backdrop-blur-lg">
                    <ListChecks size={24} />
                  </div>
                  <div className="px-3 py-1 bg-emerald-500 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg">
                    {lang === 'ar' ? 'مهام نشطة' : 'Active'}
                  </div>
               </div>
               <div className="relative z-10">
                  <p className="text-5xl font-black mb-2">{pendingTasks}</p>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{lang === 'ar' ? 'مهام متبقية' : 'Pending Tasks'}</h3>
               </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-all duration-1000"></div>
            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-black tracking-tight">{lang === 'ar' ? 'هدف اليوم' : 'Daily Goal'}</h4>
                <Star className="text-amber-300 fill-amber-300" size={18} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-black opacity-80 uppercase tracking-widest">
                  <span>{lang === 'ar' ? 'الإنجاز' : 'Completed'}</span>
                  <span>75%</span>
                </div>
                <div className="w-full h-2.5 bg-white/20 rounded-full p-0.5 shadow-inner">
                  <div className="h-full bg-white rounded-full shadow-lg transition-all duration-1000" style={{ width: '75%' }}></div>
                </div>
              </div>
              <p className="text-indigo-50 font-bold leading-relaxed italic text-sm">
                "{lang === 'ar' ? 'كل دقيقة مذاكرة الآن هي استثمار في مستقبلك الكبير.' : 'Study now for a brighter future.'}"
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 space-y-6 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600">
                <MessageCircle size={20} />
              </div>
              <h4 className="text-sm font-black dark:text-white">{lang === 'ar' ? 'الدعم الفني' : 'Technical Support'}</h4>
            </div>
            <div className="grid grid-cols-1 gap-3">
               <a href="https://wa.me/201025612869" target="_blank" className="w-full py-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-2xl font-black text-xs flex items-center justify-center gap-3 hover:bg-emerald-100 transition-all border border-emerald-100 dark:border-emerald-800/40">
                 WhatsApp
               </a>
               <a href="tel:01025612869" className="w-full py-4 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-xs flex items-center justify-center gap-3 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-700">
                 {lang === 'ar' ? 'اتصل بنا' : 'Call Center'}
               </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
