import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'semiconductors',
  title: 'Semiconductors & Band Gaps',
  description: 'Visualize energy band diagrams for semiconductors. See how temperature and doping affect carrier concentrations, Fermi level, and conductivity.',
  domain: PhysicsDomain.SolidState,
  level: EducationLevel.Undergraduate,
  tags: ['semiconductor', 'band gap', 'Fermi-Dirac', 'doping', 'valence band', 'conduction band'],
  equations: ['f(E) = 1 / (1 + exp((E - E_F) / kT))', 'n_i = sqrt(N_c * N_v) * exp(-E_g / 2kT)'],
  load: () => import('./SemiconductorsSim.ts'),
};
