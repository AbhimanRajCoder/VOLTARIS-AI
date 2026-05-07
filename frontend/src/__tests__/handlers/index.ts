import { forecastHandlers } from './forecast.handlers'
import { schedulerHandlers } from './schedule.handlers'
import { infraHandlers } from './infra.handlers'
import { alertsHandlers } from './alerts.handlers'
import { briefingHandlers } from './briefing.handlers'
import { simulateHandlers } from './simulate.handlers'

export const handlers = [
  ...forecastHandlers,
  ...schedulerHandlers,
  ...infraHandlers,
  ...alertsHandlers,
  ...briefingHandlers,
  ...simulateHandlers
]
