// ores-contracts persistence decorators. `import "./ores.tsp"; using Ores;` in main.tsp.
// The decorators are declared with `extern` and implemented by ../lib/ores-decorators.js
// so `tsp compile` accepts them; ores-contracts' own parser reads them structurally.
import "../lib/ores-decorators.js";

namespace Ores;

/** Table name for the model. */
extern dec table(target: Model, name: valueof string);
/** Comma-separated field names forming a UNIQUE constraint. Repeatable. */
extern dec unique(target: Model, fields: valueof string);
/** Comma-separated field names forming an index. Repeatable. */
extern dec index(target: Model, fields: valueof string);
/** Foreign key: "Model.field". */
extern dec references(target: ModelProperty, to: valueof string);
