// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "XMLHttpRequest",
    class {
      open() {}
      setRequestHeader() {}
      send() {
        this.onload?.();
      }
      upload = {};
      status = 200;
      onload: (() => void) | null = null;
    }
  );
});

describe("useLessonAssetUpload", () => {
  it("fetches the initial asset list for the lesson (server returns all kinds; hook filters to its kind)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        items: [
          { id: "a1", title: "Podcast 1", kind: "audio", original_name: "p1.mp3", mime_type: "audio/mpeg", size_bytes: 100, order: 1, is_public: true },
          { id: "p1", title: "Deck", kind: "pdf", original_name: "deck.pdf", mime_type: "application/pdf", size_bytes: 200, order: 1, is_public: true },
        ],
      }),
    });

    const { useLessonAssetUpload } = await import("./useLessonAssetUpload");
    const { result } = renderHook(() => useLessonAssetUpload("lesson-1", "audio"));

    await waitFor(() => expect(result.current.assets).toHaveLength(1));
    expect(result.current.assets[0].id).toBe("a1");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("lesson-1"), expect.anything());
  });

  it("upload() presigns with the hook's kind, PUTs the file, then calls complete and refreshes the list", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, items: [] }) }) // initial list
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, assetId: "a2", storageKey: "lessons/lesson-1/assets/a2-f.mp3", uploadUrl: "https://r2.example/put" }),
      }) // presign
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }) // complete
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          items: [{ id: "a2", title: "f", kind: "audio", original_name: "f.mp3", mime_type: "audio/mpeg", size_bytes: 1, order: 1, is_public: true }],
        }),
      }); // refresh after upload

    const { useLessonAssetUpload } = await import("./useLessonAssetUpload");
    const { result } = renderHook(() => useLessonAssetUpload("lesson-1", "audio"));
    await waitFor(() => expect(result.current.assets).toHaveLength(0));

    const file = new File(["x"], "f.mp3", { type: "audio/mpeg" });
    await act(async () => {
      await result.current.upload(file);
    });

    const presignCall = fetchMock.mock.calls.find(([url]) => String(url).includes("presign"));
    expect(presignCall).toBeTruthy();
    const presignBody = JSON.parse(String(presignCall![1].body));
    expect(presignBody.kind).toBe("audio");
    expect(presignBody.filename).toBe("f.mp3");

    const completeCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/complete"));
    expect(completeCall).toBeTruthy();
    expect(JSON.parse(String(completeCall![1].body))).toEqual({ lessonId: "lesson-1", sizeBytes: 1, isPublic: true });

    await waitFor(() => expect(result.current.assets).toHaveLength(1));
  });

  it("surfaces an error message and does not throw when presign fails", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, items: [] }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, error: "file too large" }) });

    const { useLessonAssetUpload } = await import("./useLessonAssetUpload");
    const { result } = renderHook(() => useLessonAssetUpload("lesson-1", "pdf"));
    await waitFor(() => expect(result.current.assets).toHaveLength(0));

    const file = new File(["x"], "big.pdf", { type: "application/pdf" });
    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.error).toBe("file too large");
  });

  it("remove() calls DELETE with the lessonId query param and refreshes", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, items: [{ id: "a1", title: "x", kind: "pdf", original_name: "x.pdf", mime_type: "application/pdf", size_bytes: 1, order: 1, is_public: true }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, deleted: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, items: [] }) });

    const { useLessonAssetUpload } = await import("./useLessonAssetUpload");
    const { result } = renderHook(() => useLessonAssetUpload("lesson-1", "pdf"));
    await waitFor(() => expect(result.current.assets).toHaveLength(1));

    await act(async () => {
      await result.current.remove("a1");
    });

    const deleteCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "DELETE");
    expect(deleteCall).toBeTruthy();
    expect(String(deleteCall![0])).toBe("/api/admin/assets/a1?lessonId=lesson-1");
    await waitFor(() => expect(result.current.assets).toHaveLength(0));
  });
});
