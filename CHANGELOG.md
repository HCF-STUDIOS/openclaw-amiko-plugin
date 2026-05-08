# Changelog

## 0.4.0 — 2026-05-06

- Route `conversationType: "visitor"` chat events to a dedicated `visitor` agent when the gateway config defines one (`agents.list[].id === "visitor"`). Falls back to standard routing otherwise — back-compat for single-agent installs.
