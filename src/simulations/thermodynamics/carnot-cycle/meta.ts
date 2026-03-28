import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'carnot-cycle',
  title: 'Carnot Cycle',
  description: 'Explore the most efficient thermodynamic cycle with animated PV and TS diagrams. See how hot and cold reservoir temperatures determine maximum efficiency.',
  domain: PhysicsDomain.Thermodynamics,
  level: EducationLevel.Undergraduate,
  tags: ['Carnot', 'engine', 'efficiency', 'PV diagram', 'TS diagram', 'isothermal', 'adiabatic'],
  equations: ['\u03B7 = 1 - T_cold/T_hot', 'PV = nRT', 'TV^(\u03B3-1) = const'],
  load: () => import('./CarnotCycleSim.ts'),
};
