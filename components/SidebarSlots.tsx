"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Side = "left" | "right";

const SidebarSlotContext = createContext<{
  left: HTMLElement | null;
  right: HTMLElement | null;
  setLeft: (node: HTMLElement | null) => void;
  setRight: (node: HTMLElement | null) => void;
} | null>(null);

export function SidebarSlotProvider({ children }: { children: ReactNode }) {
  const [left, setLeft] = useState<HTMLElement | null>(null);
  const [right, setRight] = useState<HTMLElement | null>(null);
  return (
    <SidebarSlotContext.Provider value={{ left, right, setLeft, setRight }}>
      {children}
    </SidebarSlotContext.Provider>
  );
}

/** The sidebar mount node, or null when that sidebar is closed. */
export function useSidebarSlot(side: Side): HTMLElement | null {
  const ctx = useContext(SidebarSlotContext);
  if (!ctx) return null;
  return side === "left" ? ctx.left : ctx.right;
}

/** Mount point inside a sidebar. Graph pages portal their controls here. */
export function SidebarSlot({ side }: { side: Side }) {
  const ctx = useContext(SidebarSlotContext);
  if (!ctx) return null;
  const setNode = side === "left" ? ctx.setLeft : ctx.setRight;
  return <div ref={setNode} />;
}

export function SidebarFill({
  side,
  children,
}: {
  side: Side;
  children: ReactNode;
}) {
  const ctx = useContext(SidebarSlotContext);
  const node = side === "left" ? ctx?.left : ctx?.right;
  if (!node) return null;
  return createPortal(children, node);
}
