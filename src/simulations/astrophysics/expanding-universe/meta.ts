import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'expanding-universe',
  title: 'Expanding Universe',
  description:
    'Solve the Friedmann equation to model the expansion history of the universe. Visualize the scale factor evolution and watch galaxies recede according to different cosmological models.',
  domain: PhysicsDomain.Astrophysics,
  level: EducationLevel.Graduate,
  tags: ['cosmology', 'Friedmann equation', 'dark energy', 'Hubble', 'Big Bang', 'expansion'],
  equations: [
    '(a_dot/a)^2 = H_0^2 (Omega_m/a^3 + Omega_Lambda + Omega_k/a^2)',
    'H(t) = a_dot / a',
    'q = -a * a_dotdot / a_dot^2',
  ],
  load: () => import('./ExpandingUniverseSim.ts'),
};
