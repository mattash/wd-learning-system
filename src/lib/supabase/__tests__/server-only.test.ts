import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Supabase server helpers", () => {
  it("marks the admin client module as server-only", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/supabase/server.ts"), "utf8");

    expect(source).toMatch(/^import "server-only";/);
  });
});
