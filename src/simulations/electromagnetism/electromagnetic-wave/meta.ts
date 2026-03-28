import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'electromagnetic-wave',
  title: 'Electromagnetic Wave',
  description: 'Visualize a propagating electromagnetic wave with orthogonal E and B fields rendered in pseudo-3D perspective. Explore linear and circular polarization.',
  domain: PhysicsDomain.Electromagnetism,
  level: EducationLevel.Undergraduate,
  tags: ['electromagnetic wave', 'polarization', 'E field', 'B field', 'Maxwell'],
  equations: ['c = \u03BBf', 'c = 1/\u221A(\u03BC\u2080\u03B5\u2080)', 'E \u22A5 B \u22A5 k'],
  explanation: 'An electromagnetic wave consists of oscillating electric (E) and magnetic (B) fields that are perpendicular to each other and to the direction of propagation. The wave travels at the speed of light c.',
  load: () => import('./ElectromagneticWaveSim.ts'),
};
