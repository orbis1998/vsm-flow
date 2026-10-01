import { useEffect, useState, type ReactNode } from "react";

export function ClientChart({ children, height = 280 }: { children: ReactNode; height?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  if (!ready) return <div className="dash-chart-skel" style={{ height }} aria-hidden />;
  return (
    <div className="dash-chart" style={{ height }}>
      {children}
    </div>
  );
}

export function useCountUp(value: number, ms = 780) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const e = 1 - (1 - p) ** 3;
      setN(from + (value - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return n;
}
