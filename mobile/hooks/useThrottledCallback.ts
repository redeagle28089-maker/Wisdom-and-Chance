import { useCallback, useRef } from 'react';

export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 400,
  deps: any[] = [],
): T {
  const lastCallRef = useRef<number>(0);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: any[]) => {
    const now = Date.now();
    if (now - lastCallRef.current < delay) return;
    lastCallRef.current = now;
    return callbackRef.current(...args);
  }, [delay, ...deps]) as T;
}

export function useNavigationGuard() {
  const navigatingRef = useRef(false);

  const guardedNavigate = useCallback((fn: () => void) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    fn();
    setTimeout(() => {
      navigatingRef.current = false;
    }, 1000);
  }, []);

  return guardedNavigate;
}
