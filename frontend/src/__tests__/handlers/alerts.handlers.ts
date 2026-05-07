import { http, HttpResponse } from 'msw'
import { GridAlert } from '@/lib/types'

export const alertsHandlers = [
  http.get('http://localhost:8000/api/grid/alerts', ({ request }) => {
    const url = new URL(request.url)
    const severity = url.searchParams.get('severity')
    const zone = url.searchParams.get('zone_id')
    
    let alerts: GridAlert[] = [
      {
        alert_id: 'AL-1',
        zone_id: 'Z01',
        severity: 'CRITICAL',
        triggered_at: new Date(Date.now() - 120000).toISOString(),
        message: 'Transformer Overload Detected',
        recommended_action: 'Defer non-essential charging',
        acknowledged: false,
        resolved: false
      },
      {
        alert_id: 'AL-2',
        zone_id: 'Z02',
        severity: 'WARNING',
        triggered_at: new Date(Date.now() - 300000).toISOString(),
        message: 'High Voltage Fluctuation',
        recommended_action: 'Monitor grid stability',
        acknowledged: false,
        resolved: false
      },
      {
        alert_id: 'AL-3',
        zone_id: 'Z03',
        severity: 'INFO',
        triggered_at: new Date(Date.now() - 600000).toISOString(),
        message: 'Maintenance Scheduled',
        recommended_action: null,
        acknowledged: true,
        resolved: false
      }
    ]
    
    if (severity) alerts = alerts.filter(a => a.severity === severity)
    if (zone) alerts = alerts.filter(a => a.zone_id === zone)
    
    return HttpResponse.json(alerts)
  }),

  http.post('http://localhost:8000/api/grid/alerts/:id/acknowledge', ({ params }) => {
    return HttpResponse.json({ success: true, alert_id: params.id })
  })
]
