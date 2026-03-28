import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'chladni-figures',
  title: 'Chladni Figures',
  description: 'Explore 2D vibration modes of a square plate. Sand particles drift toward nodal lines, revealing the beautiful geometric patterns predicted by mode numbers (m, n).',
  domain: PhysicsDomain.Acoustics,
  level: EducationLevel.HighSchool,
  tags: ['chladni', 'vibration', 'modes', 'nodal-lines', 'plate'],
  equations: ['z(x,y,t) = cos(mπx/L)·cos(nπy/L)·cos(ωt)', 'f_mn = (c/2L)√(m² + n²)'],
  load: () => import('./ChladniFiguresSim.ts'),
};
