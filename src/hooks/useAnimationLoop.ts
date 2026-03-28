import { useEffect, useLayoutEffect, useRef } from 'react';

export function useAnimationLoop(
  callback: (deltaTime: number) => void,
  active: boolean
): void {
  const callbackRef = useRef(callback);
  const rafIdRef = useRef(0);
  const lastTimeRef = useRef(0);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!active) {
      lastTimeRef.current = 0;
      return;
    }
    const loop = (time: number) => {
      const dt = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = time;
      callbackRef.current(Math.min(dt, 0.1));
      rafIdRef.current = requestAnimationFrame(loop);
    };
    rafIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [active]);
}
