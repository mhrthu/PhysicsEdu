export interface SimulationConfig {
  canvasWidth: number;
  canvasHeight: number;
  pixelRatio: number;
}

export interface SimState {
  time: number;
  running: boolean;
  speed: number;
}
