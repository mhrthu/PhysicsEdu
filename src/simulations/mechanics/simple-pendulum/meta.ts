import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'simple-pendulum',
  title: 'Simple Pendulum',
  description: 'A mass on a string swinging under gravity. Drag the bob to set the initial angle and observe simple harmonic motion.',
  domain: PhysicsDomain.Mechanics,
  level: EducationLevel.MiddleSchool,
  tags: ['pendulum', 'gravity', 'oscillation', 'period', 'harmonic motion'],
  equations: ['T = 2\u03c0\u221a(L/g)', '\u03b1 = -(g/L) sin(\u03b8)'],
  explanation: 'The simple pendulum demonstrates periodic motion governed by gravity. For small angles, the motion approximates simple harmonic motion with a period that depends only on the string length and gravitational acceleration.',
  load: () => import('./SimplePendulumSim.ts'),
};
