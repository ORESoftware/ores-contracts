import "./ores.tsp";
using Ores;

namespace Acme.Billing;

enum InvoiceStatus {
  Draft: "draft",
  Issued: "issued",
  Paid: "paid",
}

@doc("A customer that can be invoiced.")
@Ores.table("customers")
@Ores.unique("email")
model Customer {
  @key @format("uuid") id: string;
  @maxLength(320) email: string;
  displayName?: string;
  createdAt: utcDateTime;
  tags: string[];
}

@Ores.table("invoices")
@Ores.index("customerId,issuedOn")
model Invoice {
  @key @format("uuid") id: string;
  @Ores.references("Customer.id") @format("uuid") customerId: string;
  status: InvoiceStatus;
  amountCents: int64;
  issuedOn?: plainDate;
  metadata?: Record<unknown>;
}
