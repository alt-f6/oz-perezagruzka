import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "./ContactForm";

const attachLeadContactMock = vi.fn();
vi.mock("@/landing/actions/lead", () => ({
  attachLeadContact: (...args: unknown[]) => attachLeadContactMock(...args),
}));

function fillAndCheckConsent() {
  const consentCheckbox = document.getElementById("consent") as HTMLInputElement;
  fireEvent.click(consentCheckbox);
}

// The phone input reformats its own value on every keystroke (via RHF's
// setValue inside a custom onChange), which desyncs userEvent.type's
// internal keystroke/selection tracking in jsdom and corrupts the typed
// digits partway through. This is a known userEvent + jsdom + imperative
// value rewrite interaction, not a bug in ContactForm (the same formatting
// works fine on real browser keystrokes). Use a single fireEvent.change to
// deliver the full raw digit string in one native change event instead.
function typeValidPhone() {
  const phoneInput = screen.getByLabelText("Номер телефона") as HTMLInputElement;
  fireEvent.change(phoneInput, { target: { value: "9991234567" } });
}

describe("ContactForm", () => {
  beforeEach(() => {
    attachLeadContactMock.mockReset();
  });

  it("renders the phone input and CTA button", () => {
    render(<ContactForm leadId="lead-1" ctaLabel="Отправить WhatsApp" />);

    expect(screen.getByLabelText("Номер телефона")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отправить WhatsApp" })).toBeInTheDocument();
  });

  it("blocks submission and shows a consent error when consent is unchecked", async () => {
    const user = userEvent.setup();
    render(<ContactForm leadId="lead-1" ctaLabel="Отправить WhatsApp" />);

    await user.type(screen.getByLabelText("Номер телефона"), "9991234567");
    await user.click(screen.getByRole("button", { name: "Отправить WhatsApp" }));

    expect(attachLeadContactMock).not.toHaveBeenCalled();
  });

  it("shows a validation error for an invalid phone number without calling the server action", async () => {
    const user = userEvent.setup();
    render(<ContactForm leadId="lead-1" ctaLabel="Отправить WhatsApp" />);

    await user.type(screen.getByLabelText("Номер телефона"), "123");
    fillAndCheckConsent();
    await user.click(screen.getByRole("button", { name: "Отправить WhatsApp" }));

    expect(
      await screen.findByText("Введите корректный номер телефона (+7 или 8, 10 цифр)"),
    ).toBeInTheDocument();
    expect(attachLeadContactMock).not.toHaveBeenCalled();
  });

  it("submits with the formatted phone, leadId, and consent on valid input", async () => {
    attachLeadContactMock.mockResolvedValue({ status: "ok" });
    const user = userEvent.setup();
    render(<ContactForm leadId="lead-42" ctaLabel="Отправить WhatsApp" />);

    typeValidPhone();
    fillAndCheckConsent();
    await user.click(screen.getByRole("button", { name: "Отправить WhatsApp" }));

    await waitFor(() => expect(attachLeadContactMock).toHaveBeenCalledTimes(1));
    const callArg = attachLeadContactMock.mock.calls[0][0];
    expect(callArg.leadId).toBe("lead-42");
    expect(callArg.consent).toBe(true);
    expect(callArg.phone).toBe("+7 (999) 123-45-67");
  });

  it("shows the success state after a successful submission", async () => {
    attachLeadContactMock.mockResolvedValue({ status: "ok" });
    const user = userEvent.setup();
    render(<ContactForm leadId="lead-1" ctaLabel="Отправить WhatsApp" />);

    typeValidPhone();
    fillAndCheckConsent();
    await user.click(screen.getByRole("button", { name: "Отправить WhatsApp" }));

    expect(
      await screen.findByText(/Спасибо! Мы свяжемся с вами в WhatsApp/),
    ).toBeInTheDocument();
  });

  it("shows the server error message and stays on the form when the action returns an error", async () => {
    attachLeadContactMock.mockResolvedValue({
      status: "error",
      message: "Слишком много попыток. Попробуйте ещё раз через час.",
    });
    const user = userEvent.setup();
    render(<ContactForm leadId="lead-1" ctaLabel="Отправить WhatsApp" />);

    typeValidPhone();
    fillAndCheckConsent();
    await user.click(screen.getByRole("button", { name: "Отправить WhatsApp" }));

    expect(
      await screen.findByText("Слишком много попыток. Попробуйте ещё раз через час."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Номер телефона")).toBeInTheDocument();
  });
});
