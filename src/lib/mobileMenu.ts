import { useEffect, useState } from "react";

// The header's hamburger drawer covers the whole phone screen. The floating widgets
// (currency switcher, live chat) are pinned to the bottom corners, so they would sit on
// top of the drawer. The header publishes the drawer state here and those widgets hide
// while it is open.
const listeners = new Set<(isOpen: boolean) => void>();
let isOpen = false;

export function setMobileMenuOpen(next: boolean) {
  if (isOpen === next) return;
  isOpen = next;
  for (const listener of listeners) listener(next);
}

export function useMobileMenuOpen() {
  const [open, setOpen] = useState(isOpen);
  useEffect(() => {
    listeners.add(setOpen);
    setOpen(isOpen);
    return () => {
      listeners.delete(setOpen);
    };
  }, []);
  return open;
}
