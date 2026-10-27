import { describe, it, expect } from "vitest";
import { initialItems, progress } from "./checklist-data";

describe("progress", () => {
  it("ignores N/A items in the total", () => {
    const p = progress(initialItems, "esther");
    expect(p.total).toBe(29);
    expect(p.done).toBe(0);
  });
  it("counts Feito as done", () => {
    expect(progress(initialItems, "jonathan")).toMatchObject({ done: 1, total: 30 });
  });
});
