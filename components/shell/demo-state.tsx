"use client";

import { createContext, useContext, useState } from "react";

/** Prototype-only: lets the reviewer preview each screen's empty, loading and error states. */
export type DemoState = "populated" | "empty" | "loading" | "error";

const DemoStateContext = createContext<{ state: DemoState; setState: (s: DemoState) => void }>({
  state: "populated",
  setState: () => {},
});

export function DemoStateProvider({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  // Keyed by pathname so every new screen starts populated.
  const [entry, setEntry] = useState<{ path: string; state: DemoState }>({ path: pathname, state: "populated" });
  const state = entry.path === pathname ? entry.state : "populated";
  return (
    <DemoStateContext.Provider value={{ state, setState: (s) => setEntry({ path: pathname, state: s }) }}>
      {children}
    </DemoStateContext.Provider>
  );
}

export function useDemoState() {
  return useContext(DemoStateContext);
}
