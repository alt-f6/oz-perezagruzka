import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("next.config www redirect", () => {
  it("redirects www.perezagruzka-edu.ru permanently to the apex domain", async () => {
    const redirects = await nextConfig.redirects!();
    const wwwRedirect = redirects.find(
      (r) => "has" in r && r.has?.some((h) => "value" in h && h.value === "www.perezagruzka-edu.ru"),
    );

    expect(wwwRedirect).toMatchObject({
      destination: "https://perezagruzka-edu.ru/:path*",
      permanent: true,
    });
  });
});

describe("next.config vercel.app noindex header", () => {
  it("sets X-Robots-Tag: noindex, nofollow, noarchive on *.vercel.app hosts", async () => {
    const headerGroups = await nextConfig.headers!();
    const vercelGroup = headerGroups.find((g) =>
      g.has?.some((h) => h.type === "host" && "value" in h && h.value?.includes("vercel.app")),
    );

    expect(vercelGroup?.headers).toContainEqual({
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive",
    });
  });

  it("keeps the existing security headers rule intact", async () => {
    const headerGroups = await nextConfig.headers!();
    const globalGroup = headerGroups.find((g) => g.source === "/:path*" && !g.has);

    expect(globalGroup?.headers).toContainEqual({ key: "X-Frame-Options", value: "SAMEORIGIN" });
  });
});
