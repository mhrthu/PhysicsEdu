import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'chain-reaction',
  title: 'Nuclear Chain Reaction',
  description: 'Watch neutrons trigger a fission chain reaction. Control enrichment, neutrons per fission, and material to see critical, subcritical, and supercritical behavior.',
  domain: PhysicsDomain.Quantum,
  level: EducationLevel.HighSchool,
  tags: ['nuclear', 'fission', 'chain reaction', 'neutron', 'uranium', 'plutonium', 'critical mass'],
  equations: ['k = neutrons produced / neutrons absorbed', 'k < 1: subcritical', 'k = 1: critical', 'k > 1: supercritical'],
  load: () => import('./ChainReactionSim.ts'),
};
