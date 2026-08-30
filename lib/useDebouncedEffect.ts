"use client";

import { useEffect, useRef } from "react";

// Runs `callback(value)` `delay` ms after `value` stops changing — used to
// push search-as-you-type into the URL without firing a server request (and
// a full page re-render) on every keystroke. Skips the very first run so it
// doesn't immediately re-push whatever value the field already started with
// (e.g. a search term loaded from the URL on page load).
export function useDebouncedEffect(
  value: string,
  delay: number,
  callback: (value: string) => void
) {
  const isFirstRun = useRef(true);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const handle = setTimeout(() => callbackRef.current(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
}
