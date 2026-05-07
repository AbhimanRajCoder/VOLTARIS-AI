import { http, HttpResponse } from 'msw'

export const simulateHandlers = [
  http.post('http://localhost:8000/api/simulate/scenario', async ({ request }) => {
    const body = await request.json() as any
    const multiplier = body.ev_adoption_multiplier || 1.5
    
    return HttpResponse.json({
      unmanaged: { stress_hours: Math.floor(multiplier * 8) },
      optimized: { stress_hours: Math.floor(multiplier * 2) },
      peak_reduction_pct: 25 + (multiplier * 5)
    })
  })
]
