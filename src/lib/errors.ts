export async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      return data.error;
    }
  } catch {
    // Use the fallback when the server returns an empty or non-JSON error body.
  }

  return fallback;
}
