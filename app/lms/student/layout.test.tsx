import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireRoleForPageMock = vi.hoisted(() => vi.fn());
const hasTutorAccessMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/rbac", () => ({ requireRoleForPage: requireRoleForPageMock }));
vi.mock("@/lms/server/access/has-tutor-access", () => ({ hasTutorAccess: hasTutorAccessMock }));
// TopNav's NavLink calls usePathname() and LogoutButton calls useRouter();
// both return null/throw in jsdom unless mocked, matching the existing
// pattern in LessonTheaterViewer.test.tsx.
vi.mock("next/navigation", () => ({
  usePathname: () => "/student/lessons",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const { default: StudentLayout } = await import("./layout");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StudentLayout tutor nav gating", () => {
  it("shows the tutor link when the student has an active assignment", async () => {
    requireRoleForPageMock.mockResolvedValue({ id: "student_1", role: "STUDENT" });
    hasTutorAccessMock.mockResolvedValue(true);

    const element = await StudentLayout({ children: <div /> });
    render(element);

    expect(screen.getByText("ИИ-репетитор")).toBeInTheDocument();
  });

  it("hides the tutor link when the student has no assignment", async () => {
    requireRoleForPageMock.mockResolvedValue({ id: "student_2", role: "STUDENT" });
    hasTutorAccessMock.mockResolvedValue(false);

    const element = await StudentLayout({ children: <div /> });
    render(element);

    expect(screen.queryByText("ИИ-репетитор")).not.toBeInTheDocument();
  });

  it("always shows the tutor link for an ADMIN bypassing into the student layout", async () => {
    requireRoleForPageMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });

    const element = await StudentLayout({ children: <div /> });
    render(element);

    expect(screen.getByText("ИИ-репетитор")).toBeInTheDocument();
    expect(hasTutorAccessMock).not.toHaveBeenCalled();
  });
});
