import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'ideal-gas-law',
  title: 'Ideal Gas Law',
  description: 'Watch animated particles bounce inside a container and see how pressure, volume, and temperature relate through PV = nRT. Drag the wall to change volume.',
  domain: PhysicsDomain.Thermodynamics,
  level: EducationLevel.MiddleSchool,
  tags: ['gas', 'pressure', 'volume', 'temperature', 'PV=nRT', 'particles', 'kinetic theory'],
  equations: ['PV = nRT', 'KE = (3/2)kT', 'P = NkT/V'],
  load: () => import('./IdealGasLawSim.ts'),
};
