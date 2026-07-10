import { useEffect, useState } from "react";

const DEFAULT_FRAME_MS = 33;

/** Drive shader time at a capped frame rate to avoid blocking the JS thread. */
export function useGrainyAnimationTime(active: boolean, speed: number, frameMs = DEFAULT_FRAME_MS) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const interval = setInterval(() => {
      setTime((current) => current + (frameMs / 1000) * speed);
    }, frameMs);

    return () => clearInterval(interval);
  }, [active, frameMs, speed]);

  return time;
}
