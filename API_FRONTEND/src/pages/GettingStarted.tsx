import { Link } from 'react-router-dom';
import { 
  Rocket, 
  Key, 
  ShieldCheck, 
  ChevronRight,
  Code2,
  Terminal,
  Cpu,
  Zap,
  Globe
} from 'lucide-react';

const GettingStarted = () => {
  return (
    <div className="flex-1 px-12 py-16 max-w-5xl mx-auto h-[calc(100vh-72px)] overflow-y-auto custom-scrollbar">
      <nav className="flex items-center gap-sm text-body-sm text-on-surface-variant mb-md">
        <span>Guide</span>
        <ChevronRight size={16} />
        <span className="text-brand-600 font-semibold">Getting Started</span>
      </nav>

      <header className="mb-16">
        <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-6">
          Getting <span className="text-brand-600">Started</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-3xl leading-relaxed">
          This guide provides everything you need to start building with the Voltatis Grid Intelligence API. Whether you are automating load balancing or building a custom grid dashboard, start here.
        </p>
      </header>

      <div className="space-y-20">
        {/* API Basics */}
        <section>
          <h2 className="text-3xl font-bold text-slate-900 mb-8 tracking-tight">API Fundamentals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Globe size={20} className="text-brand-600" />
                Base URL
              </h3>
              <p className="text-slate-600 text-sm mb-4">All API requests should be made to our production edge:</p>
              <code className="block bg-white p-3 rounded-xl border border-slate-200 text-brand-600 font-mono text-xs font-bold">
                https://api.voltaris.ai/v1
              </code>
            </div>
            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-600" />
                SSL Only
              </h3>
              <p className="text-slate-600 text-sm mb-4">We require HTTPS for all requests to ensure your grid data and API keys remain encrypted during transit.</p>
            </div>
          </div>
        </section>

        {/* Step 1: Authentication */}
        <section className="relative pl-12 border-l-2 border-brand-100">
          <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold shadow-lg shadow-brand-600/20">
            1
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            Authentication
          </h2>
          <p className="text-slate-600 mb-6 text-lg leading-relaxed">
            Voltatis uses API keys to authenticate requests. You can find your API key in the <Link to="/keys" className="text-brand-600 hover:underline font-bold">Authentication</Link> section. Authentication is handled via the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-brand-600 font-bold">X-API-Key</code> header.
          </p>
          <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl">
            <pre className="text-sm font-mono text-slate-300 overflow-x-auto">
{`GET /v1/forecast/summary HTTP/1.1
Host: api.voltaris.ai
X-API-Key: YOUR_API_KEY_HERE
Accept: application/json`}
            </pre>
          </div>
        </section>

        {/* Step 2: Rate Limits */}
        <section className="relative pl-12 border-l-2 border-brand-100">
          <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold">
            2
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
            Rate Limits
          </h2>
          <p className="text-slate-600 mb-8 text-lg leading-relaxed">
            To ensure stability for all grid operators, we enforce standard rate limits. If you exceed these limits, the API will return a <code className="text-red-500 font-bold">429 Too Many Requests</code> error.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-white border border-slate-100 rounded-2xl">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Sandbox</p>
              <p className="text-2xl font-black text-slate-900">100</p>
              <p className="text-[10px] text-slate-500">req / minute</p>
            </div>
            <div className="text-center p-6 bg-white border border-slate-100 rounded-2xl">
              <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-1">Production</p>
              <p className="text-2xl font-black text-slate-900">1,000</p>
              <p className="text-[10px] text-slate-500">req / minute</p>
            </div>
            <div className="text-center p-6 bg-white border border-slate-100 rounded-2xl">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Enterprise</p>
              <p className="text-2xl font-black text-slate-900">Custom</p>
              <p className="text-[10px] text-slate-500">Tailored to your grid</p>
            </div>
          </div>
        </section>

        {/* Error Codes */}
        <section className="bg-slate-900 rounded-[2.5rem] p-12 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 blur-[100px] rounded-full -mr-32 -mt-32" />
          <h2 className="text-3xl font-bold mb-8 tracking-tight">Common Response Codes</h2>
          <div className="grid grid-cols-1 gap-6">
            {[
              { code: '200', title: 'OK', desc: 'The request was successful and the response body contains the data.' },
              { code: '400', title: 'Bad Request', desc: 'The request was unacceptable, often due to missing or invalid parameters.' },
              { code: '401', title: 'Unauthorized', desc: 'No valid API key was provided or the key has expired.' },
              { code: '404', title: 'Not Found', desc: 'The requested resource (e.g. Zone ID) does not exist.' },
              { code: '500', title: 'Server Error', desc: 'Something went wrong on our end. Reach out to support if this persists.' },
            ].map((err, i) => (
              <div key={i} className="flex gap-6 items-start group">
                <span className="font-mono font-black text-brand-400 group-hover:text-brand-300 transition-colors">{err.code}</span>
                <div>
                  <h4 className="font-bold text-white mb-1">{err.title}</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">{err.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer Next Steps */}
      <footer className="mt-24 pt-12 border-t border-slate-100 flex justify-end items-center">
        <div className="text-right">
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-1">Next Up</p>
          <Link to="/" className="text-lg font-bold text-slate-900 hover:text-brand-600 transition-colors flex items-center gap-2 justify-end">
            API Docs
            <ChevronRight size={20} />
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default GettingStarted;
