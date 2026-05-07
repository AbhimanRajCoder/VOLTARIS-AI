import { ChevronRight } from 'lucide-react';

// Import demo components
import Demo1GridMap from '../components/demo/Demo1GridMap';
import Demo2Routing from '../components/demo/Demo2Routing';
import Demo3Webhook from '../components/demo/Demo3Webhook';
import Demo4Impact from '../components/demo/Demo4Impact';
import Demo5Timeline from '../components/demo/Demo5Timeline';
import Demo6Health from '../components/demo/Demo6Health';

const Demo = () => {
  return (
    <div className="bg-slate-50 min-h-[calc(100vh-72px)] overflow-hidden flex flex-col">
      {/* ── Main Content Area ─────────────────────────── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
        {/* Page Header */}
        <div className="bg-white border-b border-slate-200">
          <header className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
            <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">
              <span>Community</span>
              <ChevronRight size={12} />
              <span className="text-brand-600">Demos</span>
            </nav>
            
            <div className="max-w-4xl">
              <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-6">
                Explore the <span className="text-brand-600">GridWise</span> Integration Hub
              </h1>
              <p className="text-slate-500 text-lg lg:text-xl leading-relaxed">
                From spatial heatmaps to real-time event webhooks, these interactive demos showcase exactly how to wire our grid intelligence into your own applications.
              </p>
            </div>

            <div className="flex items-center gap-6 mt-12">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Live API Status: Healthy</span>
              </div>
              <div className="w-px h-5 bg-slate-300" />
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Last Sync: <span className="text-slate-700">Just now</span>
              </div>
            </div>
          </header>
        </div>

        {/* Demo Sections Container */}
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 space-y-32">
          <Demo1GridMap />
          <Demo2Routing />
          <Demo3Webhook />
          <Demo4Impact />
          <Demo5Timeline />
          <Demo6Health />
        </div>

        {/* Footer Next Steps */}
        <footer className="bg-white border-t border-slate-200 mt-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 py-24">
            <div className="max-w-4xl">
              <h2 className="text-3xl lg:text-4xl font-black text-slate-900 mb-4">Build your first integration</h2>
              <p className="text-slate-500 text-lg lg:text-xl mb-12">Ready to move beyond demos? Check out our getting started guide.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <a href="/" className="group p-8 bg-slate-50 border border-slate-200 rounded-3xl hover:border-brand-600 hover:bg-white transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-brand-600/10">
                  <h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-brand-600 transition-colors">Read the Docs</h3>
                  <p className="text-slate-500 leading-relaxed text-lg">Comprehensive API reference and step-by-step guides.</p>
                </a>
                <a href="/keys" className="group p-8 bg-slate-50 border border-slate-200 rounded-3xl hover:border-brand-600 hover:bg-white transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-brand-600/10">
                  <h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-brand-600 transition-colors">Get API Keys</h3>
                  <p className="text-slate-500 leading-relaxed text-lg">Create sandbox keys and start building in minutes.</p>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Demo;
