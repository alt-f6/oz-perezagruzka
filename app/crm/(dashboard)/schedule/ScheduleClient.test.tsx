import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { todayKey } from "@/crm/lib/calendarGrid";
import { moscowDateKey, moscowDateTimeToUtc } from "@/shared/lib/timezone";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/crm/components/ToastProvider", () => ({ useToast: () => toastMock }));

const actionsMock = vi.hoisted(() => ({
  createLesson: vi.fn(),
  duplicateWeekScheduleAction: vi.fn(),
}));
vi.mock("../lessons/actions", () => actionsMock);

const routerMock = vi.hoisted(() => ({ push: vi.fn() }));
let currentSearchParams = new URLSearchParams("");
// Real Next.js soft-navigates on router.push to the same route: it updates
// what useSearchParams() returns and re-renders subscribers without a full
// reload. The plain `() => currentSearchParams` mock can't reproduce that --
// pushing wouldn't trigger a re-render -- so ScheduleClient's own
// view/date-switcher buttons (which call router.push, not a local setState)
// would appear to do nothing in tests. This tiny store + useState subscriber
// makes push() actually flow back into what the component reads, matching
// real browser behavior closely enough for the existing click-driven tests.
const searchParamsSubscribers = new Set<(next: URLSearchParams) => void>();
function pushSearchParams(url: string) {
  const qs = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  currentSearchParams = new URLSearchParams(qs);
  searchParamsSubscribers.forEach((notify) => notify(currentSearchParams));
}
routerMock.push.mockImplementation((url: string) => {
  pushSearchParams(url);
});
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/schedule",
  useSearchParams: () => {
    const [params, setParams] = useState(currentSearchParams);
    useEffect(() => {
      searchParamsSubscribers.add(setParams);
      return () => {
        searchParamsSubscribers.delete(setParams);
      };
    }, []);
    return params;
  },
}));

const { ScheduleClient, PIXELS_PER_HOUR } = await import("./ScheduleClient");

const groups = [{ id: "g1", name: "Группа 1" }];
const teachers = [{ id: "t1", fullName: "Иван Иванов" }];

// Returns the UTC instant whose Europe/Moscow (UTC+3) wall-clock is hour:minute
// on today's MOSCOW calendar date (matching moscowDateKey(new Date()), which
// is what ScheduleClient now defaults selectedDate to). A naive
// "new Date() with UTC hours overwritten" would instead anchor to today's
// UTC calendar date, which silently disagrees with the Moscow calendar date
// for the ~3h/day window where the two are on different days -- exactly the
// window that made these tests flaky.
function todayAt(hour: number, minute: number): string {
  return moscowDateTimeToUtc(
    moscowDateKey(new Date()),
    `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
  ).toISOString();
}

function makeLesson(overrides: Partial<Parameters<typeof ScheduleClient>[0]["lessons"][number]>) {
  return {
    id: "s1",
    scheduledAt: todayAt(15, 0),
    groupId: "g1",
    teacherId: "t1",
    status: "scheduled",
    durationMinutes: 60,
    group: { id: "g1", name: "Группа 1" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentSearchParams = new URLSearchParams("");
});

describe("ScheduleClient", () => {
  it("hides cancelled sessions from the day view by default", () => {
    render(
      <ScheduleClient
        lessons={[makeLesson({ status: "cancelled" })]}
        groups={groups}
        teachers={teachers}
      />,
    );
    expect(screen.queryByTestId("session-block-s1")).not.toBeInTheDocument();
  });

  it("reveals cancelled sessions once the toggle is checked", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleClient
        lessons={[makeLesson({ status: "cancelled" })]}
        groups={groups}
        teachers={teachers}
      />,
    );

    await user.click(screen.getByLabelText("Показать отменённые"));
    expect(screen.getByTestId("session-block-s1")).toBeInTheDocument();
  });

  it("positions a day-view block using scheduledAt/durationMinutes-derived top and height", () => {
    render(
      <ScheduleClient lessons={[makeLesson({})]} groups={groups} teachers={teachers} />,
    );
    const block = screen.getByTestId("session-block-s1");
    expect(block.style.top).not.toBe("");
    expect(block.style.height).not.toBe("");
  });

  it("clamps a late-starting long lesson's block so it never overflows past the day grid", () => {
    // 23:00 + 120 min would run past midnight -- the block must stay within
    // the 24h-tall grid container instead of bleeding into whatever follows.
    const lesson = makeLesson({
      id: "s1",
      scheduledAt: todayAt(23, 0),
      durationMinutes: 120,
    });
    render(<ScheduleClient lessons={[lesson]} groups={groups} teachers={teachers} />);
    const block = screen.getByTestId("session-block-s1");
    const top = parseFloat(block.style.top);
    const height = parseFloat(block.style.height);
    expect(top + height).toBeLessThanOrEqual(24 * PIXELS_PER_HOUR);
  });

  it("does not clamp a normal-hours 90-minute lesson's block height", () => {
    const lesson = makeLesson({
      id: "s1",
      scheduledAt: todayAt(15, 0),
      durationMinutes: 90,
    });
    render(<ScheduleClient lessons={[lesson]} groups={groups} teachers={teachers} />);
    const block = screen.getByTestId("session-block-s1");
    expect(parseFloat(block.style.height)).toBeCloseTo(1.5 * PIXELS_PER_HOUR, 0);
  });

  it("positions the day-view block at the same hour its own label displays (no self-contradiction)", () => {
    // 21:30 UTC is 00:30 Moscow (UTC+3) the NEXT calendar day. With TZ=UTC
    // forced (vitest.config.ts), raw Date#getHours()/getDate() getters read
    // this instant as "21:30 on the 23rd", while the Moscow-pinned label
    // (formatTimeRange) correctly reads "00:30 on the 24th". A fix that only
    // patches the position math (e.g. a hardcoded "+3 hours" shortcut)
    // without properly rolling over the day would still fail this: it has to
    // both bucket the lesson under the 24th AND position it at hour 0.
    const lesson = makeLesson({
      id: "s1",
      scheduledAt: "2026-08-23T21:30:00.000Z", // 00:30 Moscow, Aug 24
      durationMinutes: 45,
    });
    render(<ScheduleClient lessons={[lesson]} groups={groups} teachers={teachers} />);

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-08-24" } });

    const card = screen.getByTestId("session-block-s1");
    const top = parseFloat(card.style.top);
    expect(top).toBeCloseTo(0.5 * PIXELS_PER_HOUR, 0); // 00:30 → half an hour into the grid
    expect(within(card).getByText(/00:30–01:15/)).toBeInTheDocument();
  });

  it("shows compact HH:mm–HH:mm range text in month view", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleClient lessons={[makeLesson({})]} groups={groups} teachers={teachers} />,
    );

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    expect(screen.getByText(/15:00–16:00/)).toBeInTheDocument();
  });

  it("hides the create-lesson control for teachers", () => {
    render(
      <ScheduleClient
        lessons={[makeLesson({})]}
        groups={groups}
        teachers={teachers}
        userRole="TEACHER"
      />,
    );
    expect(screen.queryByText("Новое занятие")).not.toBeInTheDocument();
  });

  it("shows the create-lesson control for admins/managers", () => {
    render(
      <ScheduleClient
        lessons={[makeLesson({})]}
        groups={groups}
        teachers={teachers}
        userRole="ADMIN"
      />,
    );
    expect(screen.getByText("Новое занятие")).toBeInTheDocument();
  });

  it("shows the assigned teacher's name on a day-view session card", () => {
    const lesson = makeLesson({
      id: "s1",
      teacherId: "t1",
      teacher: { fullName: "Иван Иванов" },
      group: { id: "g1", name: "Группа А" },
    });
    render(<ScheduleClient lessons={[lesson]} groups={groups} teachers={teachers} />);

    const card = screen.getByTestId("session-block-s1");
    expect(within(card).getByText("Иван Иванов")).toBeInTheDocument();
  });

  it("shows a 'no teacher assigned' fallback when teacher is missing", () => {
    const lesson = makeLesson({
      id: "s2",
      teacherId: "t-missing",
      teacher: null,
      group: { id: "g1", name: "Группа А" },
    });
    render(<ScheduleClient lessons={[lesson]} groups={groups} teachers={teachers} />);

    const card = screen.getByTestId("session-block-s2");
    expect(within(card).getByText("Без преподавателя")).toBeInTheDocument();
  });

  it("shows the group's CURRENT teacher, not the session's stale teacherId snapshot, when the group was reassigned", () => {
    // Mirrors production reports of a schedule card showing an old/admin
    // teacher for a lesson whose group has since been reassigned: the
    // ClassSession row itself still carries the old teacherId, but the
    // group's live teacherId (surfaced via the `groups` prop) is current.
    const groupsWithReassignedTeacher = [
      { id: "g1", name: "Олимпиада права", teacherId: "t2" },
    ];
    const teachersRoster = [
      { id: "t1", fullName: "Главный администратор" },
      { id: "t2", fullName: "Алёна Алексеевна Бычкова" },
    ];
    const lesson = makeLesson({
      id: "s1",
      teacherId: "t1",
      teacher: { fullName: "Главный администратор" },
      group: { id: "g1", name: "Олимпиада права" },
    });
    render(
      <ScheduleClient
        lessons={[lesson]}
        groups={groupsWithReassignedTeacher}
        teachers={teachersRoster}
      />,
    );

    const card = screen.getByTestId("session-block-s1");
    expect(within(card).getByText("Алёна Алексеевна Бычкова")).toBeInTheDocument();
    expect(within(card).queryByText("Главный администратор")).not.toBeInTheDocument();
  });

  it("shows the assigned teacher's name on a week-view session card", async () => {
    const user = userEvent.setup();
    const lesson = makeLesson({
      id: "s1",
      teacherId: "t1",
      teacher: { fullName: "Иван Иванов" },
    });
    render(<ScheduleClient lessons={[lesson]} groups={groups} teachers={teachers} />);

    await user.click(screen.getByRole("button", { name: "Неделя" }));
    const card = screen.getByTestId("week-session-s1");
    expect(within(card).getByText("Иван Иванов")).toBeInTheDocument();
  });

  it("shows a Sunday lesson in the week view under its own day column", async () => {
    const user = userEvent.setup();
    // 2026-09-20 is a Sunday. 09:00 Moscow (UTC+3) = 06:00Z.
    const lesson = makeLesson({
      id: "sunday1",
      scheduledAt: "2026-09-20T06:00:00.000Z",
      teacherId: "t1",
      teacher: { fullName: "Назар Михеев" },
    });
    render(<ScheduleClient lessons={[lesson]} groups={groups} teachers={teachers} />);

    await user.click(screen.getByRole("button", { name: "Неделя" }));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-09-20" } });

    const card = screen.getByTestId("week-session-sunday1");
    expect(within(card).getByText(/09:00–10:00/)).toBeInTheDocument();
  });

  it("keeps a short-duration day-view block tall enough to fit the teacher badge without clipping", () => {
    const lesson = makeLesson({
      id: "s1",
      teacherId: "t1",
      teacher: { fullName: "Иван Иванов" },
      durationMinutes: 30,
    });
    render(<ScheduleClient lessons={[lesson]} groups={groups} teachers={teachers} />);

    const block = screen.getByTestId("session-block-s1");
    // A 30-min lesson is time-proportionally only 32px tall (30/60 * 64px) —
    // not enough room for a title+time line plus the teacher badge line at
    // readable sizes. The block enforces a minimum height so the badge is
    // never squeezed out by overflow-hidden clipping.
    const height = parseFloat(block.style.height);
    expect(height).toBeGreaterThanOrEqual(40);

    const badge = within(block).getByText("Иван Иванов");
    expect(badge).toBeVisible();
  });

  it("does not show a success toast when createLesson returns a missingPriceWarning instead of persisting", async () => {
    // Regression: a student with no prior individual-lesson price history
    // makes createLesson return `missingPriceWarning` (nothing persisted) --
    // the UI must surface the warning dialog, not a false "Занятие создано".
    const studentId = "550e8400-e29b-41d4-a716-446655440001";
    const teacherId = "550e8400-e29b-41d4-a716-446655440002";
    const user = userEvent.setup();
    actionsMock.createLesson.mockResolvedValue({
      missingPriceWarning: { studentId, studentName: "Назар Михеев" },
    });

    render(
      <ScheduleClient
        lessons={[]}
        groups={groups}
        teachers={[{ id: teacherId, fullName: "Иван Иванов" }]}
        students={[{ id: studentId, fullName: "Назар Михеев" }]}
        userRole="ADMIN"
      />,
    );

    await user.click(screen.getByText("Новое занятие"));
    await user.click(screen.getByRole("button", { name: "Индивидуальное занятие" }));

    await user.selectOptions(screen.getByDisplayValue("Выберите ученика..."), studentId);
    await user.selectOptions(screen.getByDisplayValue("Выберите преподавателя..."), teacherId);

    await user.click(screen.getByText("Выберите дату"));
    fireEvent.click(document.querySelector(`[data-day="${todayKey()}"]`) as HTMLElement);

    await user.click(screen.getByRole("button", { name: "09:00" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("У ученика нет истории цены")).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalledWith("Занятие создано");
  });

  it("surfaces a second warning (not the stale first one) after acknowledging the first, and creates once both are acknowledged", async () => {
    // Regression: missingPriceWarning followed by availabilityWarning on the
    // ack-retry used to leave BOTH warning states set, and the stale
    // missingPrice dialog painted over the real (availability) one forever.
    const studentId = "550e8400-e29b-41d4-a716-446655440001";
    const teacherId = "550e8400-e29b-41d4-a716-446655440002";
    const user = userEvent.setup();

    actionsMock.createLesson
      .mockResolvedValueOnce({
        missingPriceWarning: { studentId, studentName: "Назар Михеев" },
      })
      .mockResolvedValueOnce({
        availabilityWarning: {
          teacherId,
          occurrences: [{ scheduledAt: todayAt(9, 0), label: "сегодня в 09:00" }],
        },
      })
      .mockResolvedValueOnce({});

    render(
      <ScheduleClient
        lessons={[]}
        groups={groups}
        teachers={[{ id: teacherId, fullName: "Иван Иванов" }]}
        students={[{ id: studentId, fullName: "Назар Михеев" }]}
        userRole="ADMIN"
      />,
    );

    await user.click(screen.getByText("Новое занятие"));
    await user.click(screen.getByRole("button", { name: "Индивидуальное занятие" }));
    await user.selectOptions(screen.getByDisplayValue("Выберите ученика..."), studentId);
    await user.selectOptions(screen.getByDisplayValue("Выберите преподавателя..."), teacherId);
    await user.click(screen.getByText("Выберите дату"));
    fireEvent.click(document.querySelector(`[data-day="${todayKey()}"]`) as HTMLElement);
    await user.click(screen.getByRole("button", { name: "09:00" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("У ученика нет истории цены")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Создать с ценой 0 ₽" }));

    // The stale price-history dialog must be gone, and the real, second
    // warning must be the one visible.
    expect(screen.queryByText("У ученика нет истории цены")).not.toBeInTheDocument();
    expect(
      await screen.findByText("Преподаватель не отметил это время рабочим"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Всё равно создать" }));

    // The toast is mocked, so just assert it was called, not that the text appears in DOM
    expect(toastMock).toHaveBeenCalledWith("Занятие создано");
    // Both acknowledgements must have been carried through to the final call.
    expect(actionsMock.createLesson).toHaveBeenLastCalledWith(
      expect.objectContaining({
        acknowledgeMissingPrice: true,
        acknowledgeUnavailable: true,
      }),
    );
  });

  it("filters to only needs-attention lessons when the toggle is checked", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleClient
        lessons={[
          makeLesson({ id: "s1", needsAttention: true }),
          makeLesson({ id: "s2", needsAttention: false }),
        ]}
        groups={groups}
        teachers={teachers}
      />,
    );

    expect(screen.getByTestId("session-block-s1")).toBeInTheDocument();
    expect(screen.getByTestId("session-block-s2")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Требуют отметки"));

    expect(screen.getByTestId("session-block-s1")).toBeInTheDocument();
    expect(screen.queryByTestId("session-block-s2")).not.toBeInTheDocument();
  });

  it("defaults to today's Moscow date when the URL has no date param, and pushes (not replaces) on navigation", async () => {
    const user = userEvent.setup();
    render(<ScheduleClient lessons={[]} groups={groups} teachers={teachers} />);

    // Next-day nav button is the ChevronRight icon button; it has no
    // accessible name, so it's located via the lucide icon class rather than
    // a label, and asserted via the pushed URL to stay resilient to markup.
    const nextDayButton = document
      .querySelector("svg.lucide-chevron-right")
      ?.closest("button") as HTMLButtonElement;
    await user.click(nextDayButton);

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    const [url, opts] = routerMock.push.mock.calls[0];
    expect(url).toMatch(/^\/schedule\?/);
    expect(new URL(url, "http://x").searchParams.get("date")).toBeTruthy();
    expect(opts).toEqual({ scroll: false });
  });

  it("reads the initial date and view from the URL instead of defaulting to today", () => {
    currentSearchParams = new URLSearchParams("date=2026-01-15&view=week");
    render(
      <ScheduleClient
        lessons={[makeLesson({ id: "s1", scheduledAt: "2026-01-15T09:00:00.000Z" })]}
        groups={groups}
        teachers={teachers}
      />,
    );

    // Week view renders the week grid; the session for the URL's date must
    // be visible without any date-navigation click.
    expect(screen.getByTestId("week-session-s1")).toBeInTheDocument();
  });

  it("shows a compact teacher label on month-view chips", async () => {
    const user = userEvent.setup();
    const lesson = makeLesson({
      id: "s1",
      teacherId: "t1",
      teacher: { fullName: "Иван Иванов" },
    });
    render(<ScheduleClient lessons={[lesson]} groups={groups} teachers={teachers} />);

    await user.click(screen.getByRole("button", { name: "Месяц" }));
    const chip = screen.getByTestId("month-chip-s1");
    expect(within(chip).getByText(/Иван Иванов/)).toBeInTheDocument();
  });

  it("shows an error toast (instead of an unhandled rejection) when the duplicate-schedule dry-run preview throws", async () => {
    const user = userEvent.setup();
    actionsMock.duplicateWeekScheduleAction.mockRejectedValue(new Error("network error"));
    render(<ScheduleClient lessons={[]} groups={groups} teachers={teachers} />);

    await user.click(screen.getByRole("button", { name: "Неделя" }));
    await user.click(
      screen.getByRole("button", { name: "Скопировать расписание на следующую неделю" }),
    );

    expect(toastMock).toHaveBeenCalledWith("Не удалось скопировать расписание", "error");
  });
});

describe("ScheduleClient non-Moscow display timezone", () => {
  it("positions and labels a lesson using displayTimezone, with an MSK badge", () => {
    render(
      <ScheduleClient
        lessons={[makeLesson({ scheduledAt: todayAt(15, 0) })]} // 15:00 Moscow
        groups={groups}
        teachers={teachers}
        displayTimezone="Asia/Baku"
      />,
    );
    // 15:00 Moscow (UTC+3) = 16:00 Baku (UTC+4).
    expect(screen.getByText("16:00–17:00 (60 мин)")).toBeInTheDocument();
    expect(screen.getByText(/15:00–16:00 \(60 мин\) МСК/)).toBeInTheDocument();
  });

  it("shows no MSK badge when displayTimezone is Moscow (default)", () => {
    render(
      <ScheduleClient
        lessons={[makeLesson({ scheduledAt: todayAt(15, 0) })]}
        groups={groups}
        teachers={teachers}
      />,
    );
    expect(screen.getByText("15:00–16:00 (60 мин)")).toBeInTheDocument();
    expect(screen.queryByText(/МСК/)).not.toBeInTheDocument();
  });

  it("shifts a late-evening lesson into the next day's column for a zone ahead of Moscow", () => {
    const lateLesson = makeLesson({
      id: "s-late",
      scheduledAt: moscowDateTimeToUtc("2026-09-07", "23:00").toISOString(),
    });
    // Drive the URL date directly (currentSearchParams is the mutable module-scope
    // store this file's next/navigation mock reads from -- see the top of this
    // file) instead of clicking through the date picker, so the test is a precise,
    // single-day assertion rather than depending on "today".
    currentSearchParams = new URLSearchParams("date=2026-09-08");
    render(
      <ScheduleClient
        lessons={[lateLesson]}
        groups={groups}
        teachers={teachers}
        displayTimezone="Asia/Novosibirsk" // UTC+7, 4h ahead of Moscow.
      />,
    );
    // 23:00 Moscow on the 7th = 20:00Z = 03:00 Novosibirsk on the 8th -- must
    // appear on the 8th, not the 7th.
    expect(screen.getByTestId("session-block-s-late")).toBeInTheDocument();
  });

  it("keeps the same lesson on its original day when displayTimezone is Moscow", () => {
    const lateLesson = makeLesson({
      id: "s-late",
      scheduledAt: moscowDateTimeToUtc("2026-09-07", "23:00").toISOString(),
    });
    currentSearchParams = new URLSearchParams("date=2026-09-08");
    render(<ScheduleClient lessons={[lateLesson]} groups={groups} teachers={teachers} />);
    // Still the 7th in Moscow, so viewing the 8th must NOT show it.
    expect(screen.queryByTestId("session-block-s-late")).not.toBeInTheDocument();
  });
});
