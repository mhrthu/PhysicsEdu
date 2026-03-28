import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'gravitational-lensing',
  title: 'Gravitational Lensing',
  description:
    'Visualize how a massive object warps spacetime and bends the path of light from background stars. Observe Einstein rings and magnification effects predicted by general relativity.',
  domain: PhysicsDomain.Astrophysics,
  level: EducationLevel.Graduate,
  tags: ['general relativity', 'lensing', 'Einstein ring', 'spacetime', 'light bending'],
  equations: ['alpha = 4GM/(rc^2)', 'theta_E = sqrt(4GM D_ls / (c^2 D_l D_s))'],
  load: () => import('./GravitationalLensingSim.ts'),
};
