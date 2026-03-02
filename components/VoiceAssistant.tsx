import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Volume2, Sparkles, Play, Square, Loader2, 
  Upload, Video, Headphones, Download, FileText, 
  X, Image as ImageIcon, Waves, FileAudio, PlayCircle, PauseCircle,
  Radio, Monitor, Info, ShieldAlert, CheckCircle2, Cpu, Film, Beaker,
  History, ArrowRight, Share2, Printer
} from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";

// --- Audio & File Helpers ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function audioBufferToMp3(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const mp3encoder = new (window as any).lamejs.Mp3Encoder(channels, sampleRate, 128);
  const mp3Data: any[] = [];
  const left = buffer.getChannelData(0);
  const leftInt16 = new Int16Array(left.length);
  for (let i = 0; i < left.length; i++) {
    leftInt16[i] = left[i] < 0 ? left[i] * 0x8000 : left[i] * 0x7FFF;
  }
  let mp3buf;
  if (channels === 2) {
    const right = buffer.getChannelData(1);
    const rightInt16 = new Int16Array(right.length);
    for (let i = 0; i < right.length; i++) {
      rightInt16[i] = right[i] < 0 ? right[i] * 0x8000 : right[i] * 0x7FFF;
    }
    mp3buf = mp3encoder.encodeBuffer(leftInt16, rightInt16);
  } else {
    mp3buf = mp3encoder.encodeBuffer(leftInt16);
  }
  if (mp3buf.length > 0) mp3Data.push(mp3buf);
  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) mp3Data.push(endBuf);
  return new Blob(mp3Data, { type: 'audio/mpeg' });
}

export const VoiceAssistant: React.FC<{ lang?: 'ar' | 'en' }> = ({ lang = 'ar' }) => {
  const [isLive, setIsLive] = useState(false);
  const [lectureText, setLectureText] = useState('');
  const [fileType, setFileType] = useState<'text' | 'image' | 'pdf' | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState('');
  const [showVideoHelp, setShowVideoHelp] = useState(false);

  const [isAudioSummaryLoading, setIsAudioSummaryLoading] = useState(false);
  const [summaryAudioUrl, setSummaryAudioUrl] = useState<string | null>(null);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    if (!(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
  }, []);

  const stopAllAudio = () => {
    audioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) { /* ignore */ } });
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  function getUserTranscriptText(msg: LiveServerMessage): string | undefined {
    if (
      msg.serverContent &&
      msg.serverContent.inputTranscription &&
      typeof msg.serverContent.inputTranscription.text === "string"
    ) {
      return msg.serverContent.inputTranscription.text;
    }
    return undefined;
  }

  function getAiTranscriptText(msg: LiveServerMessage): string | undefined {
    if (
      msg.serverContent &&
      msg.serverContent.outputTranscription &&
      typeof msg.serverContent.outputTranscription.text === "string"
    ) {
      return msg.serverContent.outputTranscription.text;
    }
    return undefined;
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    setSummaryAudioUrl(null); 
    setVideoUrl(null);
    try {
      if (file.type === 'application/pdf') {
        const pdfjs = (window as any).pdfjsLib;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((it: any) => it.str).join(' ') + '\n';
        }
        setLectureText(text);
        setFileType('pdf');
        setImageData(null);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setImageData(ev.target?.result as string);
          setFileType('image');
          setLectureText('');
        };
        reader.readAsDataURL(file);
      } else {
        const text = await file.text();
        setLectureText(text);
        setFileType('text');
        setImageData(null);
      }
      setTranscript(prev => [
        ...prev, 
        { 
          role: 'ai', 
          text: lang === 'ar' 
            ? `تم تحميل "${file.name}"، أنا جاهز لتحويله إلى فيديو شرح أو بودكاست صوتي.` 
            : `"${file.name}" loaded, ready for video or podcast.` 
        }
      ]);
    } catch (err) { alert("خطأ في التحميل"); } finally { setFileLoading(false); }
  };

  const exportTranscriptToPDF = () => {
    if (transcript.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert(lang === 'ar' ? "يرجى تفعيل النوافذ المنبثقة." : "Please enable popups.");

    const contentHtml = transcript.map((m, i) => `
      <div style="margin-bottom: 20px; padding: 15px; border-radius: 15px; background: ${m.role === 'user' ? '#f0f4ff' : '#f0fff4'}; border: 1px solid ${m.role === 'user' ? '#dce3f1' : '#dcf1dc'};">
        <strong style="color: ${m.role === 'user' ? '#4f46e5' : '#10b981'}; display: block; margin-bottom: 5px; font-size: 12px; text-transform: uppercase;">
          ${m.role === 'user' ? (lang === 'ar' ? 'أنت (الطالب)' : 'You (Student)') : (lang === 'ar' ? 'المعلم الذكي' : 'Smart AI Tutor')}
        </strong>
        <div style="font-size: 14px; line-height: 1.6; color: #1e293b;">${m.text}</div>
      </div>
    `).join('');

    printWindow.document.write(`
      <html dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
        <head>
          <title>Smart Student - Conversation Report</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 40px; background: #fff; color: #1e293b; }
            .header { border-bottom: 4px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .header h1 { color: #4f46e5; margin: 0; font-size: 24px; font-weight: 900; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; font-weight: bold; }
            @media print { * { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>منصة الطالب الذكي - سجل الحوار التعليمي</h1>
            <p style="margin-top: 5px; font-size: 12px; color: #64748b;">تاريخ الجلسة: ${new Date().toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}</p>
          </div>
          <div class="transcript-container">${contentHtml}</div>
          <div class="footer">تم استخراج هذا التقرير آلياً بواسطة المساعد الصوتي الذكي - 2025</div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.addEventListener('afterprint', () => { window.close(); });
              }, 1000);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const generateAudioSummary = async () => {
    if (!lectureText && !imageData) return alert("يرجى رفع ملف أولاً.");
    setIsAudioSummaryLoading(true);
    setSummaryAudioUrl(null);
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const prompt = imageData 
        ? "أعطني شرحاً صوتياً مفصلاً جداً لهذه الصورة وكأنك معلم يشرح لطلابه بأسلوب قصصي ممتع."
        : `قم بإنشاء شرح صوتي كامل ومفصل جداً بأسلوب حوار ممتع ومبسط بين 'الدكتور' و 'الطالب'. المحتوى:\n${lectureText.substring(0, 15000)}`;

      const textRes = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: imageData 
          ? { parts: [{ inlineData: { data: imageData.split(',')[1], mimeType: 'image/jpeg' } }, { text: prompt }] } 
          : { parts: [{ text: prompt }] } 
      });

      const summaryText = textRes.text || "";
      const ttsRes = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `اقرأ هذا الشرح بأسلوب تفاعلي: ${summaryText}` }] }],
        config: { 
          responseModalities: [Modality.AUDIO], 
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } 
        },
      });

      const audioBase64: string | undefined = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (typeof audioBase64 === "string") {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(decode(audioBase64), ctx, 24000, 1);
        const mp3Blob = audioBufferToMp3(audioBuffer);
        setSummaryAudioUrl(URL.createObjectURL(mp3Blob));
      }
    } catch (e) { alert("فشل توليد التلخيص الصوتي."); } finally { setIsAudioSummaryLoading(false); }
  };

  const generateSmartVideo = async () => {
    if (!lectureText && !imageData) return alert("يرجى رفع ملف (PDF أو صورة) أولاً ليتمكن الذكاء الاصطناعي من تحليله وتوليد الفيديو.");
    
    const aistudio = (window as any).aistudio;
    if (aistudio && !await aistudio.hasSelectedApiKey()) {
      alert("توليد الفيديو يتطلب اختيار مفتاح API مدفوع (Paid) من Google Cloud. سيتم فتح نافذة الاختيار الآن.");
      await aistudio.openSelectKey();
      return; 
    }
    
    setIsVideoLoading(true);
    setVideoStatus(lang === 'ar' ? 'جاري استيعاب محتوى ملفك...' : 'Ingesting your file...');
    
    try {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const analysisPrompt = imageData 
        ? "Analyze this image and create a highly detailed cinematic prompt for a 5-second educational video explaining its core concept. Describe motion, lighting, and camera work. Respond only with the English prompt."
        : `Summarize the following lecture into a cinematic visual prompt for a 5-second video that explains the main concept visually. Use descriptive artistic language. 
           Content: ${lectureText.substring(0, 2000)}
           Respond only with the English prompt.`;

      const analysisRes = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: imageData 
          ? { parts: [{ inlineData: { data: imageData.split(',')[1], mimeType: 'image/jpeg' } }, { text: analysisPrompt }] } 
          : { parts: [{ text: analysisPrompt }] } 
      });

      const visualPrompt: string = analysisRes.text || "Scientific visualization of lecture content";
      setVideoStatus(lang === 'ar' ? 'جاري تصميم المشاهد السينمائية...' : 'Designing cinematic scenes...');

      const videoConfig: any = { 
        model: 'veo-3.1-fast-generate-preview', 
        prompt: visualPrompt,
        config: { 
          numberOfVideos: 1, 
          resolution: '720p', 
          aspectRatio: '16:9' 
        } 
      };

      if (imageData) {
        videoConfig.image = {
          imageBytes: imageData.split(',')[1],
          mimeType: 'image/jpeg'
        };
      }

      let operation = await ai.models.generateVideos(videoConfig);

      setVideoStatus(lang === 'ar' ? 'جاري الرندرة الحقيقية (قد يستغرق 3-5 دقائق)...' : 'Rendering real video (takes 3-5 mins)...');

      while (!operation.done) {
        await new Promise(r => setTimeout(r, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      setVideoStatus(lang === 'ar' ? 'تجهيز ملف MP4 للتحميل...' : 'Preparing MP4 for download...');

      const downloadLink: string | undefined = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (typeof downloadLink === "string") {
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob));
      }
    } catch (e: any) {
      console.error(e);
      const aistudio = (window as any).aistudio;
      if (typeof e?.message === "string" && e.message.includes("entity was not found")) {
        alert("يرجى اختيار مفتاح API مدفوع مرتبط بمشروع Google Cloud مفعل فيه الفواتير (Billing).");
        if (aistudio) await aistudio.openSelectKey();
      } else {
        alert("فشل توليد الفيديو. تأكد من استهلاكك للـ Quota أو صلاحية المفتاح.");
      }
    } finally {
      setIsVideoLoading(false);
    }
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `Smart_Lecture_${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startLiveSession = async () => {
    if (isLive) {
        if (sessionRef.current) {
            sessionRef.current.then((s: any) => s.close());
            sessionRef.current = null;
        }
        setIsLive(false);
        stopAllAudio();
        return;
    }

    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputCtx;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          setIsLive(true);
          const source = inputCtx.createMediaStreamSource(stream);
          const proc = inputCtx.createScriptProcessor(4096, 1, 1);
          proc.onaudioprocess = (e) => {
            const data = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(data.length);
            for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
            sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
          };
          source.connect(proc);
          proc.connect(inputCtx.destination);
          if (imageData) sessionPromise.then(s => s.sendRealtimeInput({ media: { data: imageData.split(',')[1], mimeType: 'image/jpeg' } }));
        },
        onmessage: async (msg: LiveServerMessage) => {
          const modelTurnParts = msg.serverContent?.modelTurn?.parts;
          const audioData = Array.isArray(modelTurnParts) && modelTurnParts[0]?.inlineData?.data;
          const currentOutputCtx = audioContextRef.current;
          if (audioData && currentOutputCtx) {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentOutputCtx.currentTime);
            const buf = await decodeAudioData(decode(audioData), currentOutputCtx, 24000, 1);
            const s = currentOutputCtx.createBufferSource();
            s.buffer = buf; s.connect(currentOutputCtx.destination); s.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buf.duration;
            audioSourcesRef.current.add(s);
            s.onended = () => audioSourcesRef.current.delete(s);
          }

          const userText = getUserTranscriptText(msg);
          if (typeof userText === "string") {
            setTranscript(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'user') {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, text: last.text + userText };
                return updated;
              }
              return [...prev, { role: 'user', text: userText }];
            });
          }

          const aiText = getAiTranscriptText(msg);
          if (typeof aiText === "string") {
            setTranscript(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'ai') {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, text: last.text + aiText };
                return updated;
              }
              return [...prev, { role: 'ai', text: aiText }];
            });
          }

          if (msg.serverContent && msg.serverContent.interrupted) stopAllAudio();
        },
        onclose: () => setIsLive(false),
        onerror: () => setIsLive(false)
      },
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {}, outputAudioTranscription: {},
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: `أنت المعلم الذكي. اشرح بذكاء وهدوء. سياقك المرجعي المباشر: ${lectureText.substring(0, 10000)}`
      }
    });
    sessionRef.current = sessionPromise;
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-10rem)] gap-8 animate-in fade-in duration-500 pb-6 font-cairo ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
      
      {showVideoHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3.5rem] p-10 shadow-2xl relative border border-white/10 text-right" dir="rtl">
              <button onClick={() => setShowVideoHelp(false)} className="absolute top-8 left-8 text-slate-400 hover:text-rose-500 transition-all"><X size={24} /></button>
              <h3 className="text-3xl font-black mb-6 flex items-center gap-4"><Info className="text-indigo-600" size={32} /> كيف نولد فيديو من ملفاتك؟</h3>
              
              <div className="space-y-8">
                 <div className="flex gap-6 items-start">
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0"><FileText size={24} /></div>
                    <div>
                       <h4 className="font-black text-lg">الخطوة الأولى: تحليل المحتوى</h4>
                       <p className="text-slate-500 text-sm leading-relaxed">يستخدم المساعد نموذج Gemini 3 لقراءة نصوصك واستخراج المفاهيم العلمية بدقة لتحويلها لصور متحركة.</p>
                    </div>
                 </div>
                 <div className="flex gap-6 items-start">
                    <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 shrink-0"><Film size={24} /></div>
                    <div>
                       <h4 className="font-black text-lg">الخطوة الثانية: الرندرة السينمائية</h4>
                       <p className="text-slate-500 text-sm leading-relaxed">يرسل النظام "الوصف التعليمي" لنموذج Veo 3.1 الذي يقوم ببناء فيديو MP4 عالي الجودة خصيصاً لمحتواك.</p>
                    </div>
                 </div>
                 <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-3xl border-2 border-dashed border-amber-200">
                    <h4 className="font-black text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2"><ShieldAlert size={18} /> ملاحظات هامة:</h4>
                    <ul className="text-[11px] text-amber-700 dark:text-amber-400 space-y-2 font-bold list-disc pr-4">
                       <li>يجب استخدام مفتاح API من مشروع Google Cloud مفعل فيه نظام الدفع (Paid Tier).</li>
                       <li>النماذج المستخدمة (Veo) تستهلك Quota عالية، لذا قد يستغرق التوليد بضع دقائق.</li>
                    </ul>
                 </div>
              </div>
              <button onClick={() => setShowVideoHelp(false)} className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:scale-105 transition-all">جاهز للتوليد الحقيقي</button>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] shadow-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
           <div className="flex items-center gap-6">
              <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center text-white shadow-2xl ${fileType ? 'bg-emerald-500' : 'bg-indigo-600'}`}>
                 {fileLoading ? <Loader2 className="animate-spin" /> : fileType === 'image' ? <ImageIcon /> : <FileText />}
              </div>
              <div>
                 <h2 className="text-2xl font-black">{lang === 'ar' ? 'المختبر التعليمي الذكي' : 'Smart Learning Lab'}</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{fileType ? `${lang === 'ar' ? 'المرجع:' : 'Ref:'} ${fileType}` : (lang === 'ar' ? 'ارفع ملفاً للبدء' : 'Upload to start')}</p>
              </div>
           </div>
           <div className="flex gap-3 flex-wrap">
              <label className="p-4 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-2xl cursor-pointer transition-all border dark:border-slate-700 shadow-sm">
                 <Upload size={24} /><input type="file" className="hidden" accept=".pdf,.txt,image/*" onChange={handleFileUpload} />
              </label>
              <button onClick={generateAudioSummary} disabled={isAudioSummaryLoading || (!lectureText && !imageData)} className="px-6 py-4 bg-amber-500 text-white rounded-2xl font-black flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50">
                {isAudioSummaryLoading ? <Loader2 className="animate-spin" size={20} /> : <Headphones size={20} />}
                {lang === 'ar' ? 'بودكاست الشرح' : 'Audio Podcast'}
              </button>
              <button onClick={generateSmartVideo} className="px-6 py-4 bg-purple-600 text-white rounded-2xl font-black flex items-center gap-2 hover:shadow-lg transition-all">
                <Video size={20} /> {lang === 'ar' ? 'توليد فيديو VEO' : 'Generate VEO'}
              </button>
           </div>
        </div>
        <button onClick={startLiveSession} className={`p-8 rounded-[3.5rem] text-white shadow-xl relative overflow-hidden group transition-all ${isLive ? 'bg-rose-500 animate-pulse' : 'bg-indigo-600'}`}>
           <div className="relative z-10 text-right"><h3 className="text-xl font-black mb-2">{isLive ? (lang === 'ar' ? 'جلسة نشطة' : 'Live Now') : (lang === 'ar' ? 'تحدث مع الملف' : 'Talk to File')}</h3><p className="text-xs font-medium opacity-80">{isLive ? (lang === 'ar' ? 'أنا أسمعك...' : 'Listening...') : (lang === 'ar' ? 'مناقشة صوتية ذكية' : 'Smart discussion')}</p></div>
           {isLive ? <Waves className="absolute -bottom-4 -left-4 opacity-20" size={120} /> : <Mic className="absolute -bottom-4 -left-4 opacity-20" size={100} />}
        </button>
      </div>

      {summaryAudioUrl && (
        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-800 flex items-center justify-between gap-4 animate-in slide-in-from-top-4 shadow-sm">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg"><FileAudio size={24} /></div>
              <div>
                <h4 className="font-black text-emerald-800 dark:text-emerald-200">{lang === 'ar' ? 'البودكاست التعليمي جاهز' : 'Podcast Ready'}</h4>
                <p className="text-[10px] font-bold text-emerald-600">{lang === 'ar' ? 'شرح صوتي ممتع للملف المرفوع' : 'Audio summary based on your file'}</p>
              </div>
           </div>
           <div className="flex items-center gap-4 flex-1 max-w-xl">
              <audio controls src={summaryAudioUrl} className="w-full h-10 accent-emerald-600" />
              <a href={summaryAudioUrl} download={`Podcast_${Date.now()}.mp3`} className="p-3 bg-white dark:bg-slate-800 text-emerald-600 rounded-xl shadow-sm hover:scale-110 transition-all border border-emerald-100"><Download size={20} /></a>
           </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden">
        
        <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl border dark:border-slate-800 overflow-hidden relative">
           <div className="bg-slate-50 dark:bg-slate-800 px-8 py-4 border-b flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                 <History size={18} className="text-indigo-600" />
                 <h4 className="font-black text-xs uppercase tracking-widest">{lang === 'ar' ? 'سجل النقاش المباشر' : 'Live Discussion Log'}</h4>
              </div>
              {transcript.length > 0 && (
                <button 
                  onClick={exportTranscriptToPDF}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[10px] flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md"
                >
                  <Printer size={14} /> {lang === 'ar' ? 'تصدير النقاش PDF' : 'Export Discussion PDF'}
                </button>
              )}
           </div>
           <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar bg-slate-50/20">
              {transcript.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-4">
                  <Radio size={80} className="text-indigo-400 animate-pulse" />
                  <h4 className="text-xl font-black">{lang === 'ar' ? 'المساعد بانتظار أوامرك' : 'Assistant waiting'}</h4>
                  <p className="text-xs max-w-xs">{lang === 'ar' ? 'ارفع ملفك ثم ابدأ الحوار الصوتي أو ولد شرحاً مرئياً.' : 'Upload file and start discussion or video.'}</p>
                </div>
              )}
              {transcript.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                   <div className={`max-w-[85%] p-6 rounded-[2.5rem] text-sm font-bold leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 dark:text-white rounded-bl-none border border-indigo-50/20'}`}>
                     {m.text}
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6 overflow-hidden">
           <div className="flex-1 bg-slate-950 rounded-[3.5rem] p-8 flex flex-col items-center justify-center relative overflow-hidden group border-4 border-indigo-600/20 shadow-2xl">
              <button onClick={() => setShowVideoHelp(true)} className="absolute top-8 left-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-md z-20 transition-all"><Info size={20} /></button>
              
              {videoUrl && (
                <button 
                  onClick={downloadVideo}
                  className="absolute bottom-8 right-8 p-4 bg-emerald-600 text-white rounded-2xl shadow-2xl hover:scale-110 transition-all z-30 flex items-center gap-2 animate-in zoom-in"
                >
                  <Download size={20} />
                  <span className="font-black text-xs">{lang === 'ar' ? 'تحميل MP4' : 'Download MP4'}</span>
                </button>
              )}

              {isVideoLoading ? (
                <div className="text-center space-y-8 z-10 w-full px-10">
                   <div className="relative">
                      <div className="w-28 h-28 border-8 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto shadow-2xl"></div>
                      <Film className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 animate-pulse" size={32} />
                   </div>
                   <div className="space-y-4">
                      <p className="text-white font-black text-xl animate-pulse">{videoStatus}</p>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden p-0.5 shadow-inner">
                         <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-[loading-bar_10s_ease-in-out_infinite] rounded-full"></div>
                      </div>
                      <div className="flex justify-center gap-4 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">
                         <span className="flex items-center gap-1"><Cpu size={10} /> Gemini 3 Analysis</span>
                         <span className="flex items-center gap-1"><Film size={10} /> Veo 3.1 Rendering</span>
                      </div>
                   </div>
                </div>
              ) : videoUrl ? (
                <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover rounded-[2rem] shadow-2xl border-4 border-white/5" />
              ) : imageData ? (
                <img src={imageData} className="w-full h-full object-contain rounded-[2.5rem] opacity-60" alt="Preview" />
              ) : (
                <div className="text-center space-y-6 opacity-30 group-hover:opacity-50 transition-opacity">
                   <div className="w-24 h-24 bg-indigo-500/20 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
                      <Monitor size={60} className="text-indigo-400" />
                   </div>
                   <div className="space-y-2">
                     <h4 className="text-white text-xl font-black">{lang === 'ar' ? 'العرض السينمائي التعليمي' : 'Cinema Visualizer'}</h4>
                     <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest">{lang === 'ar' ? 'حوّل محتواك لمقاطع واقعية مذهلة' : 'Realistic cinematic clips'}</p>
                   </div>
                </div>
              )}
           </div>

           <div className="bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] shadow-xl border dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'ar' ? 'محتوى المصدر' : 'Source Content'}</h4>
                {lectureText && <span className="text-[10px] font-black text-emerald-500">{lectureText.length} حرف</span>}
              </div>
              <div className="w-full h-32 p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-bold overflow-y-auto custom-scrollbar leading-relaxed">
                {lectureText || (lang === 'ar' ? "في انتظار رفع ملف PDF أو صورة للبدء..." : "Waiting for file ingest...")}
              </div>
           </div>
        </div>
      </div>
      
      <style>{`
        @keyframes loading-bar {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 70%; transform: translateX(0%); }
          100% { width: 100%; transform: translateX(100%); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};