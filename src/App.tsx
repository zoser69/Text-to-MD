import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Upload, Copy, Download, Check, Loader2, AlertCircle, Trash2, DownloadCloud } from 'lucide-react';
import { extractTextFromFile } from './lib/fileParser';
import { convertTextToMarkdown } from './lib/gemini';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      setFileName(file.name);
      const text = await extractTextFromFile(file);
      setInputText(text);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء قراءة الملف.');
      setFileName(null);
    }
    
    // Reset input so the same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConvert = async () => {
    if (!inputText.trim()) {
      setError('يرجى إدخال نص أو رفع ملف للتحويل.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setOutputText('');

    try {
      const result = await convertTextToMarkdown(inputText, selectedModel, (p) => setProgress(p));
      setOutputText(result);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء التحويل.');
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('فشل نسخ النص.');
    }
  };

  const handleDownload = () => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName ? fileName.split('.')[0] : 'document') + '_converted.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setInputText('');
    setOutputText('');
    setFileName(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-8">
      
      {/* Header */}
      <header className="text-center space-y-4 pt-8 relative">
        {deferredPrompt && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleInstallClick}
            className="absolute -top-2 left-0 md:left-4 flex items-center gap-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 rounded-full font-bold text-sm transition-colors shadow-sm"
          >
            <DownloadCloud size={18} />
            تثبيت التطبيق
          </motion.button>
        )}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center justify-center p-3 bg-emerald-100 text-emerald-600 rounded-2xl mb-2"
        >
          <FileText size={32} strokeWidth={1.5} />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-extrabold tracking-tight text-stone-900"
        >
          محول ماركداون الذكي
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-stone-500 max-w-2xl mx-auto text-lg"
        >
          قم بتحويل نصوصك وملفاتك إلى صيغة Markdown منسقة بدقة، مع دعم الملفات الكبيرة والتقسيم الذكي.
        </motion.p>
      </header>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="shrink-0" />
            <p className="font-medium">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6 items-stretch flex-1">
        
        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-4 bg-white p-6 rounded-3xl shadow-sm border border-stone-200/60"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-sm">1</span>
              النص الأصلي
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-stone-100 p-1 rounded-lg ml-2" dir="ltr">
                <button
                  onClick={() => setSelectedModel('gemini-2.5-flash')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${selectedModel === 'gemini-2.5-flash' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  Flash 2.5
                </button>
                <button
                  onClick={() => setSelectedModel('gemini-2.5-flash-lite')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${selectedModel === 'gemini-2.5-flash-lite' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  Flash 2.5 Lite
                </button>
                <button
                  onClick={() => setSelectedModel('gemini-3.1-flash-lite-preview')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${selectedModel === 'gemini-3.1-flash-lite-preview' ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  Flash 3.1 Lite
                </button>
              </div>
              {fileName && (
                <span className="text-xs font-medium px-3 py-1 bg-stone-100 text-stone-600 rounded-full truncate max-w-[150px]" dir="ltr">
                  {fileName}
                </span>
              )}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-emerald-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-emerald-50"
              >
                <Upload size={16} />
                رفع ملف
              </button>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt,.md,.docx"
                className="hidden"
              />
            </div>
          </div>
          
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="اكتب أو الصق النص هنا، أو قم برفع ملف (txt, md, docx)..."
            className="flex-1 w-full resize-none bg-stone-50 border-none rounded-2xl p-5 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all text-stone-700 leading-relaxed min-h-[300px]"
          />
          
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={clearAll}
              disabled={!inputText && !outputText}
              className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
              title="مسح الكل"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={handleConvert}
              disabled={isProcessing || !inputText.trim()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  جاري التحويل... {Math.round(progress)}%
                </>
              ) : (
                'تحويل إلى Markdown'
              )}
            </button>
          </div>
        </motion.div>

        {/* Output Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-4 bg-stone-900 p-6 rounded-3xl shadow-xl border border-stone-800"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-sm">2</span>
              النتيجة
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!outputText}
                className="flex items-center gap-2 text-sm font-medium text-stone-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-stone-800 disabled:opacity-50"
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>
              <button
                onClick={handleDownload}
                disabled={!outputText}
                className="flex items-center gap-2 text-sm font-medium text-stone-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-stone-800 disabled:opacity-50"
              >
                <Download size={16} />
                تحميل
              </button>
            </div>
          </div>
          
          <div className="relative flex-1 min-h-[300px]">
            <textarea
              readOnly
              value={outputText}
              placeholder="سيظهر نص Markdown هنا..."
              className="absolute inset-0 w-full h-full resize-none bg-stone-950/50 border border-stone-800 rounded-2xl p-5 focus:outline-none text-stone-300 font-mono text-sm leading-relaxed custom-scrollbar"
              dir="auto"
            />
            
            {/* Processing Overlay */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-4 border border-stone-800"
                >
                  <Loader2 size={40} className="text-emerald-500 animate-spin" />
                  <div className="w-48 h-2 bg-stone-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: "linear", duration: 0.5 }}
                    />
                  </div>
                  <p className="text-stone-400 text-sm font-mono">{Math.round(progress)}%</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
      
      {/* Global styles for custom scrollbar in dark mode textarea */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #44403c;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}
