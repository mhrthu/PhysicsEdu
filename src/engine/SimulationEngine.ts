import type { SimulationConfig } from './types.ts';
import type { ControlDescriptor } from '@/controls/types.ts';

export abstract class SimulationEngine {
  protected canvas!: HTMLCanvasElement;
  protected ctx!: CanvasRenderingContext2D;
  protected width = 0;
  protected height = 0;
  protected pixelRatio = 1;
  protected running = false;
  protected speed = 1.0;
  protected time = 0;

  init(canvas: HTMLCanvasElement, config: SimulationConfig): void {
    this.canvas = canvas;
    this.width = config.canvasWidth;
    this.height = config.canvasHeight;
    this.pixelRatio = config.pixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');
    this.ctx = ctx;
    this.setup();
  }

  abstract setup(): void;
  abstract update(dt: number): void;
  abstract render(): void;
  abstract reset(): void;
  abstract getControlDescriptors(): ControlDescriptor[];
  abstract getControlValues(): Record<string, number | boolean | string>;
  abstract setControlValue(key: string, value: number | boolean | string): void;

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.render();
  }

  step(): void {
    const fixedDt = 1 / 60;
    this.update(fixedDt * this.speed);
    this.render();
  }

  setSpeed(s: number): void { this.speed = s; }
  pause(): void { this.running = false; }
  resume(): void { this.running = true; }
  isRunning(): boolean { return this.running; }
  getTime(): number { return this.time; }
  dispose(): void {}

  onPointerDown?(x: number, y: number): void;
  onPointerMove?(x: number, y: number): void;
  onPointerUp?(x: number, y: number): void;
}
