'use client';

import { useState } from 'react';

export default function TestRunnerPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerSourceRunner = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Triggering Source Runner...');
      const response = await fetch('/api/runner/source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('Success:', data);
      setResult(data);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Source Runner 测试页面</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">手动触发 Source Runner</h2>
          
          <button
            onClick={triggerSourceRunner}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '运行中...' : '触发 Source Runner'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 font-semibold">错误:</p>
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 font-semibold mb-2">成功!</p>
              <pre className="text-sm overflow-auto bg-white p-3 rounded border">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">📝 使用说明:</h3>
          <ol className="list-decimal list-inside text-yellow-700 space-y-1 text-sm">
            <li>在 Notion Source DB 创建一个新页面</li>
            <li>在正文中粘贴一些文本（例如："如何实现财务自由"）</li>
            <li>不要填写 Title 和 SourceID（留空）</li>
            <li>点击上面的按钮触发 Source Runner</li>
            <li>检查 Notion，应该看到 Title 和 SourceID 被自动填充</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

