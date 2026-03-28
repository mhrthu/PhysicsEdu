import type { SimulationMeta } from './types.ts';

const catalog = new Map<string, SimulationMeta>();

export function registerSimulation(meta: SimulationMeta): void {
  catalog.set(meta.id, meta);
}

export function getAllSimulations(): SimulationMeta[] {
  return Array.from(catalog.values());
}

export function getSimulation(id: string): SimulationMeta | undefined {
  return catalog.get(id);
}

export function getSimulationIds(): string[] {
  return Array.from(catalog.keys());
}
