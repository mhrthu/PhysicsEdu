import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'standing-waves',
  title: 'Standing Waves on a String',
  description: 'Visualize standing wave patterns on a vibrating string. Change the harmonic number to see different modes, and explore how tension affects wave speed and frequency.',
  domain: PhysicsDomain.Optics,
  level: EducationLevel.HighSchool,
  tags: ['standing waves', 'harmonics', 'nodes', 'antinodes', 'resonance', 'string'],
  equations: ['y(x,t) = A\u00B7sin(n\u03C0x/L)\u00B7cos(\u03C9t)', 'v = \u221A(T/\u03BC)', 'f = nv/(2L)'],
  load: () => import('./StandingWavesSim.ts'),
};
