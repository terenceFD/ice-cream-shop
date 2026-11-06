import { useEffect, useState } from "react";

// The header search opens a results list over the page on phones. Floating widgets
// pinned to the bottom-right corner would sit on top of it, so the header publishes
// the open state here and those widgets step aside while it is showing.
const listeners = new Set<(isOpen: boolean) => void>();
let isOpen = false;

export function setSearchOpen(next: boolean) {
  if (isOpen === next) return;
  isOpen = next;
  for (const listener of listeners) listener(next);
}

export function useSearchOpen() {
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
