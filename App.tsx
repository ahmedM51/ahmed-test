
import React, { useState, useEffect } from 'react';
import { User, PageId, Subject, Task, Note, StudyStats } from './types';
import { Auth } from './components/Auth';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { HelpBot } from './components/HelpBot';
import { Subjects } from './components/Subjects';
import { Timer } from './components/Timer';
import { AICreator } from './components/AICreator';
import { Blackboard } from './components/Blackboard';
import { Pricing } from './components/Pricing';
import { Planner } from './components/Planner';
import { MindMap } from './components/MindMap';
import { VoiceAssistant } from './components/VoiceAssistant';
import { ImageEditor } from './components/ImageEditor';
import { AIAssistant } from './components/AIAssistant';
import { MyNotes } from './components/MyNotes';
import { Privacy } from './components/Privacy';
import { TakeQuiz } from './components/TakeQuiz';
import { translations } from './i18n';
import { Sun, Moon, Languages, Search, User as UserIcon, Sparkles, GraduationCap } from 'lucide-react';
import { db, supabase } from './services/db';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentXP, setCurrentXP] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [sharedQuizId, setSharedQuizId] = useState<string | null>(null);
  
  const [lang, setLang] = useState<'ar' | 'en'>(() => {
    const saved = localStorage.getItem('lang');
    return (saved as 'ar' | 'en') || 'ar';
  });
  
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    const handleHashChange = () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      
      const qId = params.get('share') || params.get('q') || hashParams.get('share');
      if (qId) { 
        setSharedQuizId(qId); 
        setCurrentPage('take-quiz'); 
      }

      const roomId = params.get('room') || hashParams.get('room');
      if (roomId) { 
        setCurrentPage('blackboard'); 
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const initApp = async () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      
      const qId = params.get('share') || params.get('q') || hashParams.get('share');
      if (qId) { setSharedQuizId(qId); setCurrentPage('take-quiz'); }

      const roomId = params.get('room') || hashParams.get('room');
      if (roomId) { setCurrentPage('blackboard'); }

      // Initial session check
      const userData = await db.getUser();
      if (userData) {
        setUser(userData);
        setCurrentXP(userData.xp || 0);
      }
      setIsLoading(false);

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const u = await db.getUser();
          if (u) {
            setUser(u);
            setCurrentXP(u.xp || 0);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setCurrentXP(0);
        }
      });

      return () => subscription.unsubscribe();
    };
    initApp();

    const handleXPUpdate = (e: any) => setCurrentXP(e.detail);
    window.addEventListener('xp-updated', handleXPUpdate);
    return () => window.removeEventListener('xp-updated', handleXPUpdate);
  }, []);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const handleLogout = () => {
    db.signOut();
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
        <div className="relative">
          <div className="w-24 h-24 border-8 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
          <GraduationCap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse" size={32} />
        </div>
      </div>
    );
  }

  if (sharedQuizId && currentPage === 'take-quiz') {
    return <TakeQuiz quizId={sharedQuizId} lang={lang} />;
  }

  if (!user) {
    return (
      <Auth 
        onLogin={(u) => { db.saveUser(u); setUser(u); setCurrentXP(u.xp || 0); }} 
        lang={lang} setLang={setLang} isDark={isDark} setIsDark={setIsDark} 
      />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard user={{...user, xp: currentXP}} lang={lang} setPage={setCurrentPage} />;
      case 'subjects': return <Subjects lang={lang} />;
      case 'ai-assistant': return <AIAssistant lang={lang} />;
      case 'planner': return <Planner lang={lang} />;
      case 'timer': return <Timer lang={lang} />;
      case 'mindmap': return <MindMap />;
      case 'creator': return <AICreator lang={lang} />;
      case 'voice': return <VoiceAssistant lang={lang} />;
      case 'blackboard': return <Blackboard lang={lang} />;
      case 'editor': return <ImageEditor lang={lang} />;
      case 'mynotes': return <MyNotes lang={lang} />;
      case 'pricing': return <Pricing lang={lang} user={user} />;
      case 'privacy': return <Privacy lang={lang} />;
      default: return <Dashboard user={user} lang={lang} setPage={setCurrentPage} />;
    }
  };

  const t = translations[lang];

  return (
    <div className={`flex min-h-screen bg-slate-50 dark:bg-slate-950 font-cairo transition-all duration-500 selection:bg-indigo-500 selection:text-white`}>
      <Navigation currentPage={currentPage} setPage={setCurrentPage} lang={lang} onLogout={handleLogout} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header updated for maximum clarity in both modes */}
        <header className="h-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-10 md:px-12 z-40 transition-all duration-500">
          <div className="flex items-center gap-6 flex-1">
             <div className="relative w-full max-w-md hidden md:block group">
                <Search className={`absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors`} size={18} />
                <input 
                  type="text" 
                  placeholder={t.search_placeholder}
                  className={`w-full bg-slate-100 dark:bg-slate-800/50 ${lang === 'ar' ? 'pr-12 pl-6' : 'pl-12 pr-6'} py-2.5 rounded-2xl border border-transparent focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-800 outline-none dark:text-white font-bold transition-all text-sm shadow-inner`}
                />
             </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-xs hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition-all shadow-sm border border-transparent dark:border-slate-700 active:scale-95"
            >
              <Languages size={16} />
              <span className="hidden sm:inline">{lang === 'ar' ? 'English' : 'العربية'}</span>
            </button>

            <button 
              onClick={() => setIsDark(!isDark)}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-amber-600 dark:text-amber-400 transition-all shadow-sm border border-transparent dark:border-slate-700 hover:scale-110 active:scale-95 hover:bg-white dark:hover:bg-slate-700"
              aria-label="Toggle Dark Mode"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-800 py-1.5 pr-1.5 pl-4 rounded-2xl shadow-sm border border-transparent dark:border-slate-700 hover:border-indigo-500/30 transition-all">
               <div className="text-right leading-tight hidden sm:block">
                  <p className="text-xs font-black text-slate-900 dark:text-white">{user.full_name}</p>
                  <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center justify-end gap-1">
                    {currentXP} XP
                    <Sparkles size={8} className="text-amber-500 animate-pulse" />
                  </p>
               </div>
               <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                  <UserIcon size={18} />
               </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar bg-slate-50 dark:bg-slate-950 transition-all duration-500">
          <div className="max-w-[1600px] mx-auto animate-in">
            {renderPage()}
          </div>
        </main>
      </div>

      <HelpBot lang={lang} />
    </div>
  );
};

export default App;
