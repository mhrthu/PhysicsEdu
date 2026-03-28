import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'navier-stokes',
  title: 'Fluid Simulation',
  description: '2D Eulerian grid fluid simulation with dye injection. Watch vortices, turbulence, and convection cells form.',
  domain: PhysicsDomain.FluidAero,
  level: EducationLevel.Undergraduate,
  tags: ['fluid', 'navier-stokes', 'CFD', 'vortex', 'turbulence', 'eulerian'],
  equations: ['\u2202u/\u2202t + (u\u00b7\u2207)u = -\u2207p/\u03c1 + \u03bd\u2207\u00b2u', '\u2207\u00b7u = 0'],
  explanation: 'Uses Jos Stam\'s Stable Fluids algorithm: semi-Lagrangian advection keeps the simulation stable at any timestep. The pressure projection step enforces incompressibility. Drag on the canvas to inject dye and velocity.',
  load: () => import('./NavierStokesSim.ts'),
};
