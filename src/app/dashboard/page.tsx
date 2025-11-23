'use client';

import { useState } from 'react';

export default function DashboardPage() {
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceResult, setSourceResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runSourceRunner = async () => {
    setLoadingSource(true);
    setError(null);
    setSourceResult(null);
    
    try {
      const res = await fetch('/api/runner/source', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP Error: ${res.status}`);
      }
      const data = await res.json();
      setSourceResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setLoadingSource(false);
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
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  {error}
                </p>
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

              {/* Result Display */}
              {sourceResult && (
                <div className="mt-4 bg-green-50 rounded-md p-3 border border-green-100">
                  <p className="text-sm font-medium text-green-800">
                    Success: {sourceResult.message}
                  </p>
                  {sourceResult.data && (
                     <pre className="mt-2 text-xs text-green-700 overflow-x-auto">
                       {JSON.stringify(sourceResult.data, null, 2)}
                     </pre>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Draft Runner Placeholder */}
          <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100 opacity-60">
            <div className="px-4 py-5 sm:p-6">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Draft Runner
                 </h3>
                 <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                   Stage 2
                 </span>
              </div>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Generates full drafts for sources marked as "Send". (Coming soon)</p>
              </div>
              <div className="mt-5">
                <button
                  disabled
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-400 cursor-not-allowed"
                >
                  Coming Soon
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

