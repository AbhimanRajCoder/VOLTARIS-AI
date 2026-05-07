import { http, HttpResponse } from 'msw'
import { ZoneDemandForecast } from '@/lib/types'

export const forecastHandlers = [
  http.get('http://localhost:8000/api/forecast/demand', ({ request }) => {
    const url = new URL(request.url)
    const zone = url.searchParams.get('zone_id') || 'Z01'
    
    const data: ZoneDemandForecast[] = Array.from({ length: 48 }, (_, i) => ({
      zone_id: zone,
      timestamp: new Date(Date.now() + i * 3600000).toISOString(),
      predicted_kw: 300 + Math.sin(i / 4) * 150,
      ev_share_pct: 18 + Math.random() * 8,
      confidence_lo: 250 + Math.sin(i / 4) * 130,
      confidence_hi: 350 + Math.sin(i / 4) * 170,
      model_version: 'v1.0'
    }))
    
    return HttpResponse.json(data)
  }),

  http.get('http://localhost:8000/api/forecast/explain', ({ request }) => {
    const url = new URL(request.url)
    const zone = url.searchParams.get('zone_id') || 'Z01'
    
    return HttpResponse.json({
      zone_id: zone,
      timestamp: url.searchParams.get('timestamp'),
      shap_values: {
        is_peak_hour: 45.2,
        temperature: 12.5,
        humidity: -5.3,
        day_of_week: 8.1,
        hour_sin: 3.4
      },
      explanation: "Peak demand driven by residential cooling and evening EV charging surge."
    })
  })
]
