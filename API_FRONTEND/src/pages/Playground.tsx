import { useState, useEffect } from 'react';
import { 
  Terminal, 
  PlayCircle, 
  RefreshCw, 
  AlertCircle, 
  Lock,
  Key
} from 'lucide-react';
import { endpoints, TEST_KEY } from '../lib/constants';

interface PlaygroundProps {
  apiKey: string;
  setApiKey: (key: string) => void;
}

const Playground = ({ apiKey, setApiKey }: PlaygroundProps) => {
  useEffect(() => {
    setApiKey(TEST_KEY);
  }, [setApiKey]);

  const [demoResult, setDemoResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTestApi = async (func: any) => {
    if (apiKey !== TEST_KEY) {
      setDemoResult({ 
        error: 'Authentication Failed', 
        message: 'Invalid API Key. Please use the test key: ' + TEST_KEY,
        code: 401 
      });
      return;
    }

    setLoading(true);
    setDemoResult(null);
    try {
      const result = await func();
      setDemoResult(result);
    } catch (err) {
      setDemoResult({ error: 'Failed to connect to backend', message: 'The Voltaris API server is currently unreachable.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-12 animate-in fade-in duration-300 max-w-6xl mx-auto w-full flex flex-col h-full">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-extrabold mb-2 text-slate-900">API <span className="text-brand-600">Playground</span></h2>
          <p className="text-slate-500 text-sm italic">Use the test key <span className="font-mono font-bold text-brand-600">{TEST_KEY}</span> to execute requests.</p>
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Playground Auth</label>
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-4 py-2 border border-slate-200 shadow-sm focus-within:border-brand-300 transition-all">
            <Key size={14} className={apiKey === TEST_KEY ? 'text-emerald-500' : 'text-slate-400'} />
            <input 
              type="text" 
              placeholder="Enter API Key" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-transparent text-xs outline-none w-48 font-mono text-slate-700"
            />
            {apiKey !== TEST_KEY && (
              <button 
                onClick={() => setApiKey(TEST_KEY)}
                className="text-[10px] font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-2 py-1 rounded-md transition-colors"
              >
                Use Test Key
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-8 min-h-0">
        <div className="col-span-4 flex flex-col gap-4">
          <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold px-1">Endpoints</h4>
          <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar">
            {endpoints.map((ep, i) => (
              <button 
                key={i}
                onClick={() => handleTestApi(ep.func)}
                disabled={loading}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-brand-300 hover:bg-brand-50/20 transition-all text-left group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-brand-600 transition-all">
                  <Terminal size={18} className="text-slate-400 group-hover:text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-700 group-hover:text-brand-600 transition-colors flex items-center gap-2">
                    {ep.name}
                    {apiKey === TEST_KEY && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{ep.path}</div>
                </div>
                <PlayCircle size={16} className="text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-8 flex flex-col">
          <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-4 px-1">Live Output</h4>
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-8 font-mono text-[11px] overflow-auto relative group shadow-2xl">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-[1px] z-10 rounded-3xl">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="text-brand-400 animate-spin" size={28} />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Calling API...</span>
                </div>
              </div>
            )}

            {demoResult ? (
              demoResult.error ? (
                <div className="text-red-400 flex flex-col gap-4">
                  <div className="flex items-center gap-3 font-bold uppercase tracking-wider text-[11px]">
                    <AlertCircle size={16} />
                    {demoResult.error}
                  </div>
                  <p className="text-slate-400 leading-relaxed bg-red-400/5 p-4 rounded-xl border border-red-400/10">
                    {demoResult.message}
                  </p>
                </div>
              ) : (
                <pre className="text-emerald-400 leading-relaxed whitespace-pre-wrap">
                  {JSON.stringify(demoResult, null, 2)}
                </pre>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center gap-5">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                  <Lock size={32} strokeWidth={1.5} className="text-slate-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-400 text-sm">Waiting for Request</p>
                  <p className="text-[10px] mt-1 text-slate-600 max-w-[200px] leading-relaxed">
                    Authenticate and select an endpoint to see live responses from the Voltaris engine.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Playground;
