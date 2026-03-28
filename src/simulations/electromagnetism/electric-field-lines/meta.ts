import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'electric-field-lines',
  title: 'Electric Field Lines',
  description: 'Visualize electric field lines from point charges. Add positive and negative charges to see field lines, equipotential contours, and field strength color maps in real-time.',
  domain: PhysicsDomain.Electromagnetism,
  level: EducationLevel.HighSchool,
  tags: ['electric field', 'field lines', 'equipotential', 'charge', 'electrostatics'],
  equations: ['E = kq/r\u00b2', 'V = kq/r'],
  explanation: 'Electric field lines show the direction a positive test charge would move. They originate from positive charges and terminate on negative charges. Line density indicates field strength. Equipotential lines are perpendicular to field lines.',
  load: () => import('./ElectricFieldLinesSim.ts'),
};
