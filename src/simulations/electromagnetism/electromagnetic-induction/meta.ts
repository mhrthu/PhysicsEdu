import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'electromagnetic-induction',
  title: 'Electromagnetic Induction',
  description: 'Drag a bar magnet near a coil to induce an EMF. Explore Faraday\'s law and see how changing magnetic flux drives current through a circuit.',
  domain: PhysicsDomain.Electromagnetism,
  level: EducationLevel.HighSchool,
  tags: ['faraday', 'induction', 'emf', 'magnetic flux', 'galvanometer'],
  equations: ['EMF = -N \u00D7 d\u03A6/dt', '\u03A6 = B\u00B7A\u00B7cos(\u03B8)'],
  load: () => import('./ElectromagneticInductionSim.ts'),
};
