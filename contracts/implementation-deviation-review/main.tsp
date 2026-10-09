// Independently authored peer to authored.schema.json.
// An annotation is a review request, never a permission to diverge on the wire.
import "@typespec/json-schema";
using TypeSpec.JsonSchema;

namespace Ores.Contracts.Conformance;

@jsonSchema
@extension("unevaluatedProperties", false)
model DeviationReview {
  schema: "ores.conformance.deviation-review/v1";
  decision: "review_requested";
  scope: "implementation_representation_only";
  observable_conformance: "mandatory";
  security_policy_conformance: "mandatory";
  annotation: "@ores-conformance-deviation";
  @pattern("^[a-z][a-z0-9._-]{2,127}$")
  id: string;
  @pattern("^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$")
  repository: string;
  @pattern("^[a-f0-9]{40}$")
  source_revision: string;
  @minLength(1)
  source_path: string;
  @minLength(1)
  operation_id: string;
  @minLength(1)
  language: string;
  @minLength(1)
  runtime: string;
  @minLength(32)
  reason: string;
  @pattern("^https://github[.]com/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+/issues/[1-9][0-9]*$")
  tracking_issue: string;
  @pattern("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
  expires_on: string;
  @minItems(1)
  positive_case_ids: string[];
  @minItems(1)
  negative_case_ids: string[];
  @pattern("^sha256:[a-f0-9]{64}$")
  contract_ir_digest: string;
}
