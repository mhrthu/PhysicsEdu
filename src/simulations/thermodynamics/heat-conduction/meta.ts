import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'heat-conduction',
  title: 'Heat Conduction',
  description: 'Visualize 2D heat diffusion on a grid. Place hot and cold sources and watch temperature propagate following the heat equation.',
  domain: PhysicsDomain.Thermodynamics,
  level: EducationLevel.HighSchool,
  tags: ['heat', 'conduction', 'diffusion', 'temperature', 'Fourier', 'thermal'],
  equations: ['\u2202T/\u2202t = \u03B1\u2207\u00B2T', 'q = -k\u2207T'],
  load: () => import('./HeatConductionSim.ts'),
};
