
import React, { useState } from 'react';
import { User } from '../types';
import { db, supabase } from '../services/db';
import { translations } from '../i18n';
import { 
  Sun, Moon, Languages, GraduationCap, ArrowRight, 
  User as UserIcon, Mail, Lock, Sparkles, 
  ShieldCheck, Loader2 
} from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
  lang: 'ar' | 'en';
  setLang: (l: 'ar' | 'en') => void;
  isDark: boolean;
  setIsDark: (d: boolean) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin, lang, setLang, isDark, setIsDark }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      if (activeTab === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: { full_name: fullName }
          }
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          // Create profile
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert([{ id: data.user.id, full_name: fullName, xp: 100 }], { onConflict: 'id' });
          
          if (profileError) console.error('Error creating profile:', profileError);
          
          const userData = await db.getUser();
          if (userData) onLogin(userData);
          else if (data.session) {
             // If session exists but profile fetch failed, try one more time
             onLogin({
               id: data.user.id,
               email: data.user.email || '',
               full_name: fullName,
               xp: 100,
               subjects_count: 0
             });
          } else {
            setError(lang === 'ar' ? "يرجى تفعيل بريدك الإلكتروني أو التحقق من إعدادات Supabase" : "Please confirm your email or check Supabase settings");
          }
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (signInError) throw signInError;

        const userData = await db.getUser();
        if (userData) onLogin(userData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden font-cairo transition-colors duration-500 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-center bg-cover scale-105 transition-transform duration-[10s] ease-linear"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop')`,
            animation: 'pan-bg 30s infinite alternate'
          }}
        ></div>
        
        <div className={`absolute inset-0 transition-all duration-700 ${isDark 
          ? 'bg-gradient-to-tr from-slate-950/95 via-slate-900/85 to-indigo-900/50' 
          : 'bg-gradient-to-tr from-white/95 via-white/60 to-indigo-50/40'}`}
        ></div>

        <div className="absolute -top-40 -left-40 w-[60rem] h-[60rem] bg-indigo-600/10 rounded-full blur-[140px] animate-pulse"></div>
        <div className="absolute -bottom-40 -right-40 w-[60rem] h-[60rem] bg-purple-600/10 rounded-full blur-[140px] animate-pulse delay-1000"></div>
      </div>

      {/* Header Controls */}
      <header className="relative z-20 w-full px-8 py-6 md:px-16 flex justify-between items-center">
        <div className="flex items-center gap-4 group cursor-default">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-[0_10px_30px_rgba(79,70,229,0.4)] transition-transform group-hover:rotate-6">
            <GraduationCap size={32} />
          </div>
          <div className="flex flex-col">
            <span className={`text-2xl font-black tracking-tighter drop-shadow-sm transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t.brand_title}
            </span>
            <span className={`text-[10px] font-black uppercase tracking-[0.3em] leading-none opacity-80 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
              AI-Powered Excellence
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className={`flex items-center gap-2 px-6 py-3 backdrop-blur-md border rounded-2xl font-black text-xs transition-all active:scale-95 ${isDark ? 'bg-white/10 border-white/10 text-white hover:bg-white/20' : 'bg-white/80 border-slate-200 text-slate-900 hover:bg-slate-100 shadow-sm'}`}
          >
            <Languages size={18} />
            <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          <button 
            onClick={() => setIsDark(!isDark)}
            className={`p-3 backdrop-blur-md border rounded-2xl transition-all active:scale-95 ${isDark ? 'bg-white/10 border-white/10 text-amber-400 hover:bg-white/20' : 'bg-white/80 border-slate-200 text-amber-600 hover:bg-slate-100 shadow-sm'}`}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className={`backdrop-blur-3xl rounded-[4rem] p-10 md:p-14 w-full max-w-lg shadow-[0_50px_120px_rgba(0,0,0,0.2)] border transition-all animate-in fade-in zoom-in duration-700 ${isDark ? 'bg-slate-900/80 border-white/10' : 'bg-white/90 border-white/50'}`}>
          
          <div className="text-center mb-10">
            <div className={`inline-flex p-5 rounded-[2rem] mb-6 transition-all shadow-inner ${isDark ? 'bg-indigo-400/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Sparkles size={48} className="animate-pulse" />
            </div>
            <h2 className={`text-4xl font-black mb-3 tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {activeTab === 'login' ? (lang === 'ar' ? 'مرحباً بعودتك' : 'Welcome Back') : (lang === 'ar' ? 'انضم إلينا اليوم' : 'Join Us Today')}
            </h2>
            <p className={`text-sm font-bold uppercase tracking-[0.2em] opacity-60 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t.auth_subtitle}
            </p>
          </div>

          {/* Tabs */}
          <div className={`flex p-1.5 rounded-[2rem] mb-10 border transition-all ${isDark ? 'bg-slate-800/50 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
            <button 
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-4 rounded-[1.5rem] font-black text-sm transition-all ${activeTab === 'login' ? (isDark ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white text-indigo-600 shadow-md') : 'text-slate-500 hover:opacity-80'}`}
            >
              {t.auth_login_tab}
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-4 rounded-[1.5rem] font-black text-sm transition-all ${activeTab === 'register' ? (isDark ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white text-indigo-600 shadow-md') : 'text-slate-500 hover:opacity-80'}`}
            >
              {t.auth_register_tab}
            </button>
          </div>

            {error && (
              <div className={`p-4 rounded-2xl text-xs font-black mb-6 ${isDark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 bg-red-600 border border-red-100 text-white'}`}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'register' && (
              <div className="relative group">
                <input 
                  type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder={t.auth_name_placeholder}
                  className={`w-full px-8 py-5 pr-14 border rounded-[2rem] transition-all outline-none font-bold text-lg placeholder:text-slate-400 ${isDark ? 'bg-slate-800/50 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 shadow-sm'}`}
                />
                <div className={`absolute ${lang === 'ar' ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
                  <UserIcon size={24} />
                </div>
              </div>
            )}
            
            <div className="relative group">
              <input 
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder={t.auth_email_placeholder}
                className={`w-full px-8 py-5 pr-14 border rounded-[2rem] transition-all outline-none font-bold text-lg placeholder:text-slate-400 ${isDark ? 'bg-slate-800/50 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 shadow-sm'}`}
              />
              <div className={`absolute ${lang === 'ar' ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
                <Mail size={24} />
              </div>
            </div>

            <div className="relative group">
              <input 
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder={t.auth_password_placeholder}
                className={`w-full px-8 py-5 pr-14 border rounded-[2rem] transition-all outline-none font-bold text-lg placeholder:text-slate-400 ${isDark ? 'bg-slate-800/50 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600 shadow-sm'}`}
              />
              <div className={`absolute ${lang === 'ar' ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`}>
                <Lock size={24} />
              </div>
            </div>
            
            <button 
              type="submit" disabled={isLoading || isGoogleLoading}
              className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black text-xl shadow-[0_15px_40px_rgba(79,70,229,0.3)] hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 mt-8 flex items-center justify-center gap-4"
            >
              {isLoading ? (
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{activeTab === 'login' ? t.auth_submit_login : t.auth_submit_register}</span>
                  <ArrowRight size={28} className={lang === 'ar' ? 'rotate-180' : ''} />
                </>
              )}
            </button>
          </form>

          <div className="mt-10">
            <div className="flex items-center gap-6 mb-8">
              <div className={`flex-1 h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">{t.auth_or}</span>
              <div className={`flex-1 h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            </div>
            
            <button 
              onClick={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
              className={`w-full py-5 border rounded-[2rem] font-black flex items-center justify-center gap-4 transition-all active:scale-95 group disabled:opacity-50 ${isDark ? 'bg-slate-800/50 border-slate-700 text-slate-200 hover:bg-slate-800' : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50 shadow-sm'}`}
            >
              {isGoogleLoading ? (
                <Loader2 className="animate-spin text-indigo-600" size={24} />
              ) : (
                <svg viewBox="0 0 48 48" className="w-7 h-7">
                  <path fill="#EA4335" d="M24 9.5c3.06 0 5.8 1.05 7.96 2.77l5.96-5.96C34.3 2.38 29.4 0 24 0 14.6 0 6.55 5.38 2.7 13.22l6.94 5.39C11.3 13.1 17.2 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.1 24.5c0-1.64-.15-3.21-.43-4.73H24v9.46h12.43c-.54 2.9-2.18 5.36-4.63 7.02l7.48 5.8c4.37-4.03 6.82-9.98 6.82-17.55z"/>
                  <path fill="#FBBC05" d="M9.64 28.61c-.48-1.44-.76-2.98-.76-4.61s.27-3.17.76-4.61l-6.94-5.39C1.01 17.1 0 20.47 0 24s1.01 6.9 2.7 10.01l6.94-5.4z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.92-2.14 15.89-5.8l-7.48-5.8c-2.08 1.4-4.74 2.23-8.41 2.23-6.8 0-12.7-3.6-14.36-9.11l-6.94 5.39C6.55 42.62 14.6 48 24 48z"/>
                </svg>              
              )}
              <span>{t.auth_google_login}</span>
            </button>
          </div>

          <div className={`mt-10 flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] opacity-80 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
            <ShieldCheck size={20} />
            <span>نظام تعليمي آمن وذكي بالكامل</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-10 text-center">
        <p className={`font-black text-[11px] uppercase tracking-[0.5em] transition-colors ${isDark ? 'text-white opacity-40' : 'text-slate-900 opacity-20'}`}>
          &copy; 2025 {t.brand_title} • Leading Educational Innovation
        </p>
      </footer>

      <style>{`
        @keyframes pan-bg {
          from { transform: scale(1.05) translate(0, 0); }
          to { transform: scale(1.15) translate(-2%, -2%); }
        }
      `}</style>
    </div>
  );
};
