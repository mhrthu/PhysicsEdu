import { useCallback, useEffect, useRef, useState } from 'react';
import { getSimulation } from '@/catalog/registry.ts';
import type { SimulationEngine } from '@/engine/SimulationEngine.ts';
import type { ControlDescriptor } from '@/controls/types.ts';
import { useAnimationLoop } from './useAnimationLoop.ts';

export function useSimulation(simId: string, canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const engineRef = useRef<SimulationEngine | null>(null);
  const [controlValues, setControlValues] = useState<Record<string, number | boolean | string>>({});
  const [controlDescriptors, setControlDescriptors] = useState<ControlDescriptor[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeedState] = useState(1);
  const [ready, setReady] = useState(false);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    let disposed = false;
    setReady(false);

    const meta = getSimulation(simId);
    if (!meta) return;

    meta.load().then((mod) => {
      if (disposed) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const engine = new mod.default();
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement!.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);

      engine.init(canvas, { canvasWidth: w, canvasHeight: h, pixelRatio: dpr });
      engine.resume();
      sizeRef.current = { w, h, dpr };

      engineRef.current = engine;
      setControlDescriptors(engine.getControlDescriptors());
      setControlValues(engine.getControlValues());
      setIsRunning(true);
      setSpeedState(1);
      setReady(true);
    });

    return () => {
      disposed = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [simId, canvasRef]);

  useAnimationLoop((dt) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isRunning) {
      engine.update(dt * speed);
    }
    engine.render();
  }, ready);

  const setControl = useCallback((key: string, value: number | boolean | string) => {
    engineRef.current?.setControlValue(key, value);
    setControlValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const play = useCallback(() => {
    engineRef.current?.resume();
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.reset();
    setControlValues(engineRef.current?.getControlValues() ?? {});
    setIsRunning(true);
    engineRef.current?.resume();
  }, []);

  const stepForward = useCallback(() => {
    engineRef.current?.step();
  }, []);

  const setSpeed = useCallback((s: number) => {
    engineRef.current?.setSpeed(s);
    setSpeedState(s);
  }, []);

  const handleResize = useCallback((w: number, h: number, dpr: number) => {
    sizeRef.current = { w, h, dpr };
    engineRef.current?.resize(w, h, dpr);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    engineRef.current?.onPointerDown?.(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    engineRef.current?.onPointerMove?.(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  const handlePointerUp = useCallback(() => {
    engineRef.current?.onPointerUp?.(0, 0);
  }, []);

  return {
    engine: engineRef.current,
    controlDescriptors,
    controlValues,
    setControl,
    isRunning,
    speed,
    play,
    pause,
    reset,
    stepForward,
    setSpeed,
    handleResize,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    ready,
  };
}
