import { vi } from "vitest";

type SupabaseResult<TData> = {
  data: TData | null;
  error: { message: string } | null;
};

export function ok<TData>(data: TData): SupabaseResult<TData> {
  return { data, error: null };
}

export function fail(message: string): SupabaseResult<null> {
  return { data: null, error: { message } };
}

export function makeFromMock(
  tables: Record<string, unknown>,
) {
  return vi.fn((table: string) => {
    const mock = tables[table];
    if (!mock) {
      throw new Error(`Unexpected table "${table}" in test mock`);
    }
    return mock;
  });
}
