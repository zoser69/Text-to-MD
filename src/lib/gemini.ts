import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("مفتاح API الخاص بـ Gemini غير موجود. يرجى إضافته في إعدادات البيئة (Environment Variables).");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

const SYSTEM_INSTRUCTION = `أنت محول النصوص لصيغة markdown مخصوصة لاداة معينة.

أريدك أن تكتب الرد بتنسيق **Markdown Code** فقط وبدون أي حذف او تغيير للمحتوي، مع الالتزام الصارم بالقواعد التنسيقية التالية ليتناسب مع أداتي:

1. **العنوان الرئيسي او الأبواب:** استخدم رمز شباك واحد \`#\` للعنوان الرئيسي او الاسئلة للمذكرة.
2. **العناوين الفرعية او الأقسام او التمهيد والاسئلة والمقدمة والفصول والمباحث والاجزاء والمواضيع:** استخدم رمزين شباك \`##\` (هذا سيجعل لونه زمردي مع خط جانبي).
3. **الملاحظات الهامة:** أي معلومة مهمة، تريكة امتحان، أو تنبيه، ضعها داخل علامة الاقتباس \`>\` (هذا سيضعها داخل الصندوق الرمادي المميز).
4. **الجداول:** استخدم الجداول للمقارنات فقط عند الحاجة او اذا كان يوجد جدول في النص المعطي (لا تكثر من استخدام الجداول ويكون مع الاشياء الصغيرة فقط لكي لا يكون الجدول محشوا ولا تختصر عند انشاء جداول).
5. **القوائم:** استخدم النجمة \`*\` للنقاط العادية.
6. **العناوين الثانوية تحت الفرعية:** استخدم \`###\`.
7. **الكلمات المهمة او للهايلايت او للعناوين الثانوية والعناصر:** استخدم النجمتين \`**\`.
8. **استخدام 4 هاشتاج او أكثر يكون قليلا وعند الضرورة او كثرة التقسيمات**.
9. **اذا كان للباب او المبحث او القسم اسم:** الصقه به بعد \`:\`، مثال: الباب الأول: الإنتاجية.

القاعدة الاساسية : ممنوع الحذف او التعديل. أعد إرسال النص المعطى كاملاً بتنسيق ماركداون فقط دون أي مقدمات أو خاتمات.`;

/**
 * Chunks text into smaller pieces to avoid hallucination limits.
 * We use 25,000 characters as a safe chunk size.
 */
export function chunkText(text: string, maxChars = 25000): string[] {
  const chunks: string[] = [];
  // Split by double newlines to keep paragraphs intact
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const p of paragraphs) {
    // If a single paragraph is larger than maxChars, split it further by single newlines
    if (p.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      const lines = p.split(/\n/);
      for (const line of lines) {
        if ((currentChunk.length + line.length) > maxChars && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    } else {
      if ((currentChunk.length + p.length) > maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      currentChunk += (currentChunk ? '\n\n' : '') + p;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

export interface ConvertOptions {
  thinkingEnabled?: boolean;
  thinkingTokens?: number;
  thinkingLevel?: string;
}

export async function convertTextToMarkdown(
  text: string,
  modelName: string,
  options?: ConvertOptions,
  onProgress?: (progress: number) => void
): Promise<string> {
  const chunks = chunkText(text);
  let fullMarkdown = '';

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isFirst = i === 0;
    const isLast = i === chunks.length - 1;
    
    // Extract last 600 characters from the previous chunk for context
    const previousContext = !isFirst ? chunks[i - 1].slice(-600) : '';
    
    // Provide intelligent context to the model to ensure seamless merging
    const contextPrompt = `هذا هو الجزء رقم ${i + 1} من أصل ${chunks.length} من النص الكامل.
${!isFirst ? `
--- سياق من نهاية الجزء السابق (للفهم والربط فقط - **ممنوع منعاً باتاً تكراره أو تضمينه في مخرجاتك**): ---
${previousContext}
---------------------------------------------------------
تنبيه هام: الجزء التالي هو تكملة مباشرة للسياق أعلاه. استمر في التنسيق دون وضع عناوين رئيسية (#) أو فرعية (##) إلا إذا كانت موجودة فعلياً في النص الجديد، ولا تضع مقدمات.
` : ''}
${!isLast ? 'تنبيه: هناك أجزاء أخرى ستتبع هذا الجزء، يرجى عدم وضع خاتمة.' : ''}

قم بتحويل النص التالي بناءً على التعليمات:

${chunk}`;

    try {
      const ai = getAiClient();
      
      const config: any = {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1, // Low temperature for strict formatting and minimal hallucination
      };

      if (modelName.includes('3.1')) {
        if (options?.thinkingLevel) {
          config.thinkingConfig = { thinkingLevel: options.thinkingLevel };
        }
      } else if (modelName.includes('2.5')) {
        if (options?.thinkingEnabled && options?.thinkingTokens) {
          config.thinkingConfig = { thinkingBudgetTokens: options.thinkingTokens };
        }
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: contextPrompt,
        config
      });
      
      let output = response.text || '';
      // Remove markdown code block wrappers if the model adds them
      output = output.replace(/^```markdown\n?/i, '').replace(/\n?```$/i, '');
      
      fullMarkdown += (fullMarkdown ? '\n\n' : '') + output;
      
      if (onProgress) {
        onProgress(((i + 1) / chunks.length) * 100);
      }
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error);
      throw new Error(`حدث خطأ أثناء معالجة الجزء ${i + 1} من النص.`);
    }
  }

  return fullMarkdown;
}
