import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'hydrogen-orbitals',
  title: 'Hydrogen Atom Orbitals',
  description:
    'Explore 2D cross-sections of hydrogen atom probability densities for different quantum numbers n, l, and m. See the shapes of s, p, d, and f orbitals.',
  domain: PhysicsDomain.Quantum,
  level: EducationLevel.Undergraduate,
  tags: ['hydrogen', 'orbitals', 'spherical-harmonics', 'quantum-numbers', 'atomic-physics'],
  equations: [
    '\u03C8_{nlm}(r,\u03B8,\u03C6) = R_{nl}(r) Y_{lm}(\u03B8,\u03C6)',
    'R_{nl}(r) = N e^{-r/na\u2080} (2r/na\u2080)^l L^{2l+1}_{n-l-1}(2r/na\u2080)',
    '|\u03C8|^2 = probability density',
  ],
  explanation:
    'Hydrogen wavefunctions are products of radial functions and spherical harmonics. The quantum numbers n, l, m determine the orbital shape, size, and orientation.',
  load: () => import('./HydrogenOrbitalsSim.ts'),
};
