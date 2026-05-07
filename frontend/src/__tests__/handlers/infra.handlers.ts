import { http, HttpResponse } from 'msw'
import { InfraSiteCandidate } from '@/lib/types'

export const infraHandlers = [
  http.get('http://localhost:8000/api/infra/hotspots', ({ request }) => {
    const url = new URL(request.url)
    const n = parseInt(url.searchParams.get('n_clusters') || '5')
    
    return HttpResponse.json({
      type: 'FeatureCollection',
      features: Array.from({ length: n }, (_, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [77.5946 + (i * 0.01), 12.9716 + (i * 0.01)] },
        properties: {
          cluster_id: i + 1,
          site_count: 10 + i,
          avg_composite_score: 0.75 - (i * 0.05),
          top_site_id: `SITE-${i}`
        }
      })),
      kde_grid: {
        bbox: [77.5, 12.9, 77.7, 13.1],
        resolution: 10,
        matrix: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => Math.random()))
      }
    })
  }),

  http.get('http://localhost:8000/api/infra/recommend', ({ request }) => {
    const url = new URL(request.url)
    const top_n = parseInt(url.searchParams.get('top_n') || '10')
    
    const data: InfraSiteCandidate[] = Array.from({ length: top_n }, (_, i) => ({
      site_id: `SITE-${i}`,
      lat: 12.9716 + (Math.random() - 0.5) * 0.1,
      lon: 77.5946 + (Math.random() - 0.5) * 0.1,
      ward_name: `Ward ${i + 1}`,
      demand_score: 0.8 - (i * 0.01),
      gap_score: 0.7 - (i * 0.01),
      transformer_score: 0.6 + (i * 0.01),
      access_score: 0.9,
      composite_rank: i + 1,
      composite_score: 0.85 - (i * 0.01),
      nearest_transformer_id: `TX-${i}`,
      existing_chargers_500m: Math.floor(Math.random() * 5)
    }))
    
    return HttpResponse.json(data)
  })
]
