import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'spacetime-fabric',
  title: 'Spacetime Fabric',
  description: 'Visualize how mass curves spacetime by deforming a 2D grid. Drag the massive object and watch test particles roll along the curvature toward it.',
  domain: PhysicsDomain.Relativity,
  level: EducationLevel.Graduate,
  tags: ['general relativity', 'spacetime curvature', 'gravity well', 'geodesic'],
  equations: ['g\u2098\u2099 curvature', 'depression ~ GM/(rc\u00B2)'],
  load: () => import('./SpacetimeFabricSim.ts'),
};
