import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'lagrangian-mechanics',
  title: 'Lagrangian Mechanics',
  description: 'Explore Lagrangian formulation with configurable systems: bead on a parabola, Atwood machine, and rolling disk on an incline. See generalized coordinates, equations of motion, and energy conservation.',
  domain: PhysicsDomain.Mechanics,
  level: EducationLevel.Graduate,
  tags: ['Lagrangian', 'generalized coordinates', 'Euler-Lagrange', 'analytical mechanics', 'constraints'],
  equations: ['L = T - V', 'd/dt(\u2202L/\u2202q\u0307) - \u2202L/\u2202q = 0'],
  explanation: 'The Lagrangian formulation of classical mechanics uses generalized coordinates and the principle of least action. The Euler-Lagrange equations automatically account for constraints, making complex systems tractable.',
  load: () => import('./LagrangianMechanicsSim.ts'),
};
