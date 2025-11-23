'use client';

import { useState } from 'react';

export default function NotionTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runTest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/test/notion');
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: 'Failed to fetch' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">Notion Connection Diagnostic</h1>
        
        <button
          onClick={runTest}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Run Diagnostic'}
        </button>

        {result && (
          <div className="mt-6 space-y-4">
            <div className={`p-4 rounded border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <h3 className="font-bold mb-2">{result.success ? '✅ Connection Successful' : '❌ Connection Failed'}</h3>
              
              {!result.success && (
                <p className="text-red-700 font-mono text-sm">{result.error} ({result.code})</p>
              )}

              {result.success && (
                <div className="text-sm space-y-2">
                  <p><strong>Bot Name:</strong> {result.bot?.name}</p>
                  <p><strong>Bot ID:</strong> {result.bot?.id}</p>
                  
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <h4 className="font-bold mb-1">Source DB Check:</h4>
                    <p><strong>Configured ID:</strong> {result.envConfig?.sourceDbIdProvided || '(Not set)'}</p>
                    
                    {result.databaseCheck?.success ? (
                      <p className="text-green-700">✅ Database found! Title: "{result.databaseCheck.info.title}"</p>
                    ) : (
                      <div className="text-red-700">
                        <p>❌ Database access failed</p>
                        <p className="font-mono text-xs mt-1">{result.databaseCheck?.error}</p>
                        <p className="mt-2 text-xs text-gray-600">
                          Tip: Make sure to invite the bot "{result.bot?.name}" to this database page in Notion.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">Raw Response</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

