
import React from 'react';
import { Shield, Lock, Eye, FileText } from 'lucide-react';
import { translations } from '../i18n';

export const Privacy: React.FC<{ lang?: 'ar' | 'en' }> = ({ lang = 'ar' }) => {
  const t = translations[lang];
  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
          <Shield size={40} />
        </div>
        <h2 className="text-4xl font-black dark:text-white">{t.privacy_title}</h2>
        <p className="text-gray-500 text-lg">{t.privacy_subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {[
          { title: t.privacy_item1_title, desc: t.privacy_item1_desc, icon: Lock, color: 'text-blue-500' },
          { title: t.privacy_item2_title, desc: t.privacy_item2_desc, icon: Eye, color: 'text-purple-500' },
        ].map((item, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-10 rounded-[3rem] shadow-xl border dark:border-gray-700 group hover:border-indigo-500 transition-all">
            <item.icon className={`${item.color} mb-6`} size={32} />
            <h3 className="text-xl font-black dark:text-white mb-4">{item.title}</h3>
            <p className="text-gray-500 leading-relaxed font-medium">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 p-12 rounded-[4rem] shadow-xl border dark:border-gray-700 prose prose-indigo dark:prose-invert max-w-none">
        <h3 className="text-2xl font-black dark:text-white mb-8 flex items-center gap-3">
          <FileText className="text-indigo-600" /> {t.privacy_details_title}
        </h3>
        <div className="space-y-6 text-gray-600 dark:text-gray-400 font-bold leading-loose">
          <p>{t.privacy_detail1}</p>
          <p>{t.privacy_detail2}</p>
          <p>{t.privacy_detail3}</p>
        </div>
      </div>
    </div>
  );
};
