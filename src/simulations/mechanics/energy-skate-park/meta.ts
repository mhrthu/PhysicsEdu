import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'energy-skate-park',
  title: 'Energy Skate Park',
  description: 'Watch a ball roll along a track and see kinetic, potential, and thermal energy transform in real time. Explore conservation of energy with different track shapes and friction.',
  domain: PhysicsDomain.Mechanics,
  level: EducationLevel.MiddleSchool,
  tags: ['energy', 'conservation', 'kinetic', 'potential', 'friction', 'skate park'],
  equations: ['KE = \u00BDmv\u00B2', 'PE = mgh', 'KE + PE + Thermal = E_total'],
  load: () => import('./EnergySkateParkSim.ts'),
};
