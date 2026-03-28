import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'orbital-mechanics',
  title: 'Orbital Mechanics',
  description: 'Two-body gravitational orbits with Verlet integration. Drag the orbiter to reposition it and adjust parameters to observe elliptical, circular, parabolic, and hyperbolic trajectories.',
  domain: PhysicsDomain.Mechanics,
  level: EducationLevel.Undergraduate,
  tags: ['orbits', 'gravity', 'Kepler', 'ellipse', 'energy', 'two-body'],
  equations: ['F = GMm/r\u00b2', 'E = \u00bdmv\u00b2 - GMm/r', 'v_circ = \u221a(GM/r)'],
  explanation: 'The orbit shape depends on the total mechanical energy. Negative energy yields bound elliptical orbits, zero energy gives a parabolic escape trajectory, and positive energy produces hyperbolic orbits.',
  load: () => import('./OrbitalMechanicsSim.ts'),
};
