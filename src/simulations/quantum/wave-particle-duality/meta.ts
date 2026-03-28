import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'wave-particle-duality',
  title: 'Wave-Particle Duality (Double Slit)',
  description:
    'Fire particles one at a time through a double slit and watch the quantum interference pattern emerge on the detection screen.',
  domain: PhysicsDomain.Quantum,
  level: EducationLevel.HighSchool,
  tags: ['double-slit', 'interference', 'wave-particle', 'quantum'],
  equations: [
    'I(y) = I₀ cos²(πdy / λL)',
    'Δy = λL / d',
    'P(y) ∝ cos²(πdy / λL) sinc²(πay / λL)',
  ],
  explanation:
    'The double-slit experiment demonstrates wave-particle duality: individual particles arrive as discrete points, yet their cumulative pattern reveals wave-like interference fringes.',
  load: () => import('./WaveParticleDualitySim.ts'),
};
