# Corngr-ERP: Skills Matrix

> **Platform:** Built on the Antigravity Framework  
> **Status:** Phase A Baseline (Feb 2026)  
> **Core Concept:** A "Post-File" ERP for SMEs that treats business data as a Unified, AI-Native Data Grid.

---

## 1. Orbital Architecture (The Antigravity Spine)

> Because Corngr-ERP is "Local-First," we don't just "fetch" data; we synchronise state.

| Skill | Description |
|---|---|
| **CRDT State Engineering (Yjs)** | Designing conflict-free data structures for complex ERP entities (Invoices, Ledgers, Bill of Materials) to ensure 100% offline-to-online parity. |
| **Tauri & Rust Backend** | Expertise in the Antigravity Core to handle sub-1ms ABAC (Attribute-Based Access Control) and high-speed cryptographic signing. |
| **Edge-Compute Orchestration** | Running heavy business logic (tax calculations, payroll batching) locally on the client's machine using Rust for safety and speed. |

---

## 2. Agentic Intelligence (The Navigator)

> In Corngr-ERP, the AI doesn't just answer questions; it manages the grid.

| Skill | Description |
|---|---|
| **Update-Stream Listeners** | Building AI agents that monitor the Yjs Update Stream to proactively trigger business events (e.g., "Inventory low — generate draft Purchase Order?"). |
| **Local LLM Integration** | Utilising Candle or llama-edge for private, on-premise data synthesis, ensuring SME financial secrets never leave their hardware. |
| **Intent-Driven Gen-UI** | Creating a "Command Bar" interface where natural language transforms the UI from a "Warehouse View" to an "Accounting Ledger" instantly. |

---

## 3. The Unified Data Grid (The "File-Less" Ledger)

> We replace "spreadsheets and PDFs" with "Atomic Fragments."

| Skill | Description |
|---|---|
| **Merkle-Chained Audit Logs** | Implementing the Compliance Time Machine — using Merkle trees to prove the integrity and lineage of every transaction for IRAP/Tax audits. |
| **Dual-View Logic** | Mastering the toggle between Document Views (for contracts/prose) and Grid Views (for inventory/finance), all fuelled by the same underlying Yjs fragment. |
| **Vector-Grid Hybridisation** | Linking real-time data to a Vector Database (Qdrant) to allow the AI to "remember" and "search" the context of 5-year-old transactions instantly. |

---

## 4. Cryptographic Trust (The Security Layer)

> Security in Corngr-ERP is sovereign and mathematical.

| Skill | Description |
|---|---|
| **Ed25519 Identity Management** | Replacing passwords with cryptographic key pairs. Every "Approval" in the ERP is a signed digital proof. |
| **Zero-Knowledge Reporting** | Developing tools that allow SMEs to share "Proof of Solvency" or "Tax Compliance" with 3rd parties without exposing their entire raw ledger. |
| **ABAC Policy Design** | Crafting granular "Logic-Gates" (e.g., "Only the Warehouse Lead can sign for arrivals over $5k during business hours"). |

---

## 5. SME Domain "Lenses"

> Building the specific business tools that sit atop the Antigravity engine.

| Skill | Description |
|---|---|
| **Autonomous Financials** | Automating the "Zero-Day Close" where accounts are reconciled in real-time as transactions occur on the grid. |
| **Supply Chain Digital Twins** | Mapping physical warehouse coordinates to the Data Grid, allowing for a real-time, visual 1:1 representation of stock levels. |
| **ESG & Compliance Tracking** | Embedding Scope 1-3 emissions and regulatory tracking directly into the operational "fragments" of the ERP. |

---

## 6. High-Velocity Adoption (UX)

| Skill | Description |
|---|---|
| **Human-in-the-Loop (HITL) Design** | Designing the "Approval Hub" where AI-proposed actions wait for a human cryptographic signature. |
| **Zero-Migration Strategy** | Building "Bridge Lenses" that can ingest legacy CSV/Excel data and instantly "elevate" it into the Antigravity Data Grid. |

---

## 7. Dynamic Data Ingestion (The Gravity Well)

> To ensure "Zero-Friction" onboarding, Corngr-ERP must ingest and "elevate" legacy data formats into the Antigravity Grid.

| Skill | Description |
|---|---|
| **Semantic Schema Mapping** | Using LLMs to automatically map messy, legacy CSV/Excel headers to the Corngr-ERP Unified Schema without manual user intervention. |
| **High-Velocity Stream Processing** | Building Rust-based ingestion pipelines that de-duplicate and fragment monolithic SQL exports into Yjs CRDT structures in real-time. |
| **Legacy "Bridge" Connectors** | Expertise in building Webhooks and API Adapters for "The Heavy World" (e.g., syncing a legacy Shopify store or physical bank feed into the local-first grid). |
| **Validation & Cleaning Agents** | Designing AI agents that scrub incoming legacy data for anomalies, ensuring only "High-Integrity" fragments enter the Merkle-chained audit log. |

---

## Philosophy

> **Legacy ERPs are heavy, slow, and expensive. Corngr-ERP is the opposite.**

Corngr-ERP is **Antigravity for your business** — removing the friction of "files," the risk of centralised data breaches, and the lag of traditional databases. By treating ETL as **Intelligent Data Ingestion** (the "Gravity Well"), the platform solves the #1 barrier to ERP adoption: data migration. A user dragging a 10-year-old `Invoices.xlsx` onto Corngr-ERP should have the Rust backend instantly "shatter" it into cryptographic, AI-searchable fragments — instantly won.

---

*See also: [PRD.md](./PRD.md) for full functional requirements and phasing. [ARCHITECTURE.md](./ARCHITECTURE.md) for technical design.*
