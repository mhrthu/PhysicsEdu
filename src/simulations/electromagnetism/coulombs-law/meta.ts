import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'coulombs-law',
  title: "Coulomb's Law",
  description: 'Explore the electrostatic force between two point charges. Drag charges to reposition and observe how force scales with distance and charge magnitude.',
  domain: PhysicsDomain.Electromagnetism,
  level: EducationLevel.MiddleSchool,
  tags: ['coulomb', 'electrostatics', 'force', 'charge', 'electric'],
  equations: ['F = kq\u2081q\u2082/r\u00b2', 'k = 8.99 \u00d7 10\u2079 N\u00b7m\u00b2/C\u00b2'],
  explanation: "Coulomb's Law describes the force between two point charges. The force is proportional to the product of the charges and inversely proportional to the square of the distance between them. Like charges repel; opposite charges attract.",
  load: () => import('./CoulombsLawSim.ts'),
};
