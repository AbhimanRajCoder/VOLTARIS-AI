import { http, HttpResponse } from 'msw'

export const briefingHandlers = [
  http.get('http://localhost:8000/api/briefing/today', () => {
    return HttpResponse.json({
      system_summary: {
        overall_status: 'NORMAL',
        peak_hour: 19,
        timestamp: new Date().toISOString()
      },
      alerts_summary: {
        critical: 2,
        warning: 5,
        info: 10
      },
      zone_briefings: Array.from({ length: 10 }, (_, i) => ({
        zone_id: `Z${String(i + 1).padStart(2, '0')}`,
        zone_name: `Zone ${i + 1}`,
        load_kw: 1200 + Math.random() * 800,
        capacity_kw: 2500,
        ev_share_pct: 15 + Math.random() * 10,
        status: i === 0 ? 'CRITICAL' : i === 1 ? 'WARNING' : 'NORMAL'
      })),
      top_actions: [
        { zone_id: 'Z01', action_type: 'DEFER', reason: 'Transformer Overload' },
        { zone_id: 'Z02', action_type: 'OPTIMAL_WINDOW', reason: 'High demand anticipated' }
      ]
    })
  }),

  http.get('http://localhost:8000/api/forecast/zones', () => {
    return HttpResponse.json(Array.from({ length: 10 }, (_, i) => ({
      zone_id: `Z${String(i + 1).padStart(2, '0')}`,
      zone_name: `Zone ${i + 1}`,
      capacity_kw: 2500
    })))
  })
]
