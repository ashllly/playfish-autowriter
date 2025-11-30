'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceResult, setSourceResult] = useState<any>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [draftResult, setDraftResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Cover Manager State
  const [loadingScan, setLoadingScan] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [processingCovers, setProcessingCovers] = useState(false);
  const [coverProgress, setCoverProgress] = useState({ current: 0, total: 0, success: 0, fail: 0 });
  const [selectedDB, setSelectedDB] = useState<string>('All');
  const [batchLimit, setBatchLimit] = useState<number>(5);
  const [coverLogs, setCoverLogs] = useState<string[]>([]);
  const [coverResults, setCoverResults] = useState<Array<{
    title: string;
    theme: string;
    url?: string;
    error?: string;
  }>>([]);

  // Translation Manager State
  const [loadingTranslationScan, setLoadingTranslationScan] = useState(false);
  const [translationScanResult, setTranslationScanResult] = useState<any>(null);
  const [processingTranslations, setProcessingTranslations] = useState(false);
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0, success: 0, fail: 0 });
  const [translationResults, setTranslationResults] = useState<any[]>([]);
  const [translationLogs, setTranslationLogs] = useState<string[]>([]);

  // SEO Fixer State
  const [loadingSeoFix, setLoadingSeoFix] = useState(false);
  const [seoFixResult, setSeoFixResult] = useState<any>(null);
  const [seoFixTargetDb, setSeoFixTargetDb] = useState<string>('');

  const runSourceRunner = async () => {
    setLoadingSource(true);
    setError(null);
    setSourceResult(null);
    
    try {
      const res = await fetch('/api/runner/source', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        if (data.code === 'insufficient_quota' || res.status === 402) {
          setError(`⚠️ ${data.error || 'OpenAI API 配额不足'}\n\n${data.errorDetails || '请检查你的 OpenAI 账户余额和账单设置。'}`);
        } else {
          setError(data.error || data.message || `HTTP Error: ${res.status}`);
        }
        if (data.data) {
          setSourceResult(data);
        }
      } else {
        setSourceResult(data);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoadingSource(false);
    }
  };

  const runDraftRunner = async () => {
    setLoadingDraft(true);
    setError(null);
    setDraftResult(null);

    try {
      const res = await fetch('/api/runner/draft', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        if (data.code === 'insufficient_quota' || res.status === 402) {
          setError(`⚠️ ${data.error || 'OpenAI API 配额不足'}\n\n${data.errorDetails || '请检查你的 OpenAI 账户余额和账单设置。'}`);
        } else {
          setError(data.error || data.message || `HTTP Error: ${res.status}`);
        }
        if (data.data) {
          setDraftResult(data);
        }
      } else {
        setDraftResult(data);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoadingDraft(false);
    }
  };

  const runScan = async () => {
    setLoadingScan(true);
    setScanResult(null);
    setCoverLogs([]);
    setCoverResults([]);
    setError(null);
    try {
      const res = await fetch('/api/runner/cover-manager');
      const data = await res.json();
      if (data.success) {
        setScanResult(data.data);
      } else {
        setError(data.error || 'Scan failed');
      }
    } catch (err: any) {
      setError(err.message || 'Scan failed');
    } finally {
      setLoadingScan(false);
    }
  };

  const runCoverProcess = async () => {
    if (!scanResult) return;

    setProcessingCovers(true);
    setCoverLogs([]);
    setCoverResults([]);
    
    // 1. Flatten and filter items
    let items: any[] = [];
    if (selectedDB === 'All') {
      items = [...scanResult.Playfish, ...scanResult.FIRE, ...scanResult.Immigrant];
    } else {
      items = scanResult[selectedDB] || [];
    }

    // 2. Limit items
    const tasks = items.slice(0, batchLimit);
    
    setCoverProgress({ current: 0, total: tasks.length, success: 0, fail: 0 });

    // 3. Process loop
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      setCoverProgress(prev => ({ ...prev, current: i + 1 }));
      setCoverLogs(prev => [`Processing [${i + 1}/${tasks.length}]: ${task.title}...`, ...prev]);

      try {
        const res = await fetch('/api/runner/cover-manager', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId: task.id,
            title: task.title,
            blogTheme: task.theme,
            keywords: task.keywords
          })
        });
        const data = await res.json();

        if (data.success) {
          setCoverProgress(prev => ({ ...prev, success: prev.success + 1 }));
          setCoverLogs(prev => [`✅ Success: ${task.title}`, ...prev]);
          setCoverResults(prev => [{ title: task.title, theme: task.theme, url: data.url }, ...prev]);
        } else {
          setCoverProgress(prev => ({ ...prev, fail: prev.fail + 1 }));
          setCoverLogs(prev => [`❌ Failed: ${task.title} - ${data.error}`, ...prev]);
          setCoverResults(prev => [{ title: task.title, theme: task.theme, error: data.error }, ...prev]);
        }
      } catch (err: any) {
        setCoverProgress(prev => ({ ...prev, fail: prev.fail + 1 }));
        setCoverLogs(prev => [`❌ Error: ${task.title} - ${err.message}`, ...prev]);
        setCoverResults(prev => [{ title: task.title, theme: task.theme, error: err.message }, ...prev]);
      }
    }

    setProcessingCovers(false);
    setCoverLogs(prev => [`🎉 Batch Completed!`, ...prev]);
    // Optionally re-scan to update list
    runScan();
  };

  // Translation Functions
  const runTranslationScan = async () => {
    setLoadingTranslationScan(true);
    setTranslationScanResult(null);
    setTranslationLogs([]);
    setTranslationResults([]);
    setError(null);
    try {
      const res = await fetch('/api/runner/translation-manager');
      const data = await res.json();
      if (data.success) {
        setTranslationScanResult(data.data);
      } else {
        setError(data.error || 'Scan failed');
      }
    } catch (err: any) {
      setError(err.message || 'Scan failed');
    } finally {
      setLoadingTranslationScan(false);
    }
  };

  const runTranslationProcess = async (targetLang: 'en' | 'zh-hant' | 'all') => {
    if (!translationScanResult) return;

    setProcessingTranslations(true);
    setTranslationLogs([]);
    setTranslationResults([]);

    const tasks = translationScanResult; 
    
    // Calculate total operations (tasks * langs)
    // Note: This is now "Total Articles", not "Total API Calls"
    let totalArticles = 0;
    tasks.forEach((t: any) => {
      if (targetLang === 'all') totalArticles += t.missingLangs.length;
      else if (t.missingLangs.includes(targetLang)) totalArticles += 1;
    });

    setTranslationProgress({ current: 0, total: totalArticles, success: 0, fail: 0 });

    let currentArticleIdx = 0;

    for (const task of tasks) {
      const langsToProcess = [];
      if (targetLang === 'all') {
        langsToProcess.push(...task.missingLangs);
      } else if (task.missingLangs.includes(targetLang)) {
        langsToProcess.push(targetLang);
      }

      for (const lang of langsToProcess) {
        currentArticleIdx++;
        const logPrefix = `[${currentArticleIdx}/${totalArticles}] ${task.title} -> ${lang}`;
        
        setTranslationLogs(prev => [`${logPrefix}: 🔍 Analyzing...`, ...prev]);

        try {
          // --- Step 1: Analyze ---
          const analyzeRes = await fetch('/api/translation/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourcePageId: task.sourcePageId })
          });
          const analyzeData = await analyzeRes.json();

          if (!analyzeData.success) {
            throw new Error(analyzeData.error || 'Analysis failed');
          }

          const { sourceBlocks, props } = analyzeData.data;
          
          // --- Step 2: Batch Execution ---
          const BATCH_SIZE = 10;
          const totalBatches = Math.ceil(sourceBlocks.length / BATCH_SIZE);
          let newPageId = '';
          let translatedTitle = '';

          for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
            const start = batchIdx * BATCH_SIZE;
            const end = start + BATCH_SIZE;
            const batchBlocks = sourceBlocks.slice(start, end);
            
            const progressPercent = Math.round((batchIdx / totalBatches) * 100);
            setTranslationLogs(prev => {
                // Update top log or add new one? Simpler to add new one for detailed view
                // Or just keep adding to top
                return [`${logPrefix}: 🚀 Processing Batch ${batchIdx + 1}/${totalBatches} (${progressPercent}%)...`, ...prev];
            });

            const batchRes = await fetch('/api/translation/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batchIndex: batchIdx,
                    targetLang: lang,
                    blogTheme: task.blogTheme,
                    blocksBatch: batchBlocks,
                    pageProperties: batchIdx === 0 ? props : undefined,
                    existingPageId: batchIdx > 0 ? newPageId : undefined
                })
            });
            
            const batchData = await batchRes.json();
            if (!batchData.success) {
                throw new Error(`Batch ${batchIdx} failed: ${batchData.error}`);
            }

            if (batchIdx === 0) {
                newPageId = batchData.data.pageId;
                translatedTitle = batchData.data.translatedTitle;
            }
          }

          // --- Step 3: Finalize ---
          setTranslationLogs(prev => [`${logPrefix}: ✨ Finalizing (SEO)...`, ...prev]);
          
          const finalizeRes = await fetch('/api/translation/finalize', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 pageId: newPageId,
                 targetLang: lang,
                 blogTheme: task.blogTheme,
                 translatedTitle: translatedTitle,
                 originalTagSlugs: (props['tag-slug']?.multi_select || []).map((t: any) => t.name)
             })
          });

          const finalizeData = await finalizeRes.json();
          if (!finalizeData.success) {
             throw new Error(`Finalize failed: ${finalizeData.error}`);
          }

          // Success
          setTranslationProgress(prev => ({ ...prev, current: currentArticleIdx, success: prev.success + 1 }));
          setTranslationLogs(prev => [`✅ Success: ${logPrefix}`, ...prev]);
          setTranslationResults(prev => [{ title: task.title, lang: lang, url: `https://notion.so/${newPageId.replace(/-/g, '')}` }, ...prev]);

        } catch (err: any) {
          console.error(err);
          setTranslationProgress(prev => ({ ...prev, current: currentArticleIdx, fail: prev.fail + 1 }));
          setTranslationLogs(prev => [`❌ Error: ${logPrefix} - ${err.message}`, ...prev]);
          setTranslationResults(prev => [{ title: task.title, lang: lang, error: err.message }, ...prev]);
        }
      }
    }

    setProcessingTranslations(false);
    setTranslationLogs(prev => [`🎉 All Tasks Completed!`, ...prev]);
    runTranslationScan(); // Refresh list
  };

  // SEO Fixer Functions
  const runSeoFixer = async () => {
    setLoadingSeoFix(true);
    setError(null);
    setSeoFixResult(null);

    try {
      const url = seoFixTargetDb 
        ? `/api/manual/fix-seo?target=${seoFixTargetDb}`
        : '/api/manual/fix-seo';
      
      const res = await fetch(url, { method: 'GET' });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        setError(data.error || data.message || `HTTP Error: ${res.status}`);
        if (data.data) {
          setSeoFixResult(data);
        }
      } else {
        setSeoFixResult(data);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoadingSeoFix(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gray-900">Playfish AutoWriter Dashboard</h1>
          <p className="text-gray-500 mt-2">Manage and monitor your AI writing automation.</p>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm text-red-700 whitespace-pre-line">
                  {error}
                </p>
                {error.includes('配额') && (
                  <a 
                    href="https://platform.openai.com/account/billing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm text-red-600 underline hover:text-red-800"
                  >
                    前往 OpenAI 账单页面 →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Source Runner Card */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Source Runner
                 </h3>
                 <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                   Stage 1
                 </span>
              </div>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Scans Source DB for new entries without Title/ID and auto-generates them.</p>
              </div>
              <div className="mt-5">
                <button
                  onClick={runSourceRunner}
                  disabled={loadingSource}
                  type="button"
                  className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white 
                    ${loadingSource ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}`}
                >
                  {loadingSource ? 'Running...' : 'Trigger Manually'}
                </button>
              </div>
              {/* Source Result Display */}
              {sourceResult && (
                <div className={`mt-4 rounded-md p-3 border ${sourceResult.warning ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-100'}`}>
                  <p className={`text-sm font-medium ${sourceResult.warning ? 'text-yellow-800' : 'text-green-800'}`}>
                    {sourceResult.warning ? '⚠️ Warning' : '✅ Success'}: {sourceResult.message}
                  </p>
                  {sourceResult.data?.errors && sourceResult.data.errors.length > 0 && (
                     <div className="mt-2 pt-2 border-t border-yellow-200">
                       <ul className="text-xs text-yellow-700 list-disc list-inside">
                         {sourceResult.data.errors.map((err: string, idx: number) => (
                           <li key={idx}>{err}</li>
                         ))}
                       </ul>
                     </div>
                   )}
                </div>
              )}
            </div>
          </div>

          {/* Draft Runner Card */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
            <div className="px-4 py-5 sm:p-6">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Draft Runner
                 </h3>
                 <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                   Stage 2
                 </span>
              </div>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Generates full drafts for sources marked as "Send".</p>
              </div>
              <div className="mt-5">
                <button
                  onClick={runDraftRunner}
                  disabled={loadingDraft}
                  type="button"
                  className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white 
                    ${loadingDraft ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                >
                  {loadingDraft ? 'Running...' : 'Trigger Manually'}
                </button>
              </div>
              {/* Draft Result Display */}
              {draftResult && (
                <div className={`mt-4 rounded-md p-3 border ${draftResult.warning ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-100'}`}>
                  <p className={`text-sm font-medium ${draftResult.warning ? 'text-yellow-800' : 'text-green-800'}`}>
                    {draftResult.warning ? '⚠️ Warning' : '✅ Success'}: {draftResult.message}
                  </p>
                  {/* Detailed results map... */}
                  {draftResult.data?.results?.map((item: any, idx: number) => (
                    <div key={idx} className="mt-2 p-2 bg-white rounded border text-xs">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-gray-500">{item.targetBlog} | DraftID: {item.draftId}</p>
                    </div>
                  ))}
                  {draftResult.data?.errors && draftResult.data.errors.length > 0 && (
                     <div className="mt-2 pt-2 border-t border-yellow-200">
                       <ul className="text-xs text-yellow-700 list-disc list-inside">
                         {draftResult.data.errors.map((err: string, idx: number) => (
                           <li key={idx}>{err}</li>
                         ))}
                       </ul>
                     </div>
                   )}
                </div>
              )}
            </div>
          </div>

          {/* Cover Image Manager Card */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Cover Image Manager
                 </h3>
                 <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                   Stage 3 (Opt)
                 </span>
              </div>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Batch generate cover images.</p>
              </div>
              
              <div className="mt-5 flex items-center gap-4">
                <button
                  onClick={runScan}
                  disabled={loadingScan || processingCovers}
                  type="button"
                  className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 
                    ${loadingScan ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loadingScan ? 'Scanning...' : 'Scan Missing'}
                </button>
              </div>

              {scanResult && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-blue-50 p-2 rounded text-center">
                      <div className="text-xs text-blue-900">Playfish</div>
                      <div className="text-lg font-bold text-blue-600">{scanResult.Playfish.length}</div>
                    </div>
                    <div className="bg-red-50 p-2 rounded text-center">
                      <div className="text-xs text-red-900">FIRE</div>
                      <div className="text-lg font-bold text-red-600">{scanResult.FIRE.length}</div>
                    </div>
                    <div className="bg-purple-50 p-2 rounded text-center">
                      <div className="text-xs text-purple-900">Immigrant</div>
                      <div className="text-lg font-bold text-purple-600">{scanResult.Immigrant.length}</div>
                    </div>
                  </div>

                  {scanResult.total > 0 && (
                    <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                      <div className="flex flex-col gap-3">
                        <select 
                          value={selectedDB} 
                          onChange={(e) => setSelectedDB(e.target.value)}
                          disabled={processingCovers}
                          className="block w-full text-sm border-gray-300 rounded-md"
                        >
                          <option value="All">All Databases</option>
                          <option value="Playfish">Playfish Only</option>
                          <option value="FIRE">FIRE Only</option>
                          <option value="Immigrant">Immigrant Only</option>
                        </select>
                        <select 
                          value={batchLimit} 
                          onChange={(e) => setBatchLimit(Number(e.target.value))}
                          disabled={processingCovers}
                          className="block w-full text-sm border-gray-300 rounded-md"
                        >
                          <option value={1}>1 Image</option>
                          <option value={3}>3 Images</option>
                          <option value={5}>5 Images</option>
                        </select>
                        <button
                          onClick={runCoverProcess}
                          disabled={processingCovers}
                          type="button"
                          className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white 
                            ${processingCovers ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}
                        >
                          {processingCovers ? 'Processing...' : 'Generate Covers'}
                        </button>
                      </div>

                      {processingCovers && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${(coverProgress.current / coverProgress.total) * 100}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-center mt-1 text-gray-500">{coverProgress.current} / {coverProgress.total}</p>
                        </div>
                      )}

                      {/* Results */}
                      {coverResults.length > 0 && (
                        <div className="mt-3 border-t border-gray-200 pt-2">
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {coverResults.map((result, idx) => (
                              <div key={idx} className={`p-1.5 rounded border text-[10px] flex justify-between ${result.error ? 'bg-red-50' : 'bg-green-50'}`}>
                                <span className="truncate w-2/3">{result.title}</span>
                                {result.url ? <a href={result.url} target="_blank" className="text-purple-600">View</a> : <span className="text-red-500">Fail</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Logs */}
                      {coverLogs.length > 0 && (
                        <div className="mt-2 bg-black bg-opacity-90 rounded p-2 h-24 overflow-y-auto text-[10px] font-mono text-green-400">
                          {coverLogs.map((log, i) => (
                            <div key={i} className="border-b border-gray-800 pb-0.5 mb-0.5">{log}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Translation Manager Card (New) */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Translation Manager
                 </h3>
                 <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-teal-100 text-teal-800">
                   Stage 4 (Final)
                 </span>
              </div>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Translate published articles to English and Traditional Chinese.</p>
              </div>
              
              <div className="mt-5 flex items-center gap-4">
                <button
                  onClick={runTranslationScan}
                  disabled={loadingTranslationScan || processingTranslations}
                  type="button"
                  className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 
                    ${loadingTranslationScan ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loadingTranslationScan ? 'Scanning...' : 'Scan Untranslated'}
                </button>
              </div>

              {translationScanResult && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Found {translationScanResult.length} pending articles</span>
                  </div>

                  {translationScanResult.length > 0 && (
                    <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                      <div className="grid grid-cols-1 gap-2 mb-3 max-h-40 overflow-y-auto">
                        {translationScanResult.map((task: any, idx: number) => (
                          <div key={idx} className="bg-white p-2 rounded border text-xs flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="font-medium truncate max-w-[150px]">{task.title}</span>
                              <span className="text-[10px] text-gray-500">{task.blogTheme}</span>
                            </div>
                            <div className="flex gap-1">
                              {task.missingLangs.includes('en') && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded text-[10px]">No EN</span>}
                              {task.missingLangs.includes('zh-hant') && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded text-[10px]">No ZHT</span>}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => runTranslationProcess('en')}
                          disabled={processingTranslations}
                          type="button"
                          className={`flex-1 inline-flex justify-center items-center px-2 py-2 border border-transparent shadow-sm text-xs font-medium rounded-md text-white 
                            ${processingTranslations ? 'bg-teal-400' : 'bg-teal-600 hover:bg-teal-700'}`}
                        >
                          Translate EN
                        </button>
                        <button
                          onClick={() => runTranslationProcess('zh-hant')}
                          disabled={processingTranslations}
                          type="button"
                          className={`flex-1 inline-flex justify-center items-center px-2 py-2 border border-transparent shadow-sm text-xs font-medium rounded-md text-white 
                            ${processingTranslations ? 'bg-teal-400' : 'bg-teal-600 hover:bg-teal-700'}`}
                        >
                          Translate ZHT
                        </button>
                        <button
                          onClick={() => runTranslationProcess('all')}
                          disabled={processingTranslations}
                          type="button"
                          className={`flex-1 inline-flex justify-center items-center px-2 py-2 border border-transparent shadow-sm text-xs font-medium rounded-md text-white 
                            ${processingTranslations ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                          Translate ALL
                        </button>
                      </div>

                      {processingTranslations && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-teal-600 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${(translationProgress.current / translationProgress.total) * 100}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-center mt-1 text-gray-500">{translationProgress.current} / {translationProgress.total}</p>
                        </div>
                      )}

                      {/* Results */}
                      {translationResults.length > 0 && (
                        <div className="mt-3 border-t border-gray-200 pt-2">
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {translationResults.map((result, idx) => (
                              <div key={idx} className={`p-1.5 rounded border text-[10px] flex justify-between ${result.error ? 'bg-red-50' : 'bg-green-50'}`}>
                                <span className="truncate w-2/3">{result.title} ({result.lang})</span>
                                {result.url ? <a href={result.url} target="_blank" className="text-teal-600">View</a> : <span className="text-red-500">Fail</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Logs */}
                      {translationLogs.length > 0 && (
                        <div className="mt-2 bg-black bg-opacity-90 rounded p-2 h-24 overflow-y-auto text-[10px] font-mono text-green-400">
                          {translationLogs.map((log, i) => (
                            <div key={i} className="border-b border-gray-800 pb-0.5 mb-0.5">{log}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {translationScanResult.length === 0 && (
                    <div className="text-center py-4 text-sm text-gray-500">
                      🎉 All articles translated!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SEO Fixer Runner Card */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg leading-6 font-medium text-gray-900">
                  SEO Fixer Runner
                 </h3>
                 <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                   Maintenance
                 </span>
              </div>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Fix missing SEO metadata (Slug, Description, Keywords, Tags, IDs, Cover) for existing articles.</p>
              </div>
              
              <div className="mt-5 flex flex-col gap-3">
                <select 
                  value={seoFixTargetDb} 
                  onChange={(e) => setSeoFixTargetDb(e.target.value)}
                  disabled={loadingSeoFix}
                  className="block w-full text-sm border-gray-300 rounded-md"
                >
                  <option value="">All Databases</option>
                  <option value="Playfish">Playfish Only</option>
                  <option value="FIRE">FIRE Only</option>
                  <option value="Immigrant">Immigrant Only</option>
                </select>
                <button
                  onClick={runSeoFixer}
                  disabled={loadingSeoFix}
                  type="button"
                  className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white 
                    ${loadingSeoFix ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500'}`}
                >
                  {loadingSeoFix ? 'Running...' : 'Fix Missing SEO'}
                </button>
              </div>

              {/* SEO Fix Result Display */}
              {seoFixResult && (
                <div className={`mt-4 rounded-md p-3 border ${seoFixResult.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'}`}>
                  <p className={`text-sm font-medium ${seoFixResult.error ? 'text-red-800' : 'text-green-800'}`}>
                    {seoFixResult.error 
                      ? `❌ Error: ${seoFixResult.error}` 
                      : `✅ Scan Complete: Found ${seoFixResult.data?.scannedCount || 0} pages, Processed ${seoFixResult.data?.processed || 0} pages`
                    }
                  </p>
                  
                  {/* Detailed Logs */}
                  {seoFixResult.data?.logs && seoFixResult.data.logs.length > 0 && (
                    <div className="mt-3 mb-3 bg-black bg-opacity-90 rounded p-2 h-32 overflow-y-auto text-[10px] font-mono text-green-400">
                      {seoFixResult.data.logs.map((log: string, i: number) => (
                        <div key={i} className="border-b border-gray-800 pb-0.5 mb-0.5">{log}</div>
                      ))}
                    </div>
                  )}

                  {seoFixResult.data?.results && seoFixResult.data.results.length > 0 ? (
                    <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                      {seoFixResult.data.results.map((item: any, idx: number) => (
                        <div key={idx} className={`p-2 rounded border text-xs ${item.error ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                          <p className="font-medium">{item.title}</p>
                          {item.fixes && item.fixes.length > 0 && (
                            <p className="text-gray-600 mt-1">Fixed: {item.fixes.join(', ')}</p>
                          )}
                          {item.error && (
                            <p className="text-red-600 mt-1">Error: {item.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !seoFixResult.error && (
                      <div className="mt-2 text-xs text-gray-500 italic">
                        No pages required fixing. All metadata looks good!
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
