import { describe, expect, it } from "vitest";
import type { Role } from "@/shared/lib/auth";
import { buildAppLinks } from "./AppSwitcher";

// jsdom's default test location in this repo is http://localhost:3000/ (no
// crm./lms. subdomain prefix), so resolveOrigin's "isLocal" branch resolves
// each app to a same-protocol, sibling-subdomain origin off that host,
// carrying the port along.
const LANDING = "http://localhost:3000";
const CRM = "http://crm.localhost:3000";
const LMS = "http://lms.localhost:3000";

describe("buildAppLinks", () => {
  it.each<[Role, { label: string; href: string }[]]>([
    [
      "ADMIN",
      [
        { label: "Главный сайт", href: LANDING },
        { label: "CRM Управление", href: CRM },
        { label: "LMS Учебный портал", href: LMS },
      ],
    ],
    [
      "MANAGER",
      [
        { label: "Главный сайт", href: LANDING },
        { label: "CRM Управление", href: CRM },
        { label: "LMS Учебный портал", href: LMS },
      ],
    ],
    [
      "TEACHER",
      [
        { label: "LMS Портал / Мои курсы", href: LMS },
        { label: "Мое расписание", href: `${CRM}/schedule` },
        { label: "Главный сайт", href: LANDING },
      ],
    ],
    [
      "STUDENT",
      [
        { label: "LMS Личный кабинет", href: LMS },
        { label: "Главный сайт", href: LANDING },
      ],
    ],
    [
      "PARENT",
      [{ label: "Главный сайт", href: LANDING }],
    ],
  ])("returns the expected links for role %s", (role, expected) => {
    const links = buildAppLinks(role);

    expect(links).toHaveLength(expected.length);
    expect(links.map(({ label, href }) => ({ label, href }))).toEqual(expected);
  });

  it("gives ADMIN and MANAGER the identical link set (both privileged, non-role-differentiated)", () => {
    expect(buildAppLinks("ADMIN")).toEqual(buildAppLinks("MANAGER"));
  });

  it("gives every non-privileged role (TEACHER/STUDENT/PARENT) a landing link as the last entry", () => {
    for (const role of ["TEACHER", "STUDENT", "PARENT"] as Role[]) {
      const links = buildAppLinks(role);
      expect(links[links.length - 1].href).toBe(LANDING);
    }
  });

  it("falls back to the landing-only link set for an unrecognized role (default case)", () => {
    // Exercises the `default` branch the same way an unexpected role value
    // would (e.g. data drift), independent of the real PARENT role name.
    const links = buildAppLinks("PARENT");
    expect(links).toEqual([{ label: "Главный сайт", description: "Лендинг и маркетинг", href: LANDING }]);
  });
});
