import { Link, useLocation } from 'react-router-dom';
import { 
  PlayCircle, 
  Cpu, 
  Menu,
  UnfoldVertical,
  Info,
  Rocket,
  Terminal
} from 'lucide-react';
import { endpoints } from '../../lib/constants';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="bg-surface text-on-surface font-body-md antialiased min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="bg-surface docked full-width top-0 sticky z-40 border-b border-outline-variant">
        <div className="flex justify-between items-center px-lg py-md w-full">
          <div className="flex items-center gap-md">
            <button className="md:hidden text-primary">
              <Menu size={24} />
            </button>
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Cpu size={18} className="text-white" />
              </div>
              <span className="font-h3 text-h3 font-bold text-on-surface">VOLTATIS API DOCS</span>
            </Link>
          </div>
          
          <div className="flex items-center gap-md">
            {/* Minimalist header - All navigation moved to sidebar or removed */}
          </div>
        </div>
      </header>

      <div className="flex-1 flex w-full">
        {/* NavigationDrawer */}
        <aside className="hidden md:flex flex-col gap-1 p-3 h-[calc(100vh-72px)] w-60 sticky top-[72px] border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar">
          <div className="mb-6 mt-2">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-all duration-200">
              <span className="text-[11px] font-bold text-slate-600 tracking-tight">v2.4.0 Production</span>
              <UnfoldVertical size={14} className="text-slate-400" />
            </div>
          </div>
          
          <Link to="/getting-started" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${path === '/getting-started' ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Rocket size={18} className={path === '/getting-started' ? 'text-brand-600' : 'group-hover:text-brand-600 transition-colors'} />
            <span className="text-sm font-semibold">Getting Started</span>
          </Link>

          <Link to="/" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${path === '/' ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Info size={18} className={path === '/' ? 'text-brand-600' : 'group-hover:text-brand-600 transition-colors'} />
            <span className="text-sm font-semibold">API DOCS</span>
          </Link>
          
          <Link to="/demo" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${path === '/demo' ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            <PlayCircle size={18} className={path === '/demo' ? 'text-brand-600' : 'group-hover:text-brand-600 transition-colors'} />
            <span className="text-sm font-semibold">Live Demos</span>
          </Link>

          <div className="my-4 border-t border-slate-100" />

          <Link to="/keys" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${path === '/keys' ? 'bg-brand-50 text-brand-700 border border-brand-100 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Terminal size={18} className={path === '/keys' ? 'text-brand-600' : 'group-hover:text-brand-600 transition-colors'} />
            <span className="text-sm font-semibold">API KEY</span>
          </Link>
          
        </aside>

        {/* Main Canvas */}
        <main className="flex-1 w-full min-w-0">
          {children}
        </main>
      </div>
      
      {/* Footer */}
      <footer className="bg-surface-container-low border-t border-outline-variant mt-auto z-10 relative">
        <div className="flex flex-col md:flex-row justify-between items-center px-lg py-xl w-full gap-md">
          <div className="flex items-center gap-md">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <Cpu size={12} className="text-white" />
            </div>
            <span className="font-label-caps text-label-caps font-black text-on-surface">GridWise</span>
            <span className="font-body-sm text-body-sm text-on-secondary-container">© 2024 GridWise Inc.</span>
          </div>
          <div className="flex gap-lg">
            <Link to="/demo" className="font-body-sm text-body-sm text-on-secondary-container hover:underline hover:text-primary transition-all">Community</Link>
            <Link to="/" className="font-body-sm text-body-sm text-on-secondary-container hover:underline hover:text-primary transition-all">Reference</Link>
            <Link to="/blog" className="font-body-sm text-body-sm text-on-secondary-container hover:underline hover:text-primary transition-all">Blog</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
