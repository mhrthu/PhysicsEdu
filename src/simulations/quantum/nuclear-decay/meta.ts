import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'nuclear-decay',
  title: 'Radioactive Decay',
  description:
    'Watch atoms decay stochastically and see the exponential decay law emerge. Compare the actual count with the theoretical N(t) = N0 (1/2)^(t/t1/2) curve.',
  domain: PhysicsDomain.Quantum,
  level: EducationLevel.HighSchool,
  tags: ['radioactive', 'decay', 'half-life', 'exponential', 'nuclear-physics'],
  equations: [
    'N(t) = N\u2080 \u00D7 (1/2)^{t/t\u00BD}',
    '\u03BB = ln(2) / t\u00BD',
    'P(decay in dt) = 1 - e^{-\u03BBdt}',
  ],
  explanation:
    'Radioactive decay is a random quantum process. Each atom has a fixed probability of decaying per unit time, leading to the characteristic exponential decrease in the number of remaining atoms.',
  load: () => import('./NuclearDecaySim.ts'),
};
