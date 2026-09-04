//! Witness crate: every generated Rust lane must compile together.
pub mod types { include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/generated/types.rs")); }
pub mod seaorm { include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/generated/entities.rs")); }
pub mod diesel_lane { include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/generated/schema.rs")); }
