'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceResult, setSourceResult] = useState<any>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [draftResult, setDraftResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runSourceRunner = async () => {
    setLoadingSource(true);
    setError(null);
    setSourceResult(null);
    
    try {
      const res = await fetch('/api/runner/source', { method: 'POST' });
      const data = await res.json();
      
      // Check if response indicates quota error (402) or other errors
      if (!res.ok || !data.success) {
        if (data.code === 'insufficient_quota' || res.status === 402) {
          setError(`⚠️ ${data.error || 'OpenAI API 配额不足'}\n\n${data.errorDetails || '请检查你的 OpenAI 账户余额和账单设置。'}`);
        } else {
          setError(data.error || data.message || `HTTP Error: ${res.status}`);
        }
        // Still set result to show partial data if available
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
                  {loadingSource ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Running...
                    </>
                  ) : 'Trigger Manually'}
                </button>
              </div>

              {/* Source Result Display */}
              {sourceResult && (
                <div className={`mt-4 rounded-md p-3 border ${
                  sourceResult.warning 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : 'bg-green-50 border-green-100'
                }`}>
                  <p className={`text-sm font-medium ${
                    sourceResult.warning ? 'text-yellow-800' : 'text-green-800'
                  }`}>
                    {sourceResult.warning ? '⚠️ Warning' : '✅ Success'}: {sourceResult.message}
                  </p>
                  {sourceResult.data && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-600 mb-1">处理结果:</p>
                      <pre className="text-xs text-gray-700 overflow-x-auto">
                        {JSON.stringify(sourceResult.data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {sourceResult.data?.errors && sourceResult.data.errors.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-yellow-200">
                      <p className="text-xs font-semibold text-yellow-700 mb-1">错误详情:</p>
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
                <p>Generates full drafts for sources marked as "Send" (and not "Used").</p>
              </div>
              <div className="mt-5">
                <button
                  onClick={runDraftRunner}
                  disabled={loadingDraft}
                  type="button"
                  className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white 
                    ${loadingDraft ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                >
                  {loadingDraft ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Running...
                    </>
                  ) : 'Trigger Manually'}
                </button>
              </div>

              {/* Draft Result Display */}
              {draftResult && (
                <div className={`mt-4 rounded-md p-3 border ${
                  draftResult.warning || (draftResult.data?.errors && draftResult.data.errors.length > 0)
                    ? 'bg-yellow-50 border-yellow-200' 
                    : 'bg-green-50 border-green-100'
                }`}>
                  <p className={`text-sm font-medium ${
                    draftResult.warning || (draftResult.data?.errors && draftResult.data.errors.length > 0) ? 'text-yellow-800' : 'text-green-800'
                  }`}>
                    {draftResult.warning ? '⚠️ Warning' : '✅ Success'}: {draftResult.message}
                  </p>
                  
                  {/* Display detailed results */}
                  {draftResult.data?.results && draftResult.data.results.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-xs font-semibold text-gray-700 mb-2">生成的文章：</p>
                      {draftResult.data.results.map((item: any, idx: number) => (
                        <div key={idx} className="mb-2 p-2 bg-white rounded border border-gray-200">
                          <p className="text-xs font-medium text-gray-900">{item.title}</p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                              {item.targetBlog}
                            </span>
                            <span className="text-gray-500">Draft ID: <code className="text-xs">{item.draftId}</code></span>
                            <span className="text-gray-500">Source ID: <code className="text-xs">{item.sourceId}</code></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {draftResult.data && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-600 mb-1">处理结果:</p>
                      <pre className="text-xs text-gray-700 overflow-x-auto">
                        {JSON.stringify(draftResult.data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {draftResult.data?.errors && draftResult.data.errors.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-yellow-200">
                      <p className="text-xs font-semibold text-yellow-700 mb-1">错误详情:</p>
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

        </div>
      </div>
    </div>
  );
}
