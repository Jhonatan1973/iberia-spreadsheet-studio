import { describe, it, expect } from "vitest";
import {
  initialItems,
  progress,
  attach,
  detach,
  setAttachmentOwner,
  sortAttachments,
  sumAttachments,
  normalizeNames,
  ownerLabel,
  withAttachments,
  DEFAULT_NAMES,
  type Attachment,
  type Item,
} from "./checklist-data";

const att = (id: string, who: Attachment["who"]): Attachment => ({
  id,
  name: `${id}.pdf`,
  mime: "application/pdf",
  dataUrl: "data:application/pdf;base64,AAAA",
  who,
});

const item = (attachments?: Attachment[]): Item => ({
  ...initialItems[0],
  attachments,
});

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

describe("attachments", () => {
  it("attach appends several files and keeps existing ones", () => {
    const withOne = attach(item([att("a", "jonathan")]), [att("b", "esther"), att("c", "ambos")]);
    expect(withOne.attachments?.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("detach removes only the chosen file", () => {
    const it2 = item([att("a", "jonathan"), att("b", "esther")]);
    expect(detach(it2, "a").attachments?.map((a) => a.id)).toEqual(["b"]);
  });

  it("setAttachmentOwner changes who the file belongs to", () => {
    const it2 = item([att("a", "jonathan")]);
    expect(setAttachmentOwner(it2, "a", "ambos").attachments?.[0].who).toBe("ambos");
  });

  it("sortAttachments orders ambos, jonathan, esther", () => {
    const sorted = sortAttachments([att("e", "esther"), att("j", "jonathan"), att("x", "ambos")]);
    expect(sorted.map((a) => a.id)).toEqual(["x", "j", "e"]);
  });

  it("sumAttachments counts files per owner across items", () => {
    const items = [
      item([att("a", "jonathan"), att("b", "ambos")]),
      item([att("c", "esther"), att("d", "jonathan")]),
    ];
    expect(sumAttachments(items)).toEqual({ jonathan: 2, esther: 1, ambos: 1 });
  });
});

describe("names", () => {
  it("defaults to Jhonatan and Ester", () => {
    expect(DEFAULT_NAMES).toEqual({ jonathan: "Jhonatan", esther: "Ester" });
    expect(normalizeNames(undefined)).toEqual(DEFAULT_NAMES);
  });
  it("keeps custom names and falls back on blanks", () => {
    expect(normalizeNames({ jonathan: "  João ", esther: "" })).toEqual({
      jonathan: "João",
      esther: "Ester",
    });
  });
  it("ownerLabel uses the chosen names", () => {
    const names = { jonathan: "Jhonatan", esther: "Ester" };
    expect(ownerLabel(names, "esther")).toBe("Ester");
    expect(ownerLabel(names, "ambos")).toBe("Dos dois");
  });
});

describe("withAttachments", () => {
  it("groups attachment rows into their items", () => {
    const items = initialItems.slice(0, 2);
    const merged = withAttachments(items, [{ ...att("a", "esther"), itemId: items[1].id }]);
    expect(merged[0].attachments).toEqual([]);
    expect(merged[1].attachments?.map((a) => a.id)).toEqual(["a"]);
    expect(merged[1].attachments?.[0]).not.toHaveProperty("itemId");
  });
});
