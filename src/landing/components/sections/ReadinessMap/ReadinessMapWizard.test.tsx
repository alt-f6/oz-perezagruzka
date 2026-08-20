import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReadinessMapWizard from "./ReadinessMapWizard";

const submitReadinessMapMock = vi.fn();
vi.mock("@/landing/actions/readiness", () => ({
  submitReadinessMap: (...args: unknown[]) => submitReadinessMapMock(...args),
}));
vi.mock("./attribution", () => ({
  useAttribution: () => ({ sessionId: "session-1", utm: {} }),
}));
const reachGoalMock = vi.fn();
vi.mock("@/landing/lib/analytics", () => ({
  reachGoal: (...args: unknown[]) => reachGoalMock(...args),
}));

// Step transitions are animated with framer-motion's <AnimatePresence
// mode="wait">, which keeps the outgoing step's content mounted until its
// exit animation finishes (a real, wall-clock-timed animation - jsdom has no
// special-casing for it). If the next step's selector is queried immediately
// after a click, the DOM can still reflect the previous step. Waiting for the
// next step's heading via `findByText` lets the real transition run to
// completion before continuing, matching actual rendered behavior.
async function completeAllStepsExceptConsent(user: ReturnType<typeof userEvent.setup>) {
  // Step 1: name (optional, leave blank)
  await user.click(screen.getByRole("button", { name: "Далее" }));
  await screen.findByText("В каком он классе?");
  // Step 2: grade (defaults to "8", already valid)
  await user.click(screen.getByRole("button", { name: "Далее" }));
  await screen.findByText("К каким предметам нужно подготовиться?");
  // Step 3: subjects
  await user.click(screen.getByRole("button", { name: /Математика/ }));
  await user.click(screen.getByRole("button", { name: "Далее" }));
  await screen.findByText("Как обычно учится?");
  // Step 4: studyStyle
  await user.click(screen.getByRole("button", { name: /Сам и на отлично/ }));
  await user.click(screen.getByRole("button", { name: "Далее" }));
  await screen.findByText("Чем увлекается в свободное время?");
  // Step 5: hobbies
  await user.click(screen.getByRole("button", { name: /Игры \/ IT/ }));
  await user.click(screen.getByRole("button", { name: "Далее" }));
  await screen.findByText("Сколько времени осталось до ОГЭ?");
  // Step 6: deadline
  await user.click(screen.getByRole("button", { name: "3–6 месяцев" }));
}

describe("ReadinessMapWizard", () => {
  beforeEach(() => {
    submitReadinessMapMock.mockReset();
    reachGoalMock.mockReset();
  });

  it("renders the first step with the step counter", () => {
    render(<ReadinessMapWizard />);

    expect(screen.getByText("Шаг 1 из 6: Имя ученика")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Например, Аня")).toBeInTheDocument();
  });

  it("fires a quiz_step_N_completed goal when advancing a step", async () => {
    const user = userEvent.setup();
    render(<ReadinessMapWizard />);

    await user.click(screen.getByRole("button", { name: "Далее" }));
    await screen.findByText("В каком он классе?");

    expect(reachGoalMock).toHaveBeenCalledWith("quiz_step_1_completed");
  });

  it("advances through steps on valid input and reaches the consent checkbox on the last step", async () => {
    const user = userEvent.setup();
    render(<ReadinessMapWizard />);

    await completeAllStepsExceptConsent(user);

    expect(screen.getByText("Шаг 6 из 6: Срок до экзамена")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Получить карту" })).toBeInTheDocument();
    expect(document.getElementById("readiness-consent")).toBeInTheDocument();
  });

  it("blocks final submission and does not call the server action when consent is unchecked", async () => {
    const user = userEvent.setup();
    render(<ReadinessMapWizard />);

    await completeAllStepsExceptConsent(user);
    await user.click(screen.getByRole("button", { name: "Получить карту" }));

    expect(submitReadinessMapMock).not.toHaveBeenCalled();
  });

  it("submits with the collected input and shows the success result on a successful response", async () => {
    submitReadinessMapMock.mockResolvedValue({
      status: "success",
      leadId: "lead-1",
      map: {
        readinessScore: 72,
        whatISee: "Хорошая база",
        attentionZones: ["Геометрия"],
        strengths: ["Алгебра"],
        futurePaths: ["Экономика"],
        firstStep: "Повторить теорему Пифагора",
      },
    });
    const user = userEvent.setup();
    render(<ReadinessMapWizard />);

    await completeAllStepsExceptConsent(user);
    const consentCheckbox = document.getElementById("readiness-consent") as HTMLInputElement;
    await user.click(consentCheckbox);
    await user.click(screen.getByRole("button", { name: "Получить карту" }));

    await waitFor(() => expect(submitReadinessMapMock).toHaveBeenCalledTimes(1));
    const callArg = submitReadinessMapMock.mock.calls[0][0];
    expect(callArg.sessionId).toBe("session-1");
    expect(callArg.consent).toBe(true);
    expect(callArg.input.subjects).toBe("Математика");
    expect(callArg.input.deadline).toBe("3-6m");

    // ResultSuccess does not render the numeric readinessScore anywhere in
    // the DOM (verified by reading ResultSuccess.tsx) - it renders the text
    // blocks (whatISee, attentionZones, etc.) instead, so assert on those.
    expect(await screen.findByText("Карта готовности")).toBeInTheDocument();
    expect(screen.getByText("Хорошая база")).toBeInTheDocument();
    expect(reachGoalMock).toHaveBeenCalledWith("quiz_submitted");
  });

  it("renders the fallback view (with its own ContactForm) when the API call fails Zod validation server-side", async () => {
    submitReadinessMapMock.mockResolvedValue({
      status: "fallback",
      leadId: "lead-2",
      message: "Наш ИИ сейчас перегружен. Мы сохранили вашу заявку.",
    });
    const user = userEvent.setup();
    render(<ReadinessMapWizard />);

    await completeAllStepsExceptConsent(user);
    const consentCheckbox = document.getElementById("readiness-consent") as HTMLInputElement;
    await user.click(consentCheckbox);
    await user.click(screen.getByRole("button", { name: "Получить карту" }));

    expect(
      await screen.findByText("Наш ИИ сейчас перегружен. Мы сохранили вашу заявку."),
    ).toBeInTheDocument();
    expect(screen.getByText("Заявка сохранена")).toBeInTheDocument();
  });

  it("shows a submit error and returns to the form when the action call rejects", async () => {
    submitReadinessMapMock.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<ReadinessMapWizard />);

    await completeAllStepsExceptConsent(user);
    const consentCheckbox = document.getElementById("readiness-consent") as HTMLInputElement;
    await user.click(consentCheckbox);
    await user.click(screen.getByRole("button", { name: "Получить карту" }));

    expect(
      await screen.findByText("Не получилось отправить форму. Проверьте соединение и попробуйте снова."),
    ).toBeInTheDocument();
    expect(screen.getByText("Шаг 6 из 6: Срок до экзамена")).toBeInTheDocument();
  });
});
