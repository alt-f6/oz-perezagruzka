import { describe, expect, it } from "vitest";
import { REGIONS } from "./regions";

describe("REGIONS", () => {
  it("has exactly the three KhMAO regional slugs", () => {
    expect(Object.keys(REGIONS).sort()).toEqual(["khanty-mansiysk", "nizhnevartovsk", "surgut"]);
  });

  it("only sets an office address for khanty-mansiysk", () => {
    expect(REGIONS.surgut.hasOffice).toBe(false);
    expect(REGIONS.surgut.officeAddress).toBeUndefined();
    expect(REGIONS.nizhnevartovsk.hasOffice).toBe(false);
    expect(REGIONS.nizhnevartovsk.officeAddress).toBeUndefined();
    expect(REGIONS["khanty-mansiysk"].hasOffice).toBe(true);
    expect(REGIONS["khanty-mansiysk"].officeAddress).toBe("ул. Калинина, 26, Ханты-Мансийск, ХМАО–Югра");
  });

  it("matches the spec's exact title/description copy per region", () => {
    expect(REGIONS.surgut.title).toBe("Подготовка к ОГЭ и ЕГЭ в Сургуте | Онлайн-школа «Перезагрузка»");
    expect(REGIONS.nizhnevartovsk.title).toBe(
      "Подготовка к ОГЭ и ЕГЭ в Нижневартовске | Онлайн-школа «Перезагрузка»",
    );
    expect(REGIONS["khanty-mansiysk"].title).toBe(
      "Подготовка к ОГЭ и ЕГЭ в Ханты-Мансийске | Ул. Калинина, 26",
    );
  });
});
