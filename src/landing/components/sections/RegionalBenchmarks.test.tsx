import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RegionalBenchmarks from "./RegionalBenchmarks";
import { REGIONS } from "@/landing/data/regions";

describe("RegionalBenchmarks", () => {
  it("lists every benchmark name for the given region", () => {
    render(<RegionalBenchmarks region={REGIONS.nizhnevartovsk} />);
    for (const benchmark of REGIONS.nizhnevartovsk.benchmarks) {
      expect(screen.getByText(benchmark.name)).not.toBeNull();
    }
  });

  it("mentions the city in the heading using the prepositional form", () => {
    render(<RegionalBenchmarks region={REGIONS.surgut} />);
    expect(screen.getByText(/Сургуте/)).not.toBeNull();
  });
});
