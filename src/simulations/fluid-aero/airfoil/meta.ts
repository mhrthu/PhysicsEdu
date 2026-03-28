import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'airfoil',
  title: 'Airfoil & Lift',
  description: 'NACA airfoil with adjustable angle of attack. Visualize streamlines, pressure distribution, and lift generation via Bernoulli\'s principle.',
  domain: PhysicsDomain.FluidAero,
  level: EducationLevel.Undergraduate,
  tags: ['airfoil', 'lift', 'drag', 'NACA', 'aerodynamics', 'bernoulli', 'streamline'],
  equations: ['C\u1d38 = 2\u03c0(\u03b1 + \u03b1\u2080)', 'L = \u00bdρV\u00b2C\u1d38S'],
  explanation: 'The NACA 4-digit series airfoil is parameterized by camber, camber position, and thickness. Thin airfoil theory predicts lift coefficient CL = 2\u03c0(\u03b1 \u2212 \u03b1\u2080), showing linear lift slope of 2\u03c0 per radian. At high angles of attack (stall), the flow separates and lift drops.',
  load: () => import('./AirfoilSim.ts'),
};
