import { describe, expect, it } from "vitest";

import { csvValue } from "@/lib/csv";

describe("csvValue", () => {
  it("quotes and escapes ordinary cells", () => {
    expect(csvValue('St. "A"')).toBe('"St. ""A"""');
  });

  it.each(["=", "+", "-", "@", "\t", "\r", "\n"])("neutralizes spreadsheet formula prefix %s", (prefix) => {
    expect(csvValue(`${prefix}danger`)).toBe(`"'${prefix}danger"`);
  });
});
