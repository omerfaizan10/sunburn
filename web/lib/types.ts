export type Frame = {
  t: number;
  rel: number;
  sun: [number, number];
  on: number[];
  spots: [number, number, number, number]; // sunlit n, sunlit quiet-day median, dark n, dark median
};

export type CurvePts = {
  pre_base: number;
  pts: [number, number | null][];
} | null;

export type FlareDetail = {
  id: string;
  cls: string;
  r: number;
  start: string;
  peak: string;
  end: string;
  start_rel: number;
  end_rel: number;
  baseline_days: number[];
  drop: number;
  S_lit: number;
  S_dark: number;
  band_drop: Record<string, number | null>;
  goes: [number, number | null][];
  paths: [number, number, number, number, number][]; // band, tx lat, tx lon, rx lat, rx lon
  frames: Frame[];
  curves: Record<string, { lit: CurvePts; dark: CurvePts }>;
};

export type FeaturedItem = {
  id: string;
  cls: string;
  r: number;
  start: string;
  peak: string;
  end: string;
  drop: number;
  n_paths: number;
};

export type Summary = {
  n: number;
  p25?: number | null;
  median?: number | null;
  p75?: number | null;
  mean?: number | null;
};

export type EventRow = {
  id: string;
  cls: string;
  start: string;
  peak: string;
  end: string;
  flux: number;
  r: number;
  status: "ok" | "no_data" | "thin_coverage" | "pre_overlap";
  drop?: number | null;
  S_lit?: number | null;
  S_dark?: number | null;
  bands?: Record<string, number | null>;
};

export type DetectorMetrics = {
  params: {
    threshold: number;
    min_run: number;
    refractory: number;
    min_expected: number;
    smooth: number;
    mode: string;
  };
  tp: number;
  fp: number;
  fn: number;
  precision: number | null;
  recall: number | null;
  f1: number;
  median_delay_min: number | null;
  delay_p25_p75: [number, number] | null;
  recall_by_r: Record<string, { hit: number; n: number }>;
  observable_n: number;
  observable_recall: number | null;
  n_alarms: number;
  n_neutral_alarms?: number;
  fp_on_c_flares?: number | null;
  alarms?: string[];
};

export type Results = {
  coverage: { n_days: number; first_day: string; last_day: string; total_spots: number; mean_spots_per_day: number; top_of_hour_gap_days: number; outage_days: number };
  flare_list: {
    source: string;
    first_peak: string;
    last_peak: string;
    n_m: number;
    n_x: number;
  };
  event_study: {
    windows: {
      pre_min_rel_start: [number, number];
      response_min_rel_peak: [number, number];
    };
    n_flares: number;
    n_analysed: number;
    n_no_data: number;
    n_thin: number;
    n_pre_overlap: number;
    flares: EventRow[];
    dose: {
      slope_per_decade: number | null;
      ci95: [number | null, number | null];
      bins: (Summary & { label: string; lo: number; hi: number })[];
    };
    placebo: Summary & { drops: number[]; share_ge_x_median: number | null };
    frequency: Record<
      string,
      { band_m: number; x: Summary; m5x1: Summary; placebo: Summary }
    >;
  };
  detector: {
    tune_period: [string, string];
    holdout_period: [string, string];
    holdout_missing_days: number;
    selection: string;
    grid: DetectorMetrics[];
    tune_best: DetectorMetrics;
    holdout: DetectorMetrics;
    r2_tune_best: DetectorMetrics;
    r2_holdout: DetectorMetrics;
    holdout_other_variant: DetectorMetrics;
  };
};

export const BAND_M: Record<string, number> = {
  "3": 80,
  "5": 60,
  "7": 40,
  "10": 30,
  "14": 20,
  "18": 17,
  "21": 15,
  "24": 12,
  "28": 10,
};
export const BAND_MHZ: Record<string, string> = {
  "3": "3.5",
  "5": "5.3",
  "7": "7.0",
  "10": "10.1",
  "14": "14.0",
  "18": "18.1",
  "21": "21.1",
  "24": "24.9",
  "28": "28.1",
};
