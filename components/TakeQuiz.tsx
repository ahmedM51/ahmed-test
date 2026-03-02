
import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, Clock, CheckCircle2, AlertCircle, 
  GraduationCap, X, Trophy, BarChart3, ChevronRight, ChevronLeft,
  Sparkles, RefreshCcw
} from 'lucide-react';
import { PublishedQuiz, QuizResponse } from '../types';
import { db } from '../services/db';

export const TakeQuiz: React.FC<{ quizId: string, lang: 'ar' | 'en' }> = ({ quizId, lang }) => {
  const [quiz, setQuiz] = useState<PublishedQuiz | null>(null);
  const [step, setStep] = useState<'welcome' | 'questions' | 'result'>('welcome');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [studentInfo, setStudentInfo] = useState({ name: '', group: '' });
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const loadQuiz = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await db.getPublishedQuiz(quizId);
        if (data && data.questions && data.questions.length > 0) {
          setQuiz(data);
          setTimeLeft(data.settings.timeLimit * 60);
        } else {
          setError(lang === 'ar' ? 'عذراً، هذا الاختبار غير متوفر أو لا يحتوي على أسئلة.' : 'Sorry, this quiz is no longer available or contains no questions.');
        }
      } catch (err) {
        setError(lang === 'ar' ? 'فشل الاتصال بالخادم الذكي.' : 'Failed to connect to the smart server.');
      } finally {
        setLoading(false);
      }
    };
    loadQuiz();
  }, [quizId]);

  useEffect(() => {
    let timer: any;
    if (step === 'questions' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && step === 'questions') {
      handleSubmit();
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const handleSubmit = async () => {
    if (!quiz || !quiz.questions) return;
    
    let calculatedScore = 0;
    quiz.questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) calculatedScore++;
    });

    const response: QuizResponse = {
      id: 'res_' + Math.random().toString(36).substr(2, 9),
      quizId: quiz.id,
      studentName: studentInfo.name,
      groupCode: studentInfo.group,
      answers,
      score: calculatedScore,
      totalQuestions: quiz.questions.length,
      submittedAt: new Date().toISOString(),
      timeSpent: (Date.now() - startTime) / 1000,
      deviceInfo: navigator.userAgent
    };

    setScore(calculatedScore);
    await db.submitQuizResponse(response);
    setStep('result');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center font-cairo">
      <div className="relative">
         <div className="w-24 h-24 border-8 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
         <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse" />
      </div>
      <p className="font-black text-slate-500 mt-8 animate-pulse text-lg">{lang === 'ar' ? 'جاري جلب الاختبار من السحابة الذكية...' : 'Fetching quiz from the smart cloud...'}</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-10 font-cairo">
      <div className="bg-white dark:bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl max-w-lg text-center space-y-8 border-t-[12px] border-rose-500">
         <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-full flex items-center justify-center mx-auto"><AlertCircle size={48} /></div>
         <h3 className="text-3xl font-black text-slate-800 dark:text-white leading-tight">{error}</h3>
         <button onClick={() => window.location.href = window.location.origin} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all">العودة للرئيسية</button>
      </div>
    </div>
  );

  const currentQuestion = quiz?.questions[currentIdx];

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 font-cairo ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
       <header className="h-24 bg-white dark:bg-slate-900 border-b shadow-sm flex items-center justify-between px-8 md:px-16 sticky top-0 z-50">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><GraduationCap size={28} /></div>
             <div>
                <h1 className="text-lg font-black dark:text-white truncate max-w-xs">{quiz?.settings.title}</h1>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Powered by Smart Student Platform</p>
             </div>
          </div>
          {step === 'questions' && (
             <div className={`flex items-center gap-4 px-6 py-2 rounded-2xl font-black shadow-inner ${timeLeft < 60 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-50 dark:bg-slate-800 dark:text-white text-slate-600'}`}>
                <Clock size={18} /> {formatTime(timeLeft)}
             </div>
          )}
       </header>

       <main className="max-w-4xl mx-auto py-12 px-6">
          {step === 'welcome' && (
             <div className="bg-white dark:bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl space-y-12 animate-in slide-in-from-bottom-6">
                <div className="text-center space-y-4">
                   <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-xl"><Sparkles className="text-indigo-600" size={48} /></div>
                   <h2 className="text-4xl font-black text-slate-800 dark:text-white">جاهز للتحدي؟</h2>
                   <p className="text-slate-500 font-bold text-lg leading-relaxed">{quiz?.settings.description}</p>
                </div>
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">اسم الطالب</label>
                      <input value={studentInfo.name} onChange={e => setStudentInfo({...studentInfo, name: e.target.value})} className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl font-black text-xl border-none focus:ring-4 focus:ring-indigo-100 dark:text-white transition-all shadow-inner" placeholder="أدخل اسمك بالكامل..." />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">الكود / المجموعة (اختياري)</label>
                      <input value={studentInfo.group} onChange={e => setStudentInfo({...studentInfo, group: e.target.value})} className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl font-black text-xl border-none focus:ring-4 focus:ring-indigo-100 dark:text-white transition-all shadow-inner" placeholder="كود المجموعة لنتائج دقيقة..." />
                   </div>
                </div>
                <button 
                  onClick={() => { setStartTime(Date.now()); setStep('questions'); }}
                  disabled={!studentInfo.name.trim()}
                  className="w-full py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-2xl shadow-[0_20px_50px_rgba(79,70,229,0.4)] hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
                >ابدأ الاختبار الآن 🚀</button>
             </div>
          )}

          {step === 'questions' && quiz && currentQuestion && (
             <div className="space-y-10 animate-in fade-in">
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-lg border border-indigo-50 dark:border-slate-800">
                   <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg">{currentIdx + 1}</div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">السؤال الحالي</p>
                        <div className="w-48 h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden shadow-inner">
                           <div className="h-full bg-indigo-600 transition-all duration-700" style={{ width: `${((currentIdx+1)/quiz.questions.length)*100}%` }}></div>
                        </div>
                      </div>
                   </div>
                   <span className="text-sm font-black text-slate-400">/{quiz.questions.length}</span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-12 rounded-[4rem] shadow-2xl border-4 border-white/5 relative min-h-[400px] flex flex-col justify-center">
                   <h2 className="text-3xl font-black dark:text-white text-center leading-relaxed mb-12 px-6">{currentQuestion.question}</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {currentQuestion.options?.map((opt, i) => (
                        <button 
                          key={i} 
                          onClick={() => setAnswers({...answers, [currentQuestion.id]: i})}
                          className={`p-8 rounded-[3rem] text-right font-black text-lg transition-all border-4 flex items-center gap-6 group shadow-lg ${answers[currentQuestion.id] === i ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 scale-[1.02]' : 'border-white dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-100 text-slate-600 dark:text-slate-400'}`}
                        >
                           <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 font-black shadow-inner transition-colors ${answers[currentQuestion.id] === i ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-300'}`}>{String.fromCharCode(65 + i)}</div>
                           <span className="flex-1">{opt}</span>
                        </button>
                      ))}
                   </div>
                </div>

                <div className="flex justify-between items-center p-8 bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800">
                   <button onClick={() => setCurrentIdx(i => Math.max(0, i-1))} disabled={currentIdx === 0} className="px-10 py-5 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-2xl font-black disabled:opacity-20 flex items-center gap-3 transition-all hover:bg-slate-200"><ChevronRight size={20} /> السابق</button>
                   {currentIdx === quiz.questions.length - 1 ? (
                     <button onClick={handleSubmit} disabled={answers[currentQuestion.id] === undefined} className="px-16 py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-xl hover:scale-105 transition-all">تسليم الاختبار 🏁</button>
                   ) : (
                     <button onClick={() => setCurrentIdx(i => i + 1)} disabled={answers[currentQuestion.id] === undefined} className="px-16 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:scale-105 transition-all flex items-center gap-3">التالي <ChevronLeft size={20} /></button>
                   )}
                </div>
             </div>
          )}

          {step === 'result' && (
             <div className="bg-white dark:bg-slate-900 p-16 rounded-[4rem] shadow-2xl text-center space-y-12 animate-in zoom-in border-b-[20px] border-emerald-500">
                <div className="w-40 h-40 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-2xl border-[15px] border-white dark:border-slate-800 animate-bounce"><Trophy size={80} /></div>
                <div className="space-y-4">
                   <h2 className="text-5xl font-black dark:text-white">أحسنت، {studentInfo.name}!</h2>
                   <p className="text-slate-500 font-bold text-xl uppercase tracking-widest">تم تسليم إجاباتك بنجاح وحساب النتيجة</p>
                </div>
                <div className="max-w-md mx-auto bg-slate-50 dark:bg-slate-800/50 p-12 rounded-[3.5rem] shadow-inner border-2 border-indigo-100 dark:border-indigo-900/30">
                   <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-6">الدرجة النهائية</p>
                   <div className="flex items-baseline justify-center gap-3">
                      <span className="text-9xl font-black text-indigo-600">{score}</span>
                      <span className="text-4xl font-black text-slate-300">/ {quiz?.questions.length}</span>
                   </div>
                   <div className="mt-8 pt-8 border-t border-indigo-100 dark:border-indigo-900/20">
                      <p className="text-xl font-black text-indigo-600">النسبة المئوية: {Math.round((score/(quiz?.questions.length || 1))*100)}%</p>
                   </div>
                </div>
                <div className="flex flex-col gap-4">
                  <button onClick={() => window.location.reload()} className="w-full py-5 bg-indigo-100 text-indigo-600 rounded-3xl font-black hover:bg-indigo-200 transition-all flex items-center justify-center gap-3"><RefreshCcw size={20}/> إعادة المحاولة</button>
                  <button onClick={() => window.location.href = window.location.origin} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-lg">استكشف منصة الطالب الذكي</button>
                </div>
             </div>
          )}
       </main>
    </div>
  );
};
