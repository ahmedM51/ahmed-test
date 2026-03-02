
import React from 'react';
import { Check, Zap, Shield, Star } from 'lucide-react';
import { translations } from '../i18n';
import { User } from '../types';

interface PricingProps {
  lang?: 'ar' | 'en';
  user: User;
}

export const Pricing: React.FC<PricingProps> = ({ lang = 'ar', user }) => {
  const t = translations[lang];
  const plans = [
    {
      name: t.pricing_free,
      price: '0',
      desc: lang === 'ar' ? 'للبداية في تنظيم دراستك' : 'Start organizing your studies',
      features: lang === 'ar' ? ['5 مواد دراسية', 'المساعد الذكي (محدود)', 'السبورة الأساسية', 'مؤقت بومودورو'] : ['5 Subjects', 'Smart Assistant (Limited)', 'Basic Board', 'Pomodoro Timer'],
      color: 'bg-gray-500',
      popular: false
    },
    {
      name: t.pricing_pro,
      price: '19',
      desc: lang === 'ar' ? 'لتحقيق أقصى استفادة تعليمية' : 'Achieve maximum learning potential',
      features: lang === 'ar' ? ['مواد غير محدودة', 'ذكاء اصطناعي متقدم', 'منشئ عروض احترافي', 'مزامنة سحابية', 'دعم فني سريع'] : ['Unlimited Subjects', 'Advanced AI', 'Pro Slide Creator', 'Cloud Sync', 'Fast Support'],
      color: 'bg-indigo-600',
      popular: true
    },
    {
      name: t.pricing_elite,
      price: '49',
      desc: lang === 'ar' ? 'للمجموعات والطلاب المتميزين' : 'For teams and elite students',
      features: lang === 'ar' ? ['كل ميزات البرو', 'دروس خصوصية AI', 'مساحة تخزين 100GB', 'شهادات إكمال', 'بدون إعلانات'] : ['All Pro Features', 'AI Tutoring', '100GB Storage', 'Completion Certs', 'Ad-Free'],
      color: 'bg-purple-700',
      popular: false
    }
  ];

  const handleSubscribe = (planName: string) => {
    const whatsappNumber = "201025612869";
    const message = lang === 'ar' 
      ? `مرحباً، أرغب في الاشتراك في منصة الطالب الذكي.\n\nبياناتي:\n- الاسم: ${user.full_name}\n- البريد الإلكتروني: ${user.email}\n- الخطة المطلوبة: ${planName}`
      : `Hello, I would like to subscribe to the Smart Student Platform.\n\nMy Details:\n- Name: ${user.full_name}\n- Email: ${user.email}\n- Plan: ${planName}`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h2 className="text-4xl font-black dark:text-white">{t.pricing_title}</h2>
        <p className="text-gray-500 text-lg">{t.pricing_subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20">
        {plans.map((plan) => (
          <div key={plan.name} className={`relative bg-white dark:bg-gray-800 p-10 rounded-[4rem] shadow-2xl border-2 transition-all hover:scale-105 ${plan.popular ? 'border-indigo-600' : 'border-transparent dark:border-gray-700'}`}>
            {plan.popular && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-2 rounded-full font-bold text-sm flex items-center gap-2">
                <Star size={14} fill="white" /> {t.pricing_most_popular}
              </div>
            )}
            
            <div className="text-center mb-8">
              <h3 className="text-2xl font-black dark:text-white mb-2">{plan.name}</h3>
              <p className="text-gray-500 text-sm font-medium">{plan.desc}</p>
              <div className="mt-6 flex justify-center items-baseline gap-1">
                <span className="text-5xl font-black dark:text-white">${plan.price}</span>
                <span className="text-gray-400 font-bold">{t.pricing_per_month}</span>
              </div>
            </div>

            <div className="space-y-4 mb-10">
              {plan.features.map(f => (
                <div key={f} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${plan.color}`}>
                    <Check size={14} />
                  </div>
                  <span className="text-gray-600 dark:text-gray-300 font-bold text-sm">{f}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => handleSubscribe(plan.name)}
              className={`w-full py-5 rounded-3xl font-black text-lg transition-all shadow-xl ${plan.popular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white hover:bg-gray-200'}`}
            >
              {t.pricing_subscribe}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
