// Runtime for the Ores.* decorators: they only record metadata so `tsp compile` succeeds.
export function $table() {}
export function $unique() {}
export function $index() {}
export function $references() {}
export const $decorators = { Ores: { table: $table, unique: $unique, index: $index, references: $references } };
