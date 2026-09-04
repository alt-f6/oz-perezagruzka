import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PdfViewer } from "./PdfViewer";

const SIGNED_URL = "https://r2.example.com/bucket/asset.pdf?X-Amz-Signature=super-secret-token";

function mockFetchOk() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, url: SIGNED_URL }),
    })
  );
}

function mockFetchFail() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, error: "forbidden" }),
    })
  );
}

function assertNoRawUrlExposure(container: HTMLElement) {
  // No anchor of any kind, and the raw signed URL never appears in markup.
  expect(container.querySelectorAll("a")).toHaveLength(0);
  expect(container.querySelectorAll("[download]")).toHaveLength(0);
  expect(container.innerHTML).not.toContain(SIGNED_URL);
  expect(container.innerHTML).not.toContain("X-Amz-Signature");
  expect(screen.queryByText(/Скачать/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Открыть в новой вкладке/i)).not.toBeInTheDocument();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PdfViewer — no raw storage URL / download exposure", () => {
  it("never renders a download or open-in-new-tab link while the signed URL is loaded", async () => {
    mockFetchOk();
    const { container } = render(<PdfViewer assetId="asset_1" watermark="student@example.com" />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    assertNoRawUrlExposure(container);
  });

  it("never renders a raw link in the fetch-error fallback state", async () => {
    mockFetchFail();
    const { container } = render(<PdfViewer assetId="asset_1" watermark="student@example.com" />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    assertNoRawUrlExposure(container);
    expect(screen.getByRole("button", { name: /Обновить/i })).toBeInTheDocument();
  });

  it("never renders a raw link in the render-watchdog-timeout fallback state", async () => {
    vi.useFakeTimers();
    mockFetchOk();
    const { container } = render(<PdfViewer assetId="asset_1" watermark="student@example.com" />);

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });

    expect(screen.getByText(/не смог отобразить документ/i)).toBeInTheDocument();
    assertNoRawUrlExposure(container);
    expect(screen.getByRole("button", { name: /Обновить/i })).toBeInTheDocument();
  });

  it("uses the unprefixed sandbox path so the app-namespace proxy rewrite resolves it exactly once", () => {
    mockFetchOk();
    const { container } = render(<PdfViewer assetId="asset_1" watermark="student@example.com" />);

    const iframe = container.querySelector("iframe");
    expect(iframe).toHaveAttribute("src", "/pdf-sandbox.html");
  });
});
