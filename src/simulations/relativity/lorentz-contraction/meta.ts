import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'lorentz-contraction',
  title: 'Lorentz Contraction',
  description: 'See how objects shorten along their direction of motion as they approach the speed of light. Compare the rest-frame length with the contracted length in real time.',
  domain: PhysicsDomain.Relativity,
  level: EducationLevel.Undergraduate,
  tags: ['special relativity', 'length contraction', 'lorentz factor', 'lorentz transformation'],
  equations: ['L = L\u2080/\u03B3 = L\u2080\u221A(1 - v\u00B2/c\u00B2)', '\u03B3 = 1/\u221A(1 - v\u00B2/c\u00B2)'],
  load: () => import('./LorentzContractionSim.ts'),
};
