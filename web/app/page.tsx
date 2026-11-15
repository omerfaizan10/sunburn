import { readFileSync } from "node:fs";
import path from "node:path";
import Dashboard from "@/components/Dashboard";
import type { FeaturedItem, FlareDetail, Results } from "@/lib/types";

function readJson<T>(rel: string): T {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "public", "data", rel), "utf8"),
  ) as T;
}

export default function Page() {
  const res = readJson<Results>("results.json");
  const featured = readJson<FeaturedItem[]>("featured.json");
  const initial = readJson<FlareDetail>(`flares/${featured[0].id}.json`);
  return <Dashboard res={res} featured={featured} initial={initial} />;
}
