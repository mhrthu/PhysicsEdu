import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'inclined-plane',
  title: 'Inclined Plane',
  description: 'A block sliding on a ramp with friction. Explore force decomposition, normal forces, and the role of friction in determining motion.',
  domain: PhysicsDomain.Mechanics,
  level: EducationLevel.MiddleSchool,
  tags: ['inclined plane', 'friction', 'forces', 'normal force', 'gravity'],
  equations: ['F\u2225 = mg sin\u03b8', 'F\u22a5 = mg cos\u03b8', 'f = \u03bcN'],
  explanation: 'On an inclined plane, gravity decomposes into components parallel and perpendicular to the surface. The block slides when the gravitational component along the ramp exceeds the maximum static friction force.',
  load: () => import('./InclinedPlaneSim.ts'),
};
