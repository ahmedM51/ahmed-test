
import React from 'react';
import { 
  Home, BookOpen, Calendar, Clock, Brain, 
  Mic, PenTool, LayoutDashboard, Settings, 
  LogOut, Crown, Image as ImageIcon, ShieldCheck, 
  MessageSquare, FileAudio, Sparkles, GraduationCap
} from 'lucide-react';
import { PageId } from '../types';
import { translations } from '../i18n';

interface NavProps {
  currentPage: PageId;
  setPage: (p: PageId) => void;
  lang: 'ar' | 'en';
  onLogout: () => void;
}

export const Navigation: React.FC<NavProps> = ({ currentPage, setPage, lang, onLogout }) => {
  const t = translations[lang];
  
  const menuGroups = [
    {
      title: t.nav_group_home,
      items: [
        { id: 'dashboard', label: t.nav_dashboard, icon: Home },
        { id: 'subjects', label: t.nav_subjects, icon: BookOpen },
        { id: 'planner', label: t.nav_planner, icon: Calendar },
      ]
    },
    {
      title: t.nav_group_ai,
      items: [
        { id: 'ai-assistant', label: t.nav_ai_assistant, icon: GraduationCap },
        { id: 'creator', label: t.nav_creator, icon: LayoutDashboard },
        { id: 'mindmap', label: t.nav_mindmap, icon: Brain },
        { id: 'voice', label: t.nav_voice, icon: Mic },
      ]
    },
    {
      title: t.nav_group_study,
      items: [
        { id: 'timer', label: t.nav_timer, icon: Clock },
        { id: 'mynotes', label: t.nav_mynotes, icon: FileAudio },
        { id: 'blackboard', label: t.nav_blackboard, icon: PenTool },
        { id: 'editor', label: t.nav_editor, icon: ImageIcon },
      ]
    }
  ];

  return (
    <aside className={`w-64 bg-white dark:bg-slate-900 h-screen border-${lang === 'ar' ? 'l' : 'r'} border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-50 transition-all duration-500 shrink-0`}>
      <div className="p-8 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
          <GraduationCap size={24} />
        </div>
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none truncate">{t.brand_title}</h1>
          <p className="text-[8px] text-indigo-500 font-black uppercase tracking-widest mt-1">Smart Learning</p>
        </div>
      </div>

      <nav className="flex-1 p-5 space-y-6 overflow-y-auto custom-scrollbar">
        {menuGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <h3 className={`px-4 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-3 ${lang === 'ar' ? 'text-right' : 'text-left'}`}>{group.title}</h3>
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setPage(item.id as PageId)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group ${
                  currentPage === item.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-indigo-600'
                } ${lang === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}
              >
                <item.icon size={18} className={currentPage === item.id ? 'text-white' : 'group-hover:scale-110 transition-transform'} />
                <span className="font-bold text-xs">{item.label}</span>
              </button>
            ))}
          </div>
        ))}

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <button 
            onClick={() => setPage('pricing')}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
              currentPage === 'pricing' ? 'bg-amber-500 text-white shadow-lg' : 'text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
            } ${lang === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}
          >
            <Crown size={18} />
            <span className="font-bold text-xs">{t.nav_pro_plans}</span>
          </button>
        </div>
      </nav>

      <div className="p-5 border-t border-slate-100 dark:border-slate-800">
        <button 
          onClick={onLogout}
          className={`w-full flex items-center gap-3 p-3.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all font-bold text-xs ${lang === 'ar' ? 'flex-row' : 'flex-row-reverse'}`}
        >
          <LogOut size={18} />
          <span>{t.nav_logout}</span>
        </button>
      </div>
    </aside>
  );
};
