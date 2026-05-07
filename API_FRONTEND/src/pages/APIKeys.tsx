import { useState, useEffect } from 'react';
import { 
  Key, 
  Copy, 
  CheckCircle2, 
  RefreshCw, 
  Plus, 
  ShieldCheck, 
  Zap, 
  Lock 
} from 'lucide-react';
import { TEST_KEY } from '../lib/constants';

const CONSTANT_KEYS = [
  'API_4821xjsk28dnw92',
  'API_1049abx82kdnz11',
  'API_7730pqx91lmvte4'
];

const APIKeys = () => {
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [apiKeysList, setApiKeysList] = useState<string[]>(() => {
    const saved = localStorage.getItem('voltaris_demo_keys');
    return saved ? JSON.parse(saved) : [];
  });
  const limit = CONSTANT_KEYS.length;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('voltaris_demo_keys', JSON.stringify(apiKeysList));
  }, [apiKeysList]);

  const generateNewKey = () => {
    setError(null);
    if (apiKeysList.length < limit) {
      const nextKey = CONSTANT_KEYS[apiKeysList.length];
      setGeneratedKey(nextKey);
      setApiKeysList(prev => [...prev, nextKey]);
    } else {
      setError('Demo limit reached: All test keys have been generated.');
    }
  };

  const handleReset = () => {
    setGeneratedKey(null);
    setApiKeysList([]);
    setError(null);
    localStorage.removeItem('voltaris_demo_keys');
  };

  return (
    <div className="p-12 animate-in fade-in duration-300 max-w-4xl mx-auto w-full">
      <div className="mb-12">
        <h2 className="text-3xl font-extrabold mb-2 text-slate-900">Authentication</h2>
        <p className="text-slate-500 text-sm">The Voltaris API uses API keys to authenticate requests. You can view and manage your API keys in this section.</p>
      </div>

      <div className="space-y-10">
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center hover:border-brand-200 transition-colors group">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-6 group-hover:scale-110 transition-transform">
            <Key size={28} />
          </div>
          <h3 className="text-lg font-bold mb-2">Create a production key</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-8">Production keys allow higher rate limits and access to premium grid telemetry.</p>
          
          {generatedKey ? (
            <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-center justify-between mb-4 shadow-sm">
                <code className="text-sm font-mono font-bold text-emerald-700">{generatedKey}</code>
                <button className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"><Copy size={16} className="text-emerald-600" /></button>
              </div>
              <div className="flex items-center justify-center gap-2 mb-8">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Key generated and active</span>
              </div>
              <button onClick={() => setGeneratedKey(null)} className="text-xs text-slate-400 hover:text-slate-600 font-medium flex items-center gap-2 mx-auto">
                <RefreshCw size={12} /> Generate another
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={generateNewKey}
                disabled={apiKeysList.length >= limit}
                className="flex items-center gap-2 px-8 py-3.5 rounded-full brand-gradient text-white text-sm font-bold shadow-xl shadow-brand-500/20 hover:shadow-brand-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={18} />
                Generate New Key
              </button>
              {error && <span className="text-xs text-red-500 font-medium mt-2">{error}</span>}
              {apiKeysList.length >= limit && !error && (
                <span className="text-xs text-slate-500 font-medium mt-2">Demo limit reached ({limit}/{limit} keys)</span>
              )}
              {apiKeysList.length > 0 && (
                <button onClick={handleReset} className="text-[10px] text-red-400 hover:text-red-600 font-bold uppercase tracking-tighter mt-4 flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
                  <RefreshCw size={10} /> Reset Demo Keys
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Access Tokens</span>
            </div>
            <span className="bg-brand-100 text-brand-600 px-2 py-0.5 rounded text-[9px] font-bold">{apiKeysList.length + 1}/{limit + 1} Used</span>
          </div>
          <div className="divide-y divide-slate-50">
            <div className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                  <Zap size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Test Environment Key</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-2">
                    <Lock size={10} /> {TEST_KEY.substring(0, 10)}••••••••••••
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-700">Standard Tier</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Created May 2026</div>
                </div>
                <button className="p-2 text-slate-300 hover:text-red-500 transition-colors"><RefreshCw size={14} /></button>
              </div>
            </div>
            {apiKeysList.map((key, i) => (
              <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 border border-brand-100">
                    <Key size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">Production Key {i + 1}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-2">
                      <Lock size={10} /> {key.substring(0, 14)}••••••••••••
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-700">Premium Tier</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Created Just Now</div>
                  </div>
                  <button className="p-2 text-slate-300 hover:text-red-500 transition-colors"><RefreshCw size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIKeys;
