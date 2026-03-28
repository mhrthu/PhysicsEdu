import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'circuit-builder',
  title: 'DC Circuit Builder',
  description: 'Build simple series and parallel DC circuits with resistors and batteries. Visualize current flow with animated dots and voltage at each node.',
  domain: PhysicsDomain.Electromagnetism,
  level: EducationLevel.HighSchool,
  tags: ['circuit', 'ohm', 'resistor', 'battery', 'current', 'voltage', 'DC'],
  equations: ['V = IR', 'P = IV', 'R_series = R\u2081 + R\u2082 + ...'],
  explanation: "Ohm's Law relates voltage, current, and resistance in a circuit. In a series circuit, resistances add directly. Current flows from high to low potential, driven by the battery's electromotive force.",
  load: () => import('./CircuitBuilderSim.ts'),
};
