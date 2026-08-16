import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const dbMock = vi.hoisted(() => ({
  paymentIntent: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("@/landing/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 59, resetAt: 0 }),
}));

const yookassaMocks = vi.hoisted(() => ({
  fetchPayment: vi.fn(),
  finalizeSuccessfulPayment: vi.fn(),
}));

vi.mock("@/crm/lib/services/yookassa.service", () => ({
  YookassaService: { fetchPayment: yookassaMocks.fetchPayment },
  finalizeSuccessfulPayment: yookassaMocks.finalizeSuccessfulPayment,
}));

const { POST } = await import("./route");

const WEBHOOK_URL = "https://example.com/crm/api/webhooks/yookassa";

function makeRequest(body: unknown, opts: { secret?: string; headers?: Record<string, string> } = {}) {
  const url = new URL(WEBHOOK_URL);
  if (opts.secret) url.searchParams.set("secret", opts.secret);
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...opts.headers },
    body: JSON.stringify(body),
  });
}

const succeededPayment = {
  id: "pay_1",
  status: "succeeded" as const,
  paid: true,
  amount: { value: "5000.00", currency: "RUB" as const },
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.YOOKASSA_WEBHOOK_SECRET;
  delete process.env.YOOKASSA_SECRET_KEY;
  delete process.env.YOOKASSA_WEBHOOK_SKIP_IP_CHECK;
  dbMock.paymentIntent.findUnique.mockResolvedValue({
    yookassaId: "pay_1",
    studentId: "student_1",
    status: "PENDING",
  });
});

describe("POST /crm/api/webhooks/yookassa", () => {
  it("rejects a request with the wrong webhook secret", async () => {
    process.env.YOOKASSA_WEBHOOK_SECRET = "correct-secret";

    const res = await POST(makeRequest({ event: "payment.succeeded", object: { id: "pay_1" } }, { secret: "wrong" }));

    expect(res.status).toBe(401);
    expect(yookassaMocks.fetchPayment).not.toHaveBeenCalled();
  });

  it("accepts a request with the correct webhook secret and credits the payment", async () => {
    process.env.YOOKASSA_WEBHOOK_SECRET = "correct-secret";
    yookassaMocks.fetchPayment.mockResolvedValue(succeededPayment);
    yookassaMocks.finalizeSuccessfulPayment.mockResolvedValue(true);

    const res = await POST(
      makeRequest({ event: "payment.succeeded", object: { id: "pay_1" } }, { secret: "correct-secret" }),
    );

    expect(res.status).toBe(200);
    expect(yookassaMocks.finalizeSuccessfulPayment).toHaveBeenCalledWith({
      paymentId: "pay_1",
      studentId: "student_1",
      amount: 5000,
    });
  });

  it("returns 400 when the notification payload has no payment id", async () => {
    const res = await POST(makeRequest({ event: "payment.succeeded", object: {} }));

    expect(res.status).toBe(400);
    expect(yookassaMocks.fetchPayment).not.toHaveBeenCalled();
  });

  it("is idempotent: a second delivery for an already-settled payment still returns ok without crediting twice", async () => {
    yookassaMocks.fetchPayment.mockResolvedValue(succeededPayment);
    yookassaMocks.finalizeSuccessfulPayment.mockResolvedValue(false);

    const res = await POST(makeRequest({ event: "payment.succeeded", object: { id: "pay_1" } }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(yookassaMocks.finalizeSuccessfulPayment).toHaveBeenCalledTimes(1);
  });

  it("ignores non-succeeded payment statuses without crediting", async () => {
    yookassaMocks.fetchPayment.mockResolvedValue({ ...succeededPayment, status: "pending", paid: false });

    const res = await POST(makeRequest({ event: "payment.waiting_for_capture", object: { id: "pay_1" } }));

    expect(res.status).toBe(200);
    expect(yookassaMocks.finalizeSuccessfulPayment).not.toHaveBeenCalled();
  });
});

describe("POST /crm/api/webhooks/yookassa — IP allowlist", () => {
  it("rejects a request from an IP outside the YooKassa range in real-payment mode", async () => {
    process.env.YOOKASSA_SECRET_KEY = "live_secret_123";

    const res = await POST(
      makeRequest(
        { event: "payment.succeeded", object: { id: "pay_1" } },
        { headers: { "x-forwarded-for": "1.2.3.4" } },
      ),
    );

    expect(res.status).toBe(403);
    expect(yookassaMocks.fetchPayment).not.toHaveBeenCalled();
  });

  it("accepts a request from an IP inside the YooKassa allowlist in real-payment mode", async () => {
    process.env.YOOKASSA_SECRET_KEY = "live_secret_123";
    yookassaMocks.fetchPayment.mockResolvedValue(succeededPayment);
    yookassaMocks.finalizeSuccessfulPayment.mockResolvedValue(true);

    const res = await POST(
      makeRequest(
        { event: "payment.succeeded", object: { id: "pay_1" } },
        { headers: { "x-forwarded-for": "185.71.76.5" } },
      ),
    );

    expect(res.status).toBe(200);
  });

  it("skips the IP check when YOOKASSA_WEBHOOK_SKIP_IP_CHECK is true, even for an out-of-range IP", async () => {
    process.env.YOOKASSA_SECRET_KEY = "live_secret_123";
    process.env.YOOKASSA_WEBHOOK_SKIP_IP_CHECK = "true";
    yookassaMocks.fetchPayment.mockResolvedValue(succeededPayment);
    yookassaMocks.finalizeSuccessfulPayment.mockResolvedValue(true);

    const res = await POST(
      makeRequest(
        { event: "payment.succeeded", object: { id: "pay_1" } },
        { headers: { "x-forwarded-for": "1.2.3.4" } },
      ),
    );

    expect(res.status).toBe(200);
  });

  it("does not enforce the IP allowlist in mock mode (no YOOKASSA_SECRET_KEY configured)", async () => {
    yookassaMocks.fetchPayment.mockResolvedValue(succeededPayment);
    yookassaMocks.finalizeSuccessfulPayment.mockResolvedValue(true);

    const res = await POST(
      makeRequest(
        { event: "payment.succeeded", object: { id: "pay_1" } },
        { headers: { "x-forwarded-for": "1.2.3.4" } },
      ),
    );

    expect(res.status).toBe(200);
  });
});

describe("POST /crm/api/webhooks/yookassa — canceled status", () => {
  it("marks a PENDING paymentIntent CANCELED when YooKassa reports the payment canceled", async () => {
    yookassaMocks.fetchPayment.mockResolvedValue({ ...succeededPayment, status: "canceled", paid: false });

    const res = await POST(makeRequest({ event: "payment.canceled", object: { id: "pay_1" } }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(dbMock.paymentIntent.update).toHaveBeenCalledWith({
      where: { yookassaId: "pay_1" },
      data: { status: "CANCELED" },
    });
    expect(yookassaMocks.finalizeSuccessfulPayment).not.toHaveBeenCalled();
  });

  it("does not touch the paymentIntent when it is already settled (not PENDING) and cancellation arrives late", async () => {
    dbMock.paymentIntent.findUnique.mockResolvedValue({
      yookassaId: "pay_1",
      studentId: "student_1",
      status: "SUCCEEDED",
    });
    yookassaMocks.fetchPayment.mockResolvedValue({ ...succeededPayment, status: "canceled", paid: false });

    const res = await POST(makeRequest({ event: "payment.canceled", object: { id: "pay_1" } }));

    expect(res.status).toBe(200);
    expect(dbMock.paymentIntent.update).not.toHaveBeenCalled();
  });
});
