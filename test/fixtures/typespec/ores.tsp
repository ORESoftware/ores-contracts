// ores-contracts persistence decorators. `import "./ores.tsp"; using Ores;` in main.tsp.
// The decorators are declared with `extern` and implemented by ./ores-decorators.js (copied beside main.tsp)
// so `tsp compile` accepts them; ores-contracts reads only their persistence metadata.
import "./ores-decorators.js";

namespace Ores;

/** Table name for the model. */
extern dec table(target: TypeSpec.Reflection.Model, name: valueof string);
/** Comma-separated field names forming a UNIQUE constraint. Repeatable. */
extern dec unique(target: TypeSpec.Reflection.Model, fields: valueof string);
/** Comma-separated field names forming an index. Repeatable. */
extern dec index(target: TypeSpec.Reflection.Model, fields: valueof string);
/** Foreign key: "Model.field". */
extern dec references(target: TypeSpec.Reflection.ModelProperty, to: valueof string);
