import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'karman-vortex',
  title: 'K\u00e1rm\u00e1n Vortex Street',
  description: 'Flow past a cylinder produces alternating vortices \u2014 the famous K\u00e1rm\u00e1n vortex street. Control Reynolds number to see laminar vs turbulent transition.',
  domain: PhysicsDomain.FluidAero,
  level: EducationLevel.Undergraduate,
  tags: ['karman', 'vortex', 'reynolds', 'turbulence', 'cylinder', 'CFD'],
  equations: ['Re = \u03c1VL/\u03bc', '\u03c9 = \u2202v/\u2202x \u2212 \u2202u/\u2202y'],
  explanation: 'At low Reynolds numbers (Re < 40), flow around a cylinder is steady and attached. Above Re \u2248 40, the wake becomes unstable and alternating vortices detach periodically, forming the K\u00e1rm\u00e1n vortex street. The Strouhal number St \u2248 0.2 describes the shedding frequency.',
  load: () => import('./KarmanVortexSim.ts'),
};
