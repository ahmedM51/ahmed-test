
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Pen, Eraser, Highlighter, Type, Square, Wand2, 
  Undo2, Trash2, Image as ImageIcon,
  Users, ChevronLeft, ChevronRight, 
  FilePlus, X, CheckCircle2, Share2, Printer, Lock, Unlock,
  Circle, StickyNote, Upload, FileText, RefreshCcw as RefreshIcon, Loader2,
  Download, Cloud, Link as LinkIcon, Copy, Sparkles
} from 'lucide-react';
import { db, supabase } from '../services/db';
import { translations } from '../i18n';
import { CONFIG } from '../services/config';

const COLORS = ['#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#000000'];
const VIRTUAL_WIDTH = 2000;
const VIRTUAL_HEIGHT = 1500;

export const Blackboard: React.FC<{ lang?: 'ar' | 'en' }> = ({ lang = 'ar' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);

  const [tool, setTool] = useState('pen');
  const [settings, setSettings] = useState({ color: '#ffffff', thickness: 4 });
  const [theme, setTheme] = useState<'green' | 'black' | 'white'>('green');
  
  const [pages, setPages] = useState<string[]>(['']);
  const [currentPage, setPage] = useState(0);
  
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPageNum, setPdfPageNum] = useState(1);
  const [isPdfMode, setIsPdfMode] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  const [roomId, setRoomId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const [textInput, setTextInput] = useState<{ x: number, y: number, value: string, isSticky?: boolean } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // Safe URL Hash Update
  const updateUrlHash = (id: string) => {
    try {
      // استخدام hash بدلاً من replaceState لتجنب أخطاء SecurityError في البيئات المقيدة
      window.location.hash = `room=${id}`;
    } catch (e) {
      console.warn("Could not update URL hash automatically, this is normal in some environments.");
    }
  };

  const currentPageRef = useRef(0);
  const pagesRef = useRef<string[]>(['']);

  const captureSnapshot = (quality: number = 0.5) => {
    if (!canvasRef.current) return '';
    // JPEG is significantly smaller than PNG for photos / PDF renders.
    // Smaller payloads are less likely to be dropped by realtime broadcast size limits.
    return canvasRef.current.toDataURL('image/jpeg', quality);
  };

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  // Connect to room function
  const connectToRoom = useCallback(async (id: string) => {
    if (!id.trim()) return;
    
    // Clean up previous connection
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Load initial data from DB
    const session = await db.getBlackboardSession(id);
    if (session && session.data && Array.isArray(session.data)) {
      setPages(session.data);
    }
    
    const channel = supabase.channel(`whiteboard:${id}`, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'draw' }, ({ payload }) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (payload.type === 'image') {
        setPages(prev => {
          const updated = [...prev];
          const pageIdx = payload.pageIndex !== undefined ? payload.pageIndex : currentPageRef.current;
          updated[pageIdx] = payload.data;
          return updated;
        });
      } else if (payload.type === 'path' && ctx) {
        if (payload.pageIndex === currentPageRef.current) {
          ctx.save();
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.lineWidth = payload.thickness * (VIRTUAL_WIDTH / 800);
          ctx.strokeStyle = payload.color;
          ctx.globalAlpha = payload.tool === 'highlighter' ? 0.35 : 1;
          
          if (payload.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = payload.thickness * 6 * (VIRTUAL_WIDTH / 800);
          } else {
            ctx.globalCompositeOperation = 'source-over';
          }

          ctx.beginPath();
          ctx.moveTo(payload.start.x, payload.start.y);
          ctx.lineTo(payload.end.x, payload.end.y);
          ctx.stroke();
          ctx.restore();
        }
      } else if (payload.type === 'clear') {
        setPages(prev => {
          const updated = [...prev];
          const pageIdx = payload.pageIndex !== undefined ? payload.pageIndex : currentPageRef.current;
          updated[pageIdx] = '';
          return updated;
        });
      }
    }).on('broadcast', { event: 'page-nav' }, ({ payload }) => {
      if (payload.pageIndex !== undefined) {
        setPage(payload.pageIndex);
      }
    }).on('broadcast', { event: 'page-add' }, () => {
      setPages(prev => [...prev, '']);
    }).on('broadcast', { event: 'sync-request' }, () => {
      // Someone joined, send them our current state
      if (canvasRef.current) {
        const data = captureSnapshot(0.4);
        channel.send({
          type: 'broadcast',
          event: 'draw',
          payload: { type: 'image', data, pageIndex: currentPageRef.current }
        });
      }
    }).subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setRoomId(id);
        setIsConnected(true);
        setShowSessionModal(false);
        updateUrlHash(id);
        // Request current state from others
        channel.send({
          type: 'broadcast',
          event: 'sync-request',
          payload: {}
        });
      }
    });

    channelRef.current = channel;
  }, []); // Removed dependencies to prevent constant resubscription

  // Handle URL Room Auto-Join
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const urlRoom = params.get('room') || hashParams.get('room');
    
    if (urlRoom && !isConnected) {
      connectToRoom(urlRoom);
    }
  }, [connectToRoom, isConnected]);

  const broadcastPageNav = (index: number) => {
    if (isConnected && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'page-nav',
        payload: { pageIndex: index }
      });
    }
  };

  const broadcastPageAdd = () => {
    if (isConnected && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'page-add',
        payload: {}
      });
    }
  };

  const broadcastDraw = useCallback((isClear = false, pathData?: any) => {
    if (isConnected && channelRef.current) {
      try {
        if (isClear) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'draw',
            payload: { type: 'clear', pageIndex: currentPageRef.current }
          });
        } else if (pathData) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'draw',
            payload: { 
              type: 'path', 
              ...pathData,
              pageIndex: currentPageRef.current
            }
          });
        } else if (canvasRef.current) {
          // Full sync (only on request or page change)
          const data = captureSnapshot(0.35);
          channelRef.current.send({
            type: 'broadcast',
            event: 'draw',
            payload: { 
              type: 'image', 
              data,
              pageIndex: currentPageRef.current
            }
          });
        }
      } catch (e) {
        console.error("Broadcast failed:", e);
      }
    }
  }, [isConnected]);

  // Initialize with High-DPI support and Virtual Resolution
  const initCanvas = useCallback(() => {
    if (!containerRef.current || !canvasRef.current || !tempRef.current) return;
    
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const temp = tempRef.current;
    
    const rect = container.getBoundingClientRect();
    
    // Set display size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    temp.style.width = `${rect.width}px`;
    temp.style.height = `${rect.height}px`;
    
    // Set internal resolution to virtual size
    canvas.width = VIRTUAL_WIDTH;
    canvas.height = VIRTUAL_HEIGHT;
    temp.width = VIRTUAL_WIDTH;
    temp.height = VIRTUAL_HEIGHT;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
    }
    
    redrawCurrentPage();
  }, [currentPage, pages, theme]);

  useEffect(() => {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    
    if (!(window as any).pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
    return () => {
        window.removeEventListener('resize', initCanvas);
    };
  }, [initCanvas]);

  // Redraw when pages or theme changes
  useEffect(() => {
    redrawCurrentPage();
  }, [currentPage, pages, theme]);

  const redrawCurrentPage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    
    ctx.fillStyle = theme === 'green' ? '#064e3b' : theme === 'black' ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (pages[currentPage]) {
      const img = new Image();
      img.src = pages[currentPage];
      img.onload = () => {
        ctx.drawImage(img, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      };
    }
  };

  const persistToCloud = async (updatedPages: string[]) => {
    if (roomId) {
      await db.updateBlackboardData(roomId, updatedPages);
    }
  };

  const saveCurrentState = () => {
    if (!canvasRef.current) return;
    const updatedPages = [...pages];
    updatedPages[currentPage] = captureSnapshot(0.6);
    setPages(updatedPages);
    broadcastDraw();
    persistToCloud(updatedPages);
  };

  const generateInviteLink = () => {
    // الحصول على الرابط الأساسي بدون الـ hash القديم
    const baseUrl = window.location.href.split('#')[0].split('?')[0];
    const inviteUrl = `${baseUrl}#room=${roomId}`;
    
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }).catch(err => {
      alert(lang === 'ar' ? `الكود الخاص بك هو: ${roomId}` : `Your room code is: ${roomId}`);
    });
  };

  const generateRandomCode = async () => {
    try {
      const session = await db.createBlackboardSession();
      if (session && session.id) {
        setRoomId(session.id);
        connectToRoom(session.id);
      }
    } catch (e) {
      // Fallback to random code if DB fails
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomId(code);
      connectToRoom(code);
    }
  };

  const getPos = (e: any) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Map client coordinates to virtual coordinates
    return {
      x: (clientX - rect.left) * (VIRTUAL_WIDTH / rect.width),
      y: (clientY - rect.top) * (VIRTUAL_HEIGHT / rect.height)
    };
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        
        const hRatio = VIRTUAL_WIDTH / img.width;
        const vRatio = VIRTUAL_HEIGHT / img.height;
        const ratio = Math.min(hRatio, vRatio);
        const centerShift_x = (VIRTUAL_WIDTH - img.width * ratio) / 2;
        const centerShift_y = (VIRTUAL_HEIGHT - img.height * ratio) / 2;
        ctx.drawImage(img, 0, 0, img.width, img.height,
                           centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
        saveCurrentState();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const renderPdfPage = async (doc: any, num: number) => {
    try {
      setIsRendering(true);
      const page = await doc.getPage(num);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const viewport = page.getViewport({ scale: 3.0 }); 
      const renderCanvas = document.createElement('canvas');
      const renderCtx = renderCanvas.getContext('2d')!;
      renderCanvas.height = viewport.height;
      renderCanvas.width = viewport.width;

      await page.render({ canvasContext: renderCtx, viewport }).promise;
      
      ctx.fillStyle = theme === 'green' ? '#064e3b' : theme === 'black' ? '#0f172a' : '#ffffff';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.drawImage(renderCanvas, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      saveCurrentState();
    } catch (err) {
      console.error("PDF HD Render Error:", err);
    } finally {
      setIsRendering(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const pdfjs = (window as any).pdfjsLib;
      if (!pdfjs) return alert("جاري تحميل محرك الـ PDF...");
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(doc);
      setPdfPageNum(1);
      setIsPdfMode(true);
      await renderPdfPage(doc, 1);
    } catch (err) { alert("خطأ في قراءة ملف الـ PDF"); }
    e.target.value = '';
  };

  const startDraw = (e: any) => {
    const pos = getPos(e);
    setStartPos(pos);
    
    if (tool === 'text' || tool === 'sticky') {
      setTextInput({ ...pos, value: '', isSticky: tool === 'sticky' });
      return;
    }

    setIsDrawing(true);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const drawingAction = (e: any) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    const tCtx = tempRef.current!.getContext('2d')!;
    const rect = tempRef.current!.getBoundingClientRect();

    if (tool === 'pen' || tool === 'eraser' || tool === 'highlighter') {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = settings.thickness * (VIRTUAL_WIDTH / 800); // Scale thickness
      ctx.strokeStyle = settings.color;
      ctx.globalAlpha = tool === 'highlighter' ? 0.35 : 1;
      
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = settings.thickness * 6 * (VIRTUAL_WIDTH / 800);
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      // Broadcast path segment
      broadcastDraw(false, {
        tool,
        color: settings.color,
        thickness: settings.thickness,
        start: startPos,
        end: pos
      });

      setStartPos(pos);
    } else if (tool === 'rect' || tool === 'circle') {
      tCtx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      tCtx.strokeStyle = settings.color;
      tCtx.lineWidth = settings.thickness * (VIRTUAL_WIDTH / 800);
      tCtx.beginPath();
      if (tool === 'rect') {
        tCtx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
      } else {
        const radius = Math.sqrt(Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2));
        tCtx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        tCtx.stroke();
      }
    }
  };

  const stopDraw = (e: any) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    const tCtx = tempRef.current!.getContext('2d')!;

    if (tool === 'rect' || tool === 'circle') {
      tCtx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      ctx.strokeStyle = settings.color;
      ctx.lineWidth = settings.thickness * (VIRTUAL_WIDTH / 800);
      ctx.beginPath();
      if (tool === 'rect') {
        ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
      } else {
        const radius = Math.sqrt(Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2));
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
    saveCurrentState();
  };

  const handleAddText = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && textInput && textInput.value.trim() !== '') {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        if (textInput.isSticky) {
          ctx.save();
          ctx.fillStyle = '#fef08a';
          ctx.shadowColor = 'rgba(0,0,0,0.25)';
          ctx.shadowBlur = 20;
          ctx.fillRect(textInput.x - 110, textInput.y - 110, 220, 220);
          ctx.restore();
          
          ctx.fillStyle = '#1e293b';
          ctx.font = 'bold 18px Cairo';
          ctx.textAlign = 'center';
          const words = textInput.value.split(' ');
          let line = '';
          let y = textInput.y - 40;
          for(let n = 0; n < words.length; n++) {
            line += words[n] + ' ';
            if (line.length > 20) {
              ctx.fillText(line, textInput.x, y);
              line = ''; y += 25;
            }
          }
          ctx.fillText(line, textInput.x, y);
        } else {
          ctx.font = `bold ${settings.thickness * 7}px Cairo`;
          ctx.fillStyle = settings.color;
          ctx.textAlign = lang === 'ar' ? 'right' : 'left';
          ctx.fillText(textInput.value, textInput.x, textInput.y);
        }
        saveCurrentState();
      }
      setTextInput(null);
    } else if (e.key === 'Escape') {
      setTextInput(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] bg-slate-100 dark:bg-slate-900 rounded-5xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 font-cairo">
      {/* Precision Toolbar */}
      <div className="h-20 bg-white dark:bg-slate-800 border-b flex items-center justify-between px-8 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl gap-1">
            {[
              { id: 'pen', icon: Pen, label: 'قلم' },
              { id: 'highlighter', icon: Highlighter, label: 'تحديد' },
              { id: 'eraser', icon: Eraser, label: 'ممحاة' },
              { id: 'rect', icon: Square, label: 'مربع' },
              { id: 'circle', icon: Circle, label: 'دائرة' },
              { id: 'sticky', icon: StickyNote, label: 'بوست' },
              { id: 'text', icon: Type, label: 'نص' }
            ].map(t => (
              <button key={t.id} onClick={() => setTool(t.id)} className={`p-2.5 rounded-xl transition-all ${tool === t.id ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'text-slate-400 hover:text-indigo-600'}`} title={t.label}>
                <t.icon size={20} />
              </button>
            ))}
            <div className="w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
            <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl text-emerald-500 hover:bg-emerald-50" title="رفع صورة">
              <ImageIcon size={20} /><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </button>
            <button onClick={() => pdfInputRef.current?.click()} className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50" title="رفع ملف PDF">
              <FileText size={20} /><input type="file" ref={pdfInputRef} className="hidden" accept=".pdf" onChange={handlePdfUpload} />
            </button>
          </div>

          <div className="flex items-center gap-2 ml-4">
            {COLORS.map(c => (
              <button key={c} onClick={() => setSettings({ ...settings, color: c })} className={`w-8 h-8 rounded-full border-2 transition-all ${settings.color === c ? 'border-indigo-600 scale-125 shadow-md' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
            <input type="range" min="1" max="60" value={settings.thickness} onChange={(e) => setSettings({ ...settings, thickness: parseInt(e.target.value) })} className="w-24 accent-indigo-600 ml-4" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isRendering && <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] animate-pulse"><Loader2 className="animate-spin" size={14}/> HD RENDERING...</div>}
          
          {isConnected && (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-1.5 rounded-2xl border border-emerald-100 shadow-sm animate-in fade-in">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
               <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-2">غرفة: {roomId}</span>
               <button onClick={() => {
                 if (channelRef.current) {
                   channelRef.current.send({ type: 'broadcast', event: 'sync-request', payload: {} });
                   alert(lang === 'ar' ? "تم إرسال طلب مزامنة للجميع" : "Sync request sent to everyone");
                 }
               }} className="p-2 text-indigo-600 hover:bg-white rounded-lg" title="تحديث المزامنة">
                 <RefreshIcon size={16} />
               </button>
               <button onClick={generateInviteLink} className={`p-2 rounded-lg transition-all ${copyFeedback ? 'bg-emerald-500 text-white' : 'text-emerald-600 hover:bg-white'}`} title="نسخ رابط الدعوة">
                  {copyFeedback ? <CheckCircle2 size={16}/> : <Share2 size={16}/>}
               </button>
            </div>
          )}
          
          {isPdfMode && (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/40 px-4 py-2 rounded-2xl border border-indigo-100 shadow-sm">
               <button onClick={() => { const n = Math.max(1, pdfPageNum-1); setPdfPageNum(n); renderPdfPage(pdfDoc, n); }} className="text-indigo-600 hover:bg-white p-1 rounded-lg"><ChevronRight size={20}/></button>
               <span className="text-xs font-black text-indigo-600 mx-2 min-w-[6rem] text-center">صفحة {pdfPageNum} من {pdfDoc?.numPages}</span>
               <button onClick={() => { const n = Math.min(pdfDoc.numPages, pdfPageNum+1); setPdfPageNum(n); renderPdfPage(pdfDoc, n); }} className="text-indigo-600 hover:bg-white p-1 rounded-lg"><ChevronLeft size={20}/></button>
            </div>
          )}
          <button onClick={() => { if(isPdfMode) renderPdfPage(pdfDoc, pdfPageNum); else { setPages(prev => { const u = [...prev]; u[currentPage] = ''; return u; }); broadcastDraw(true); } }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={20} /></button>
          <button onClick={() => setShowSessionModal(true)} className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all ${isConnected ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-100 text-slate-600'}`}>
            <Users size={18} className="inline ml-2" /> {isConnected ? `تبديل الغرفة` : 'مشاركة السبورة'}
          </button>
        </div>
      </div>

      {/* Main High-DPI Workspace */}
      <div ref={containerRef} className="flex-1 relative cursor-crosshair overflow-hidden touch-none select-none bg-slate-200">
        <canvas ref={canvasRef} className="absolute inset-0 z-10" onMouseDown={startDraw} onMouseMove={drawingAction} onMouseUp={stopDraw} onTouchStart={startDraw} onTouchMove={drawingAction} onTouchEnd={stopDraw} />
        <canvas ref={tempRef} className="absolute inset-0 z-20 pointer-events-none" />
        
        {/* Floating Input for Text and Sticky Notes */}
        {textInput && (
          <div className="absolute z-[100] animate-in zoom-in duration-200" style={{ 
            left: textInput.x * (containerRef.current?.getBoundingClientRect().width || 1) / VIRTUAL_WIDTH, 
            top: (textInput.y - (textInput.isSticky ? 60 : 30)) * (containerRef.current?.getBoundingClientRect().height || 1) / VIRTUAL_HEIGHT 
          }}>
            <input 
              autoFocus 
              value={textInput.value} 
              onChange={e => setTextInput({...textInput, value: e.target.value})} 
              onKeyDown={handleAddText}
              onBlur={() => { if(textInput.value === '') setTextInput(null); }}
              className={`${textInput.isSticky ? 'bg-[#fef08a] text-black w-[220px] h-[60px] text-center shadow-2xl border-none' : 'bg-white/95 border-4 border-indigo-600 rounded-2xl px-6 py-4 min-w-[280px] text-xl'} font-black outline-none`}
              placeholder={lang === 'ar' ? 'اكتب ملاحظتك واضغط Enter...' : 'Type note and Enter...'}
              style={{ color: textInput.isSticky ? '#1e293b' : settings.color }}
            />
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="h-16 bg-white dark:bg-slate-800 border-t flex items-center justify-between px-10 z-30">
        <div className="flex gap-3">
          {['green', 'black', 'white'].map((t: any) => (
            <button key={t} onClick={() => setTheme(t)} className={`w-8 h-8 rounded-full border-2 ${theme === t ? 'border-indigo-600 scale-110 shadow-lg' : 'border-slate-200'}`} style={{ backgroundColor: t === 'green' ? '#064e3b' : t === 'black' ? '#0f172a' : '#fff' }} />
          ))}
        </div>

        <div className="flex items-center gap-5 bg-slate-50 dark:bg-slate-900 px-8 py-2 rounded-2xl border dark:border-slate-700 shadow-inner font-black text-sm">
          <button onClick={() => { saveCurrentState(); const next = Math.max(0, currentPage - 1); setPage(next); broadcastPageNav(next); }} disabled={currentPage === 0} className="text-slate-400 hover:text-indigo-600 transition-colors"><ChevronRight size={22}/></button>
          <span className="dark:text-white min-w-[3rem] text-center">{currentPage + 1} / {pages.length}</span>
          <button onClick={() => { saveCurrentState(); const next = Math.min(pages.length - 1, currentPage + 1); setPage(next); broadcastPageNav(next); }} disabled={currentPage === pages.length - 1} className="text-slate-400 hover:text-indigo-600 transition-colors"><ChevronLeft size={22}/></button>
          <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-2"></div>
          <button onClick={() => { saveCurrentState(); setPages(prev => [...prev, '']); setPage(pages.length); setIsPdfMode(false); broadcastPageAdd(); }} className="text-indigo-600 hover:scale-125 transition-all"><FilePlus size={22}/></button>
        </div>

        <div className="flex gap-3">
           <button onClick={() => { const a = document.createElement('a'); a.download = `Blackboard_Export_HD.png`; a.href = canvasRef.current!.toDataURL('image/png', 1.0); a.click(); }} className="px-8 py-2.5 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-black hover:bg-indigo-50 transition-all border dark:border-slate-700">حفظ كصورة</button>
           <button onClick={() => window.print()} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black shadow-lg flex items-center gap-2 hover:bg-indigo-700"><Printer size={16}/> طباعة</button>
        </div>
      </div>

      {/* Collaboration Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative border border-white/10">
              <button onClick={() => setShowSessionModal(false)} className="absolute top-8 left-8 text-slate-400 hover:text-rose-500 transition-all"><X size={28}/></button>
              <h3 className="text-2xl font-black text-center mb-10">المشاركة الحية</h3>
              
              <div className="space-y-6">
                <button onClick={generateRandomCode} className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3">
                  <Sparkles size={24}/> إنشاء غرفة جديدة
                </button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-900 px-4 text-slate-400 font-black">أو انضم بكود</span></div>
                </div>

                <div className="flex gap-2">
                  <input value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} placeholder="الكود..." className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black text-center text-lg tracking-widest" />
                  <button onClick={() => connectToRoom(roomId)} className="px-8 py-4 bg-slate-100 hover:bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm transition-all border border-indigo-100">دخول</button>
                </div>
              </div>
              
              <p className="text-[10px] text-slate-400 text-center mt-8 font-black uppercase">شارك الرابط مع أصدقائك للرسم معاً في نفس اللحظة</p>
           </div>
        </div>
      )}
    </div>
  );
};
