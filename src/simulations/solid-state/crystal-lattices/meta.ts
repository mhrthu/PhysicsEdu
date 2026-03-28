import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'crystal-lattices',
  title: 'Crystal Lattices',
  description: 'Explore 3D crystal structures in isometric projection. Compare Simple Cubic, BCC, FCC, and Diamond lattices with interactive rotation and bond visualization.',
  domain: PhysicsDomain.SolidState,
  level: EducationLevel.Elementary,
  tags: ['crystal', 'lattice', 'BCC', 'FCC', 'diamond', 'unit cell', 'solid state'],
  equations: ['Packing fraction (FCC) = pi/(3*sqrt(2)) ~ 0.74', 'Coordination number (BCC) = 8'],
  load: () => import('./CrystalLatticesSim.ts'),
};
