import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

function createMemoryStorage(): Storage {
  let store: Record<string, string> = {};

  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return store[key] ?? null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
  };
}

const existingStorage = globalThis.localStorage;

if (
  typeof existingStorage?.clear !== "function" ||
  typeof existingStorage?.setItem !== "function"
) {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: createMemoryStorage(),
  });

  if (typeof globalThis.window !== "undefined") {
    Object.defineProperty(globalThis.window, "localStorage", {
      configurable: true,
      value: globalThis.localStorage,
    });
  }
}

afterEach(() => {
  cleanup();
  globalThis.localStorage.clear();
  delete document.documentElement.dataset.theme;
});
