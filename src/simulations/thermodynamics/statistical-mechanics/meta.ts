import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'statistical-mechanics',
  title: 'Statistical Mechanics',
  description: 'Visualize the Boltzmann distribution and watch particles populate energy levels according to n_i proportional to exp(-E_i/kT). Explore partition functions and ensemble types.',
  domain: PhysicsDomain.Thermodynamics,
  level: EducationLevel.Graduate,
  tags: ['Boltzmann', 'partition function', 'ensemble', 'energy levels', 'statistical', 'entropy'],
  equations: ['n_i \u221D exp(-E_i/kT)', 'Z = \u03A3 exp(-E_i/kT)', 'S = k ln \u03A9'],
  load: () => import('./StatisticalMechanicsSim.ts'),
};
