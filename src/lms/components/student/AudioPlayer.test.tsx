import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, url: "https://signed.example/audio.mp3" }) });
  vi.stubGlobal("fetch", fetchMock);
});

describe("AudioPlayer", () => {
  it("fetches the signed URL from /api/student/pdf-url and renders an audio element with it as src", async () => {
    const { AudioPlayer } = await import("./AudioPlayer");
    render(<AudioPlayer lessonId="l1" assetId="a1" title="Подкаст 1" initialPositionSeconds={0} onPositionChange={() => {}} />);

    await waitFor(() => {
      const audio = document.querySelector("audio");
      expect(audio?.getAttribute("src")).toBe("https://signed.example/audio.mp3");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/student/pdf-url?assetId=a1",
      expect.objectContaining({ cache: "no-store", credentials: "include" })
    );
  });

  it("renders playback speed options 0.75x through 2x", async () => {
    const { AudioPlayer } = await import("./AudioPlayer");
    render(<AudioPlayer lessonId="l1" assetId="a1" title="Подкаст 1" initialPositionSeconds={0} onPositionChange={() => {}} />);

    await waitFor(() => expect(screen.getByLabelText(/скорость/i)).toBeInTheDocument());
    ["0.75x", "1x", "1.25x", "1.5x", "2x"].forEach((label) => {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    });
  });

  it("renders forward and back 15s buttons", async () => {
    const { AudioPlayer } = await import("./AudioPlayer");
    render(<AudioPlayer lessonId="l1" assetId="a1" title="Подкаст 1" initialPositionSeconds={0} onPositionChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /-15/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /\+15/ })).toBeInTheDocument();
    });
  });
});
