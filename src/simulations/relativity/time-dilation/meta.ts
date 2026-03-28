import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'time-dilation',
  title: 'Time Dilation Visualizer',
  description: 'Watch two light clocks side by side — one stationary, one moving — and see how a moving clock ticks slower due to the longer diagonal photon path predicted by special relativity.',
  domain: PhysicsDomain.Relativity,
  level: EducationLevel.HighSchool,
  tags: ['special relativity', 'time dilation', 'light clock', 'lorentz factor'],
  equations: ['γ = 1/√(1 - v²/c²)', "t' = γt"],
  load: () => import('./TimeDilationSim.ts'),
};
