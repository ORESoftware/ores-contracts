//! Witness crate: every generated Rust lane must compile together.
#[macro_use]
extern crate diesel;

pub mod types { include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/generated/types.rs")); }
pub mod seaorm { include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/generated/entities.rs")); }
pub mod diesel_lane { include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/generated/schema.rs")); }

// The Diesel lane is generated for a crate root. Re-export its crate-root
// modules so the exact generated paths remain valid inside this witness module.
pub use diesel_lane::{schema, sql_types};
