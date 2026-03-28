import { EducationLevel, PhysicsDomain } from '@/catalog/types.ts';
import type { SimulationMeta } from '@/catalog/types.ts';

export const meta: SimulationMeta = {
  id: 'rigid-body-collisions',
  title: 'Rigid Body Collisions',
  description: '2D elastic and inelastic collisions between circles. Click and drag to launch new balls and observe conservation of momentum.',
  domain: PhysicsDomain.Mechanics,
  level: EducationLevel.HighSchool,
  tags: ['collisions', 'momentum', 'elastic', 'inelastic', 'restitution', 'kinetic energy'],
  equations: ['p = mv', 'KE = \u00bdmv\u00b2', 'e = v\u2082\u2032-v\u2081\u2032 / v\u2081-v\u2082'],
  explanation: 'In elastic collisions both momentum and kinetic energy are conserved. In inelastic collisions only momentum is conserved while kinetic energy is partially lost. The coefficient of restitution e determines how elastic the collision is.',
  load: () => import('./RigidBodyCollisionsSim.ts'),
};
