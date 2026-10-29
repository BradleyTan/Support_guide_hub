"use client";

import { createContext, useContext } from "react";

const OwnerContext = createContext(false);

/** Tells client components whether the signed-in person is the team owner. Hiding a control is a courtesy; the server and database enforce it. */
export function TeamProvider({ isOwner, children }: { isOwner: boolean; children: React.ReactNode }) {
  return <OwnerContext.Provider value={isOwner}>{children}</OwnerContext.Provider>;
}

export function useIsOwner(): boolean {
  return useContext(OwnerContext);
}
