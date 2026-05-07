import { http, HttpResponse } from 'msw'

export const schedulerHandlers = [
  http.post('http://localhost:8000/api/schedule/optimize', async ({ request }) => {
    const body = await request.json() as any
    const zone = body.zone_id || 'Z01'
    
    const data = Array.from({ length: 24 }, (_, i) => {
      const isPeak = i >= 18 && i <= 23;
      const isOffPeak = i >= 2 && i <= 6;
      const action = isPeak ? 'DEFER' : isOffPeak ? 'CHARGE_NOW' : 'OPTIMAL_WINDOW';
      const delta = isPeak ? -(30 + Math.random() * 20) : isOffPeak ? (15 + Math.random() * 15) : 0;
      
      const reasons = {
        DEFER: [
          `Peak demand at ${i:02d}:00 exceeds safety threshold. Shifting load to prevent transformer overload.`,
          `High grid stress detected. Redirecting ${Math.abs(delta).toFixed(1)} kW to off-peak slots.`,
          `Thermal protection active for Zone ${zone}. Reducing load by ${Math.abs(delta).toFixed(1)} kW.`
        ],
        CHARGE_NOW: [
          `Excess capacity available. Encouraging immediate charging for fleet vehicles.`,
          `Grid load is optimal (${(40 + Math.random() * 10).toFixed(0)}%). High throughput enabled.`,
          `Renewable surplus detected in Zone ${zone}. Prioritizing immediate load absorption.`
        ],
        OPTIMAL_WINDOW: [
          `Standard grid operating conditions. Scheduling within normal parameters.`,
          `Stable load profile. Optimal charging window active for residential clusters.`,
          `Grid load balancing active. Maintaining steady-state distribution.`
        ]
      };

      return {
        zone_id: zone,
        hour_slot: i,
        action: action,
        grid_load_pct: isPeak ? 85 + Math.random() * 10 : 40 + Math.random() * 30,
        optimal_window: isPeak ? "02:00-06:00" : null,
        reason: (reasons as any)[action][i % 3],
        expected_delta_kw: delta
      }
    })
    
    return HttpResponse.json(data)
  }),

  http.get('http://localhost:8000/api/schedule/comparison', ({ request }) => {
    const url = new URL(request.url)
    const zone = url.searchParams.get('zone_id') || 'Z01'
    
    const unmanaged = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      load_kw: 400 + Math.sin(i / 4) * 250 + (i >= 18 && i <= 22 ? 300 : 0) + Math.random() * 50
    }));

    const optimized = unmanaged.map((u, i) => ({
      hour: i,
      load_kw: i >= 18 && i <= 22 ? u.load_kw - 150 - Math.random() * 50 : 
               i >= 2 && i <= 6 ? u.load_kw + 100 + Math.random() * 30 : u.load_kw
    }));

    const peakUnmanaged = Math.max(...unmanaged.map(u => u.load_kw));
    const peakOptimized = Math.max(...optimized.map(u => u.load_kw));
    const peakDelta = peakUnmanaged - peakOptimized;

    return HttpResponse.json({
      zone_id: zone,
      date: url.searchParams.get('date'),
      unmanaged_curve: unmanaged,
      optimized_curve: optimized,
      peak_delta_kw: peakDelta,
      peak_reduction_pct: (peakDelta / peakUnmanaged) * 100
    })
  })
]
