import type { SimulationMeta } from '@/catalog/types.ts';
import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'projectile-motion',
  title: 'Projectile Motion',
  description: 'Launch a ball at an angle and watch it trace a parabolic path. Explore how angle, speed, and gravity affect range and height.',
  domain: PhysicsDomain.Mechanics,
  level: EducationLevel.Elementary,
  tags: ['kinematics', 'gravity', 'parabola', 'trajectory'],
  equations: ['x = v₀cos(θ)·t', 'y = v₀sin(θ)·t - ½gt²', 'R = v₀²sin(2θ)/g'],
  load: () => import('./ProjectileMotionSim.ts'),
};
