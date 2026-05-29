import { describe, expect, it } from "vitest";
import { readErrorMessage } from "@/lib/errors";

describe("readErrorMessage", () => {
  it("returns the error field from a JSON response", async () => {
    const response = { json: async () => ({ error: "Something went wrong" }) } as Response;
    const result = await readErrorMessage(response, "Fallback");
    expect(result).toBe("Something went wrong");
  });

  it("returns the fallback when the response has no error field", async () => {
    const response = { json: async () => ({ message: "ok" }) } as Response;
    const result = await readErrorMessage(response, "Fallback");
    expect(result).toBe("Fallback");
  });

  it("returns the fallback when response.json throws", async () => {
    const response = { json: async () => { throw new Error("Invalid JSON"); } } as Response;
    const result = await readErrorMessage(response, "Fallback");
    expect(result).toBe("Fallback");
  });

  it("returns the fallback when the error field is not a string", async () => {
    const response = { json: async () => ({ error: 123 }) } as Response;
    const result = await readErrorMessage(response, "Fallback");
    expect(result).toBe("Fallback");
  });
});
