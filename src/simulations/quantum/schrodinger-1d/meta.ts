import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'schrodinger-1d',
  title: '1D Schrodinger Equation',
  description:
    'Visualize stationary-state wavefunctions for classic 1D quantum potentials: infinite well, harmonic oscillator, finite well, step potential, and double well.',
  domain: PhysicsDomain.Quantum,
  level: EducationLevel.Undergraduate,
  tags: ['schrodinger', 'wavefunction', 'potential', 'quantum-mechanics', 'eigenstate'],
  equations: [
    '-(\u0127\u00B2/2m) d\u00B2\u03C8/dx\u00B2 + V(x)\u03C8 = E\u03C8',
    '\u03C8_n(x) = sqrt(2/L) sin(n\u03C0x/L)',
    'E_n = n\u00B2\u03C0\u00B2\u0127\u00B2 / (2mL\u00B2)',
  ],
  explanation:
    'The time-independent Schrodinger equation yields quantized energy levels and wavefunctions whose squared modulus gives the probability density of finding a particle at each position.',
  load: () => import('./Schrodinger1dSim.ts'),
};
