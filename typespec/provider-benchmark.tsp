namespace Ores.ProviderBenchmark;

@pattern("^[a-z][a-z0-9_-]{0,62}$")
scalar BenchmarkId extends string;

@pattern("^[a-f0-9]{64}$")
scalar Sha256 extends string;

@pattern("^[A-Za-z_][A-Za-z0-9_]*$")
scalar EnvironmentVariableName extends string;

model BenchmarkCommand {
  cwd?: string;
  @minItems(1)
  argv: string[];
  inheritEnv?: EnvironmentVariableName[];
}

model ResourceProfile {
  architecture: string;
  memoryMb?: int32;
  cpuMillis?: int32;
  concurrency?: int32;
  mode?: string;
}

model PricingSnapshot {
  asOf: string;
  currency: string;
  source: string;
}

model BenchmarkTarget {
  id: BenchmarkId;
  provider: string;
  region: string;
  artifactReceipts: Record<Sha256>;
  resourceProfile: ResourceProfile;
  run: BenchmarkCommand;
  receipt: string;
}

model ProviderBenchmarkPlanV1 {
  schema: "ores.provider-benchmark.plan/v1";
  releaseId: string;
  requestCorpusSha256: Sha256;
  pricingSnapshot: PricingSnapshot;
  @minItems(1)
  targets: BenchmarkTarget[];
}

model LatencySummary {
  p50Ms: float64;
  p95Ms: float64;
  p99Ms: float64;
}

model SampleSummary {
  requestCount: int64;
  errorCount: int64;
  throttledCount: int64;
  coldCount: int64;
  warmCount: int64;
  durationMs: int64;
  throughputRps: float64;
  latency: LatencySummary;
}

model BillingSummary {
  basis: "measured" | "estimated";
  amount: float64;
  currency: string;
  pricingSnapshotAsOf: string;
  billableDurationMs?: int64;
  billableInstanceMs?: int64;
}

model ProviderBenchmarkTargetReceiptV1 {
  schema: "ores.provider-benchmark.target-receipt/v1";
  targetId: BenchmarkId;
  provider: string;
  region: string;
  releaseId: string;
  requestCorpusSha256: Sha256;
  artifactReceipts: Record<Sha256>;
  resourceProfile: ResourceProfile;
  samples: SampleSummary;
  billing: BillingSummary;
}

model ProviderBenchmarkAggregateReceiptV1 {
  schema: "ores.provider-benchmark.aggregate-receipt/v1";
  planSha256: Sha256;
  releaseId: string;
  requestCorpusSha256: Sha256;
  pricingSnapshot: PricingSnapshot;
  comparable: boolean;
  comparabilityIssues: string[];
  @minItems(1)
  targets: ProviderBenchmarkTargetReceiptV1[];
}
