# Conformance

This directory is the repository-local conformance boundary.

Put cross-runtime behavioral fixtures, negative cases, compatibility matrices, and executable checks here. Conformance evidence tests the contract; it must not become a second contract authority.

Polyglot libraries should keep the required header target/check matrix here (for example `polyglot-headers.v1.json`) and keep compile adapters plus external-consumer fixtures under `conformance/headers/`. These checks must verify generated headers against both the admitted contract evidence and the real implementation surface; generated header bytes never become contract authority. See `docs/polyglot-headers.md`.

Existing mature tests do not need to move solely for layout. New cross-runtime evidence should grow here and may call existing test harnesses.
