import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'ripple-tank',
  title: 'Ripple Tank',
  description:
    '2D wave interference on a water surface. Click to add wave sources. Watch constructive and destructive interference patterns form.',
  domain: PhysicsDomain.Optics,
  level: EducationLevel.MiddleSchool,
  tags: ['waves', 'interference', 'superposition', 'diffraction', 'water'],
  equations: ['ψ(x,y,t) = A·sin(kr - ωt) / r^d', 'k = 2π/λ', 'ω = 2πf'],
  load: () => import('./RippleTankSim.ts'),
};
