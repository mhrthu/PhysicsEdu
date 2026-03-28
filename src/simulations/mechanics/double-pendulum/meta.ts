import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'double-pendulum',
  title: 'Double Pendulum',
  description: 'Two linked pendulums demonstrating chaotic motion. Watch how tiny changes in initial conditions lead to dramatically different trajectories.',
  domain: PhysicsDomain.Mechanics,
  level: EducationLevel.Undergraduate,
  tags: ['chaos', 'double pendulum', 'nonlinear', 'coupled oscillators', 'phase space'],
  equations: [
    '\u03b1\u2081 = f(\u03b8\u2081, \u03b8\u2082, \u03c9\u2081, \u03c9\u2082, m\u2081, m\u2082, L\u2081, L\u2082, g)',
    '\u03b1\u2082 = g(\u03b8\u2081, \u03b8\u2082, \u03c9\u2081, \u03c9\u2082, m\u2081, m\u2082, L\u2081, L\u2082, g)',
  ],
  explanation: 'The double pendulum is a classic example of a chaotic system. While governed by deterministic equations, it exhibits extreme sensitivity to initial conditions, making long-term prediction practically impossible.',
  load: () => import('./DoublePendulumSim.ts'),
};
