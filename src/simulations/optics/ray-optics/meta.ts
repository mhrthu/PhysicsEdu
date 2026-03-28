import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'ray-optics',
  title: 'Ray Optics',
  description:
    'Interactive ray tracing with lenses, mirrors and prisms. Snell\'s law, total internal reflection.',
  domain: PhysicsDomain.Optics,
  level: EducationLevel.HighSchool,
  tags: ['optics', 'refraction', 'snell', 'lens', 'reflection', 'TIR'],
  equations: ['n₁ sin θ₁ = n₂ sin θ₂', '1/f = 1/d + 1/d\'', 'r = d - 2(d·n)n'],
  load: () => import('./RayOpticsSim.ts'),
};
