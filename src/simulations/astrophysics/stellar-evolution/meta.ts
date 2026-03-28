import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'stellar-evolution',
  title: 'Stellar Evolution & HR Diagram',
  description:
    'Explore the Hertzsprung-Russell diagram and watch stars evolve through their life cycle. Trace evolutionary tracks from the main sequence through red giant, horizontal branch, and final states depending on initial mass.',
  domain: PhysicsDomain.Astrophysics,
  level: EducationLevel.Undergraduate,
  tags: ['HR diagram', 'stellar evolution', 'main sequence', 'red giant', 'white dwarf', 'supernova'],
  equations: ['L = 4 pi R^2 sigma T^4', 'L_ms ~ M^3.5', 't_ms ~ M/L ~ M^{-2.5}'],
  load: () => import('./StellarEvolutionSim.ts'),
};
