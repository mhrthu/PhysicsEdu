export type DerivativeFunc = (state: number[], t: number) => number[];

export function eulerStep(state: number[], t: number, dt: number, f: DerivativeFunc): number[] {
  const d = f(state, t);
  return state.map((s, i) => s + d[i] * dt);
}

export function rk4Step(state: number[], t: number, dt: number, f: DerivativeFunc): number[] {
  const k1 = f(state, t);
  const s2 = state.map((s, i) => s + k1[i] * dt / 2);
  const k2 = f(s2, t + dt / 2);
  const s3 = state.map((s, i) => s + k2[i] * dt / 2);
  const k3 = f(s3, t + dt / 2);
  const s4 = state.map((s, i) => s + k3[i] * dt);
  const k4 = f(s4, t + dt);
  return state.map((s, i) => s + (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) * dt / 6);
}

export function verletStep(
  pos: number[], vel: number[], acc: (p: number[]) => number[], dt: number
): { pos: number[]; vel: number[] } {
  const a = acc(pos);
  const newPos = pos.map((p, i) => p + vel[i] * dt + 0.5 * a[i] * dt * dt);
  const newA = acc(newPos);
  const newVel = vel.map((v, i) => v + 0.5 * (a[i] + newA[i]) * dt);
  return { pos: newPos, vel: newVel };
}
