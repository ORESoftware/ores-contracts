namespace Ores.Contracts.Canary;

model ContractCanary {
  @maxLength(64)
  id: string;

  note?: string;

  tags: string[];
}
