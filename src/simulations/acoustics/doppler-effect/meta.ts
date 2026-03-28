import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'doppler-effect',
  title: 'Doppler Effect',
  description: 'Visualize how a moving sound source compresses wavefronts ahead and stretches them behind, shifting the observed frequency for listeners at different positions.',
  domain: PhysicsDomain.Acoustics,
  level: EducationLevel.Elementary,
  tags: ['doppler', 'frequency', 'wavefronts', 'sound', 'observer'],
  equations: ['f_obs = f_src × (v_sound + v_observer) / (v_sound + v_source)'],
  load: () => import('./DopplerEffectSim.ts'),
};
