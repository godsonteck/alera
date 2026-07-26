import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

configure({
  asyncUtilTimeout: 5000,
});

afterEach(() => {
  cleanup();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
