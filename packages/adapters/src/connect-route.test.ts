import { expect, it, vi } from "vitest";
vi.mock("../../../apps/web/src/composition", () => ({
  createRealtimeCallAnswer: vi.fn(),
}));
import { createRealtimeCallAnswer } from "../../../apps/web/src/composition";
import { POST } from "../../../apps/web/app/api/realtime/connect/route";

it("retires the permanent-key relay without contacting the provider", async () => {
  const response = await POST();
  expect(response.status).toBe(410);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(createRealtimeCallAnswer).not.toHaveBeenCalled();
});
