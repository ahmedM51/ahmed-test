

export interface AIResponse {
  text: string;
  links?: any[];
}

export const getAIResponse = async (
  prompt: string, 
  context: string = "عام", 
  useSearch: boolean = false
): Promise<AIResponse> => {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context, useSearch }),
    });

    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      const msg = typeof data?.error === 'string' ? data.error : 'AI request failed';
      throw new Error(msg);
    }

    return {
      text: data?.text || "عذراً، لم أتمكن من معالجة الطلب حالياً.",
      links: data?.links,
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorStr = error?.message || JSON.stringify(error);
    
    // إذا انتهت الحصة أو هناك مشكلة في المفتاح، نطلب من المستخدم اختيار مفتاح جديد عبر واجهة المنصة
    if (errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("not found")) {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        (window as any).aistudio.openSelectKey();
      }
      return { text: "⚠️ تم استهلاك حصة المفتاح الحالي. جاري محاولة فتح نافذة اختيار مفتاح جديد لمتابعة الدراسة..." };
    }
    
    return { text: "عذراً، واجه المعلم مشكلة تقنية بسيطة. يرجى المحاولة مرة أخرى بعد لحظات." };
  }
};
