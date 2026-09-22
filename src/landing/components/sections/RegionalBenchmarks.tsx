import Section from "@/landing/components/ui/Section";
import Card from "@/landing/components/ui/Card";
import type { RegionContent } from "@/landing/data/regions";

export default function RegionalBenchmarks({ region }: { region: RegionContent }) {
  return (
    <Section tone="brand-wash">
      <div className="relative mx-auto max-w-5xl px-6">
        <h2 className="mb-8 text-center font-bold tracking-tight text-ink-900 text-balance">
          Почему подготовку в {region.cityPrepositional} стоит доверить нам
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {region.benchmarks.map((benchmark) => (
            <Card key={benchmark.name} tint="premium" rounded="3xl" className="h-full">
              <p className="font-bold text-ink-900">{benchmark.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{benchmark.detail}</p>
            </Card>
          ))}
          <Card tint="premium" rounded="3xl" className="h-full">
            <p className="font-bold text-ink-900">Расписание</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{region.scheduleNote}</p>
          </Card>
          <Card tint="premium" rounded="3xl" className="h-full">
            <p className="font-bold text-ink-900">Куратор</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{region.curatorNote}</p>
          </Card>
        </div>
      </div>
    </Section>
  );
}
