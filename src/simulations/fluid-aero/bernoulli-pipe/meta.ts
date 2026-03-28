import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'bernoulli-pipe',
  title: 'Bernoulli Pipe Flow',
  description: 'Fluid through a Venturi pipe. Watch pressure and velocity change as the pipe narrows. Bernoulli\'s principle: P + \u00bdρv\u00b2 = constant.',
  domain: PhysicsDomain.FluidAero,
  level: EducationLevel.HighSchool,
  tags: ['bernoulli', 'venturi', 'fluid', 'pressure', 'continuity'],
  equations: ['A\u2081v\u2081 = A\u2082v\u2082', 'P\u2081 + \u00bdρv\u2081\u00b2 = P\u2082 + \u00bdρv\u2082\u00b2'],
  explanation: 'As fluid flows through a constriction, the continuity equation requires the velocity to increase. By Bernoulli\'s principle, higher velocity means lower pressure — this is how carburetors, atomizers, and aircraft wings work.',
  load: () => import('./BernoulliPipeSim.ts'),
};
