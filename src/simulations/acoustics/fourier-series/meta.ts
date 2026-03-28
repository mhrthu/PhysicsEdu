import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'fourier-series',
  title: 'Fourier Series',
  description: 'Decompose periodic waveforms into sine and cosine harmonics. Watch how adding more terms converges the approximation toward square, sawtooth, or triangle waves.',
  domain: PhysicsDomain.Acoustics,
  level: EducationLevel.Undergraduate,
  tags: ['fourier', 'harmonics', 'waveform', 'series', 'frequency-domain'],
  equations: ['f(t) = a₀/2 + Σ(aₙcos(nωt) + bₙsin(nωt))'],
  load: () => import('./FourierSeriesSim.ts'),
};
