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

          {/* Cover Image Manager Card (New) */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100 md:col-span-2">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Cover Image Manager
                 </h3>
                 <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                   Stage 3 (Optional)
                 </span>
              </div>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Scan for articles missing cover images and batch generate them using DALL-E 3.</p>
              </div>
              
              <div className="mt-5 flex items-center gap-4">
                <button
                  onClick={runScan}
                  disabled={loadingScan || processingCovers}
                  type="button"
                  className={`inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 
                    ${loadingScan ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loadingScan ? 'Scanning...' : 'Scan Missing Covers'}
                </button>
              </div>

              {scanResult && (
                <div className="mt-6 border-t border-gray-100 pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <div className="text-sm font-medium text-blue-900">Playfish</div>
                      <div className="text-2xl font-bold text-blue-600">{scanResult.Playfish.length}</div>
                      <div className="text-xs text-blue-500">Missing</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg text-center">
                      <div className="text-sm font-medium text-red-900">FIRE</div>
                      <div className="text-2xl font-bold text-red-600">{scanResult.FIRE.length}</div>
                      <div className="text-xs text-red-500">Missing</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg text-center">
                      <div className="text-sm font-medium text-purple-900">Immigrant</div>
                      <div className="text-2xl font-bold text-purple-600">{scanResult.Immigrant.length}</div>
                      <div className="text-xs text-purple-500">Missing</div>
                    </div>
                  </div>

                  {scanResult.total > 0 && (
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Batch Processing Config</h4>
                      <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Target Database</label>
                          <select 
                            value={selectedDB} 
                            onChange={(e) => setSelectedDB(e.target.value)}
                            disabled={processingCovers}
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-md"
                          >
                            <option value="All">All Databases</option>
                            <option value="Playfish">Playfish Only</option>
                            <option value="FIRE">FIRE Only</option>
                            <option value="Immigrant">Immigrant Only</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Batch Limit</label>
                          <select 
                            value={batchLimit} 
                            onChange={(e) => setBatchLimit(Number(e.target.value))}
                            disabled={processingCovers}
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-md"
                          >
                            <option value={1}>1 Image</option>
                            <option value={3}>3 Images</option>
                            <option value={5}>5 Images</option>
                            <option value={10}>10 Images</option>
                          </select>
                        </div>
                        <button
                          onClick={runCoverProcess}
                          disabled={processingCovers}
                          type="button"
                          className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white 
                            ${processingCovers ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
                        >
                          {processingCovers ? 'Processing...' : 'Generate Covers'}
                        </button>
                      </div>

                      {processingCovers && (
                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress: {coverProgress.current} / {coverProgress.total}</span>
                            <span>Success: {coverProgress.success} | Failed: {coverProgress.fail}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" 
                              style={{ width: `${(coverProgress.current / coverProgress.total) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Detailed Results (New Section) */}
                      {coverResults.length > 0 && (
                        <div className="mt-4 border-t border-gray-200 pt-3">
                          <h4 className="text-xs font-bold text-gray-700 mb-2">Processing Results</h4>
                          <div className="space-y-2">
                            {coverResults.map((result, idx) => (
                              <div key={idx} className={`p-2 rounded border text-xs flex justify-between items-center ${
                                result.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                              }`}>
                                <div>
                                  <span className="font-medium text-gray-900">{result.title}</span>
                                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px]">{result.theme}</span>
                                </div>
                                <div className="ml-4 flex-shrink-0">
                                  {result.url ? (
                                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                                      View Image ↗
                                    </a>
                                  ) : (
                                    <span className="text-red-600 font-medium">{result.error || 'Failed'}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {coverLogs.length > 0 && (
                        <div className="mt-4 bg-black bg-opacity-90 rounded p-3 h-40 overflow-y-auto text-xs font-mono text-green-400">
                          {coverLogs.map((log, i) => (
                            <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">{log}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {scanResult.total === 0 && (
                    <div className="text-center py-4 text-sm text-gray-500">
                      🎉 No missing covers found!
                    </div>
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
