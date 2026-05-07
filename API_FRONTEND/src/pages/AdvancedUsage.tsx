import { Link } from 'react-router-dom';
import { 
  Settings, 
  Webhook, 
  Activity, 
  ChevronRight,
  ShieldAlert,
  BarChart3,
  Globe
} from 'lucide-react';

const AdvancedUsage = () => {
  return (
    <div className="flex-1 px-12 py-16 max-w-5xl mx-auto h-[calc(100vh-72px)] overflow-y-auto custom-scrollbar">
      <nav className="flex items-center gap-sm text-body-sm text-on-surface-variant mb-md">
        <span>Guide</span>
        <ChevronRight size={16} />
        <span className="text-brand-600 font-semibold">Advanced Usage</span>
      </nav>

      <header className="mb-16">
        <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-6">
          Advanced <span className="text-brand-600">Grid Intelligence</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-3xl leading-relaxed">
          Scale your integration with automated webhooks, complex demand simulations, and real-time grid deflection logic.
        </p>
      </header>

      <div className="space-y-24">
        {/* Webhooks Section */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
              <Webhook size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Real-time Webhooks</h2>
              <p className="text-slate-500">Subscribe to grid events as they happen.</p>
            </div>
          </div>
          <p className="text-slate-600 mb-8 text-lg leading-relaxed">
            Don't poll our API. Configure webhooks to receive push notifications for critical grid events like transformer overloads, voltage drops, or predicted outages.
          </p>
          <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Example Webhook Payload</h4>
            <pre className="text-sm font-mono text-emerald-400 overflow-x-auto">
{`{
  "event_type": "GRID_ALERT",
  "severity": "CRITICAL",
  "zone_id": "ZONE_77",
  "details": {
    "current_load_kw": 4850,
    "capacity_kw": 5000,
    "load_ratio": 0.97
  },
  "timestamp": "2024-05-07T12:00:00Z"
}`}
            </pre>
          </div>
        </section>

        {/* Multi-Zone Queries */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              <Globe size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Regional Intelligence</h2>
              <p className="text-slate-500">Aggregating data across multiple substations.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-xl transition-all">
              <ShieldAlert size={32} className="text-red-500 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Outage Prediction</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Use the <code className="text-brand-600 font-bold">/forecast/risk</code> endpoint to get probabilistic failure scores for all zones in a specific region.
              </p>
            </div>
            <div className="p-8 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-xl transition-all">
              <BarChart3 size={32} className="text-emerald-500 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Demand Deflection</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Coordinate EV charging schedules across entire zip codes to minimize peak demand spikes and maximize renewable energy utilization.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Next Steps */}
      <footer className="mt-24 pt-12 border-t border-slate-100 flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-1">Previous</p>
          <Link to="/getting-started" className="text-lg font-bold text-slate-900 hover:text-brand-600 transition-colors">Getting Started</Link>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-1">Next Up</p>
          <Link to="/playground" className="text-lg font-bold text-slate-900 hover:text-brand-600 transition-colors flex items-center gap-2 justify-end">
            API Explorer
            <ChevronRight size={20} />
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default AdvancedUsage;
