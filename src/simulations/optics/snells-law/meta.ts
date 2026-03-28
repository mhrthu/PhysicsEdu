import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'snells-law',
  title: 'Snell\'s Law / Refraction',
  description: 'Explore how light bends at the boundary between two media. Adjust the angle and materials to observe refraction, reflection, and total internal reflection.',
  domain: PhysicsDomain.Optics,
  level: EducationLevel.MiddleSchool,
  tags: ['refraction', 'snell', 'optics', 'total internal reflection', 'light'],
  equations: ['n\u2081\u00B7sin(\u03B8\u2081) = n\u2082\u00B7sin(\u03B8\u2082)', '\u03B8c = arcsin(n\u2082/n\u2081)'],
  load: () => import('./SnellsLawSim.ts'),
};
