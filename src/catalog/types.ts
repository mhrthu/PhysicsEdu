import type { SimulationEngine } from '@/engine/SimulationEngine.ts';

export enum EducationLevel {
  Elementary = 'Elementary',
  MiddleSchool = 'Middle School',
  HighSchool = 'High School',
  Undergraduate = 'Undergraduate',
  Graduate = 'Graduate',
}

export enum PhysicsDomain {
  Mechanics = 'Mechanics',
  Thermodynamics = 'Thermodynamics',
  Electromagnetism = 'Electromagnetism',
  Quantum = 'Quantum & Nuclear',
  Astrophysics = 'Astrophysics',
  Optics = 'Optics',
  FluidAero = 'Fluid & Aero',
  Relativity = 'Relativity',
  Acoustics = 'Acoustics',
  SolidState = 'Solid State',
}

export interface SimulationMeta {
  id: string;
  title: string;
  description: string;
  domain: PhysicsDomain;
  level: EducationLevel;
  tags: string[];
  equations?: string[];
  explanation?: string;
  load: () => Promise<{ default: new () => SimulationEngine }>;
}

export const LEVEL_COLORS: Record<EducationLevel, string> = {
  [EducationLevel.Elementary]: '#22c55e',
  [EducationLevel.MiddleSchool]: '#3b82f6',
  [EducationLevel.HighSchool]: '#f59e0b',
  [EducationLevel.Undergraduate]: '#a855f7',
  [EducationLevel.Graduate]: '#ef4444',
};

export const DOMAIN_COLORS: Record<PhysicsDomain, string> = {
  [PhysicsDomain.Mechanics]: '#f97316',
  [PhysicsDomain.Thermodynamics]: '#ef4444',
  [PhysicsDomain.Electromagnetism]: '#3b82f6',
  [PhysicsDomain.Quantum]: '#a855f7',
  [PhysicsDomain.Astrophysics]: '#06b6d4',
  [PhysicsDomain.Optics]: '#84cc16',
  [PhysicsDomain.FluidAero]: '#14b8a6',
  [PhysicsDomain.Relativity]: '#f472b6',
  [PhysicsDomain.Acoustics]: '#fb923c',
  [PhysicsDomain.SolidState]: '#38bdf8',
};

export const DOMAIN_ICONS: Record<PhysicsDomain, string> = {
  [PhysicsDomain.Mechanics]: '⚙',
  [PhysicsDomain.Thermodynamics]: '🌡',
  [PhysicsDomain.Electromagnetism]: '⚡',
  [PhysicsDomain.Quantum]: '⚛',
  [PhysicsDomain.Astrophysics]: '🌌',
  [PhysicsDomain.Optics]: '🔬',
  [PhysicsDomain.FluidAero]: '🌊',
  [PhysicsDomain.Relativity]: '🚀',
  [PhysicsDomain.Acoustics]: '🔊',
  [PhysicsDomain.SolidState]: '💎',
};
