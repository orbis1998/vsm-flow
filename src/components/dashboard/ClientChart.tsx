import { useEffect, useState, type ReactNode } from "react";

export function useNarrow(bp = 700) {
  const [n, setN] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(`(max-width: ${bp}px)`).matches : false,
  );
  useEffect(() => {
    const q = window.matchMedia(`(max-width: ${bp}px)`);
    const go = () => setN(q.matches);
    go();
    q.addEventListener("change", go);
    return () => q.removeEventListener("change", go);
  }, [bp]);
  return n;
}

export function ClientChart({ children, height = 280 }: { children: ReactNode; height?: number }) {
  const [ready, setReady] = useState(false);
  const narrow = useNarrow();
  useEffect(() => {
    setReady(true);
  }, []);
  const h = height <= 48 ? height : narrow ? Math.min(height, 210) : height;
  if (!ready) return <div className="dash-chart-skel" style={{ height: h }} aria-hidden />;
  return (
    <div className="dash-chart" style={{ height: h }}>
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
