import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'magnetic-field',
  title: 'Magnetic Field of Current',
  description: 'Visualize the magnetic field around a current-carrying wire, loop, and solenoid. See field lines, strength color maps, and computed B-field magnitudes.',
  domain: PhysicsDomain.Electromagnetism,
  level: EducationLevel.Undergraduate,
  tags: ['magnetic field', 'Biot-Savart', 'solenoid', 'current', 'Ampere'],
  equations: ['B = \u00b5\u2080I/(2\u03c0r)', 'B = \u00b5\u2080nI', '\u00b5\u2080 = 4\u03c0\u00d710\u207b\u2077 T\u00b7m/A'],
  explanation: 'A current-carrying conductor produces a magnetic field. For a straight wire, the field forms concentric circles. A solenoid produces a nearly uniform field inside. The Biot-Savart law gives the general field from any current distribution.',
  load: () => import('./MagneticFieldSim.ts'),
};
