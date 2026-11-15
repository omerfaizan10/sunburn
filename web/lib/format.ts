export function fluxClass(f: number | null | undefined): string {
  if (f == null || !isFinite(f) || f <= 0) return "n/a";
  const letters: [string, number][] = [
    ["X", 1e-4],
    ["M", 1e-5],
    ["C", 1e-6],
    ["B", 1e-7],
    ["A", 1e-8],
  ];
  for (const [l, s] of letters) if (f >= s) return `${l}${(f / s).toFixed(1)}`;
  return "<A1";
}

export function pct(x: number | null | undefined, digits = 0): string {
  if (x == null || !isFinite(x)) return "n/a";
  const s = (Math.abs(x) * 100).toFixed(digits);
  return `${x < 0 && Number(s) !== 0 ? "\u2212" : ""}${s}%`;
}

export function signedMin(m: number): string {
  if (m === 0) return "T+0";
  return m > 0 ? `T+${m}` : `T−${Math.abs(m)}`;
}

export function utc(iso: string): string {
  return iso.replace("T", " ") + " UTC";
}

export function hhmm(unix: number): string {
  const d = new Date(unix * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function int(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
