import { describe, expect, it } from "vitest";
import { compareRu, sortByRu } from "./sortRu";

describe("compareRu", () => {
  it("compares Cyrillic names case-insensitively", () => {
    expect(compareRu("иванов", "Иванов")).toBe(0);
  });

  it("sorts Ё next to Е instead of dropping it to the bottom of the alphabet", () => {
    const names = ["Юрьев", "Ёлкин", "Единый"];
    expect(sortByRu(names, (n) => n)).toEqual(["Единый", "Ёлкин", "Юрьев"]);
  });
});

describe("sortByRu", () => {
  it("sorts objects by a string key without mutating the input array", () => {
    const items = [{ fullName: "Ольга" }, { fullName: "Андрей" }, { fullName: "борис" }];
    const original = [...items];

    const sorted = sortByRu(items, (i) => i.fullName);

    expect(sorted.map((i) => i.fullName)).toEqual(["Андрей", "борис", "Ольга"]);
    expect(items).toEqual(original);
  });
});
