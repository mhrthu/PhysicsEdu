import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'spring-mass',
  title: 'Spring-Mass Oscillator',
  description: 'A mass attached to a spring oscillating with optional damping. Drag the mass to set the initial displacement and observe Hooke\'s law in action.',
  domain: PhysicsDomain.Mechanics,
  level: EducationLevel.HighSchool,
  tags: ['spring', 'oscillation', 'Hooke\'s law', 'damping', 'harmonic motion', 'energy'],
  equations: ['F = -kx', '\u03c9 = \u221a(k/m)', 'T = 2\u03c0/\u03c9', 'E = \u00bdkx\u00b2 + \u00bdmv\u00b2'],
  explanation: 'The spring-mass system follows Hooke\'s law where the restoring force is proportional to displacement. With damping, the system exhibits underdamped, critically damped, or overdamped behavior depending on the damping ratio.',
  load: () => import('./SpringMassSim.ts'),
};
