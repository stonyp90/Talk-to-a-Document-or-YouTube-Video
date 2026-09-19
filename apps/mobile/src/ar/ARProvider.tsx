import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { ARSession, type Plane } from "./ARSession";

type ARState = {
  active: boolean;
  planes: Plane[];
  anchored: boolean;
  start: () => void;
  stop: () => void;
  placeAnchor: (position: [number, number, number]) => void;
  toggle: () => void;
};

const ARContext = createContext<ARState>({
  active: false,
  planes: [],
  anchored: false,
  start: () => {},
  stop: () => {},
  placeAnchor: () => {},
  toggle: () => {},
});

export function useAR(): ARState {
  return useContext(ARContext);
}

export function ARProvider({ children }: { children: React.ReactNode }) {
  const session = useRef(new ARSession()).current;
  const [active, setActive] = useState(false);
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [anchored, setAnchored] = useState(false);

  const start = useCallback(() => {
    session.start();
    session.onPlaneDetected((plane) => {
      setPlanes((prev) => {
        const existing = prev.findIndex((p) => p.id === plane.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = plane;
          return next;
        }
        return [...prev, plane];
      });
    });
    setActive(true);
  }, [session]);

  const stop = useCallback(() => {
    session.stop();
    setActive(false);
    setPlanes([]);
    setAnchored(false);
  }, [session]);

  const placeAnchor = useCallback(
    (position: [number, number, number]) => {
      session.placeAnchor(position);
      setAnchored(true);
    },
    [session],
  );

  const toggle = useCallback(() => {
    if (active) stop();
    else start();
  }, [active, start, stop]);

  return (
    <ARContext.Provider value={{ active, planes, anchored, start, stop, placeAnchor, toggle }}>
      {children}
    </ARContext.Provider>
  );
}
