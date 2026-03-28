import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'superconductivity',
  title: 'Superconductivity & Meissner Effect',
  description: 'Observe the Meissner effect as a superconductor expels magnetic field lines below its critical temperature. Watch a magnet levitate and resistance drop to zero.',
  domain: PhysicsDomain.SolidState,
  level: EducationLevel.Graduate,
  tags: ['superconductor', 'Meissner effect', 'critical temperature', 'levitation', 'YBCO'],
  equations: ['R(T > Tc) = R_n', 'R(T < Tc) = 0', 'B_inside = 0 (Meissner)'],
  load: () => import('./SuperconductivitySim.ts'),
};
