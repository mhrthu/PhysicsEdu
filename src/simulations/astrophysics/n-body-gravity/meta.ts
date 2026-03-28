import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'n-body-gravity',
  title: 'N-Body Gravity',
  description:
    'Simulate gravitational interactions between multiple bodies. Add bodies by clicking and dragging to set velocity. Explore orbital dynamics with presets like binary stars and the figure-8 three-body solution.',
  domain: PhysicsDomain.Astrophysics,
  level: EducationLevel.Undergraduate,
  tags: ['gravity', 'orbits', 'n-body', 'celestial mechanics', 'Newton'],
  equations: ['F = Gm₁m₂/r²', 'a = F/m', 'v(t+dt) = v(t) + a·dt'],
  load: () => import('./NBodyGravitySim.ts'),
};
