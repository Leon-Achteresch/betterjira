import type { JiraMock } from "./mock-backend";

let current: JiraMock | undefined;

const active = () => {
  if (!current) throw new Error("Mock: zuerst useJiraMock(createJiraMock()) aufrufen");
  return current;
};

export const useJiraMock = (mock: JiraMock) => {
  current = mock;
  return mock;
};

export const fetch = (input: RequestInfo | URL, init?: RequestInit) => active().fetch(input, init);

export const invoke = (command: string) => active().invoke(command);

export const getCurrentWindow = () => ({ unminimize: async () => undefined, setFocus: async () => undefined });
