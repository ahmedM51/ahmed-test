
import React, { useState, useRef, useEffect } from 'react';
import { getAIResponse } from '../services/geminiService';
import { translations } from '../i18n';

interface Message {
  role: 'user' | 'bot';
  text: string;
  time: string;
}

interface HelpBotProps {
  lang: 'ar' | 'en';
}

export const HelpBot: React.FC<HelpBotProps> = ({ lang }) => {
  const [isOpen, setIsOpen] = useState(false);
  const t = translations[lang];
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: t.bot_welcome, time: lang === 'ar' ? 'الآن' : 'Now' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput('');
    const timeStr = new Date().toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: userMsg, time: timeStr }]);
    
    setIsTyping(true);
    // Fix: getAIResponse returns an object { text, links }, we only need the text here.
    const reply = await getAIResponse(userMsg);
    setIsTyping(false);
    
    setMessages(prev => [...prev, { role: 'bot', text: reply.text, time: timeStr }]);
  };

  return (
    <div className={`fixed bottom-8 ${lang === 'ar' ? 'right-8' : 'left-8'} z-50`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-[0_10px_40px_rgba(79,70,229,0.4)] flex items-center justify-center transform hover:scale-110 active:scale-95 transition-all ring-4 ring-white dark:ring-gray-800"
      >
        {isOpen ? <i className="fas fa-times text-2xl"></i> : <i className="fas fa-comment-dots text-2xl animate-pulse"></i>}
      </button>

      {isOpen && (
        <div className={`absolute bottom-24 ${lang === 'ar' ? 'right-0' : 'left-0'} w-[380px] max-w-[90vw] h-[550px] rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300 z-50`}>
          <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                <i className="fas fa-robot text-lg"></i>
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide">{t.help_center_title}</h3>
                <p className="text-[10px] text-indigo-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> {lang === 'ar' ? 'نشط الآن' : 'Online Now'}
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:rotate-90 transition-transform"><i className="fas fa-times opacity-80"></i></button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc] dark:bg-gray-900 space-y-6 custom-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'bot' && (
                   <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 self-end mr-2">B</div>
                )}
                <div className={`max-w-[80%] rounded-3xl px-5 py-3 text-sm shadow-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-none font-medium' 
                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-bl-none border border-gray-100 dark:border-gray-600'
                }`}>
                  {m.text}
                  <div className={`text-[9px] mt-1.5 font-bold uppercase ${m.role === 'user' ? 'text-indigo-200 text-right' : 'text-gray-400 dark:text-gray-500 text-left'}`}>
                    {m.time}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 mr-2 self-end"></div>
                <div className="bg-white dark:bg-gray-700 rounded-3xl px-5 py-4 shadow-sm flex gap-1.5 border border-gray-100 dark:border-gray-600">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-duration:0.6s]"></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.1s]"></span>
                  <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.2s]"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-5 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-1 rounded-[1.5rem] border border-gray-200 dark:border-gray-700 shadow-inner group-focus-within:border-indigo-400 transition-colors">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                type="text" 
                placeholder={t.help_input_placeholder}
                className="flex-1 bg-transparent px-5 py-3.5 text-sm focus:outline-none dark:text-white font-medium"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
            <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 mt-4 font-bold tracking-widest uppercase">Powered by Gemini AI • Smart Student Platform</p>
          </div>
        </div>
      )}
    </div>
  );
};
