'use client';

import { useState } from 'react';
import { 
  Download, 
  FileBarChart, 
  Map, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useZones } from '@/lib/api';
import { useZone } from '@/context/ZoneContext';
import Badge from '@/components/ui/Badge';
import axios from 'axios';
import { useTranslation } from '@/hooks/useTranslation';

type ReportType = 'forecast' | 'schedule' | 'infra';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function ReportsPage() {
  const { selectedZone, setSelectedZone } = useZone();
  const { t } = useTranslation();
  const { data: zones } = useZones();
  
  const [selectedReport, setSelectedReport] = useState<ReportType>('forecast');
  const [dateRange, setDateRange] = useState({ 
    start: subDays(new Date(), 7), 
    end: new Date() 
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDownload = async (type: ReportType) => {
    setLoading(type);
    try {
      let url = '';
      let filename = '';
      const dateStr = format(new Date(), 'yyyyMMdd');
      
      const start_ts = dateRange.start.toISOString();
      const end_ts = dateRange.end.toISOString();
      const date = format(dateRange.end, 'yyyy-MM-dd');

      if (type === 'forecast') {
        url = `${API_URL}/forecast/demand?zone_id=${selectedZone}&start_ts=${start_ts}&end_ts=${end_ts}`;
        filename = `gridwise_forecast_${selectedZone}_${dateStr}.csv`;
      } else if (type === 'infra') {
        url = `${API_URL}/infra/recommend?top_n=50`;
        filename = `gridwise_site_ranking_${dateStr}.csv`;
      } else if (type === 'schedule') {
        url = `${API_URL}/schedule/comparison?zone_id=${selectedZone}&date=${date}`;
        filename = `gridwise_schedule_${selectedZone}_${dateStr}.csv`;
      }

      const response = await axios.get(url);
      const data = response.data;
      
      // Convert JSON to CSV if it's not already
      let csvContent = '';
      if (Array.isArray(data)) {
        if (data.length > 0) {
          const headers = Object.keys(data[0]);
          csvContent = headers.join(',') + '\n';
          csvContent += data.map(row => headers.map(header => JSON.stringify(row[header])).join(',')).join('\n');
        } else {
          csvContent = 'No data available';
        }
      } else {
        // Handle nested objects for comparison data
        if (type === 'schedule') {
          const headers = ['hour', 'unmanaged_kw', 'optimized_kw'];
          csvContent = headers.join(',') + '\n';
          const unmanaged = data.unmanaged_curve || [];
          const optimized = data.optimized_curve || [];
          csvContent += unmanaged.map((u: any, i: number) => {
            const o = optimized[i] || {};
            return `${u.hour},${u.load_kw},${o.load_kw || u.load_kw}`;
          }).join('\n');
        } else {
          csvContent = JSON.stringify(data);
        }
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const urlBlob = URL.createObjectURL(blob);
      link.setAttribute("href", urlBlob);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast(t('reports.successExport', { filename }));
    } catch (error) {
      console.error(error);
      showToast(t('reports.failedExport'), "error");
    } finally {
      setLoading(null);
    }
  };

  const reportTypes = [
    { id: 'forecast', title: t('reports.forecastData'), desc: t('reports.forecastDataDesc'), icon: FileBarChart },
    { id: 'schedule', title: t('reports.scheduleSummary'), desc: t('reports.scheduleSummaryDesc'), icon: Clock },
    { id: 'infra', title: t('reports.siteRankings'), desc: t('reports.siteRankingsDesc'), icon: Map },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto p-6 h-full flex flex-col relative space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tighter text-[var(--color-text-primary)] uppercase italic">{t('reports.title')}</h1>
        <p className="text-sm text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-1">{t('reports.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportTypes.map((rt) => (
          <div
            key={rt.id}
            className={`flex flex-col items-start p-6 rounded-3xl transition-all border shadow-sm ${
              selectedReport === rt.id 
                ? 'bg-white  border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]' 
                : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)]'
            }`}
          >
            <div className={`p-3 rounded-2xl mb-4 ${selectedReport === rt.id ? 'bg-[var(--color-accent)] text-white shadow-lg' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'}`}>
              <rt.icon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-[var(--color-text-primary)] uppercase tracking-tight mb-2">{rt.title}</h3>
            <p className="text-xs text-[var(--color-text-muted)] font-medium leading-relaxed mb-6">{rt.desc}</p>
            
            <button
              onClick={() => {
                setSelectedReport(rt.id);
                handleDownload(rt.id);
              }}
              disabled={loading !== null}
              className={`mt-auto w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                selectedReport === rt.id 
                  ? 'bg-slate-900   text-white hover:opacity-90' 
                  : 'bg-gray-100  text-slate-500 hover:bg-gray-200'
              }`}
            >
              {loading === rt.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {loading === rt.id ? t('reports.fetching') : t('reports.downloadCsv')}
            </button>
          </div>
        ))}
      </div>

      <div className="card p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-accent)]">{t('reports.exportParameters')}</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('reports.targetZone')}</label>
              <select 
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full bg-gray-50  border border-[var(--color-border-subtle)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                {zones?.map((z: any) => (
                  <option key={`report-zone-${z.zone_id}`} value={z.zone_id}>{z.zone_id} — {z.zone_name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('reports.startDate')}</label>
                <input 
                  type="date"
                  value={format(dateRange.start, 'yyyy-MM-dd')}
                  onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
                  className="w-full bg-gray-50  border border-[var(--color-border-subtle)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--color-text-primary)] focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('reports.endDate')}</label>
                <input 
                  type="date"
                  value={format(dateRange.end, 'yyyy-MM-dd')}
                  onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
                  className="w-full bg-gray-50  border border-[var(--color-border-subtle)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--color-text-primary)] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-accent)]">{t('reports.auditLog')}</h3>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
             {t('reports.recentExports')}
           </p>
           
           <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50  rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
                      <FileBarChart className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase text-slate-900 tracking-tight">Report_#{i*2481}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{format(subDays(new Date(), i), 'MMM dd, HH:mm')}</p>
                    </div>
                  </div>
                  <Badge variant="success" label={t('reports.exported')} />
                </div>
              ))}
           </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50 border ${
          toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-black uppercase tracking-wide italic">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
