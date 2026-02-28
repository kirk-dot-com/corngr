//! caio_llm.rs — Local LLM integration for the CAIO Guardian (Phase B M12)
//!
//! ## Architecture
//! - Sends an ERP-context prompt to a local Ollama instance (`http://127.0.0.1:11434/api/generate`)
//!   using the `reqwest` blocking client.
//! - Parses a JSON array of `CaioProposal`-shaped objects from the LLM response.
//! - Falls back silently to `deterministic_proposals()` if:
//!   - Ollama is not running (connection refused)
//!   - The LLM returns malformed JSON
//!   - Any request error occurs
//!
//! ## LLM prompt contract
//! The prompt instructs the model to respond with a raw JSON array only.
//! Each item must match:
//! ```json
//! {
//!   "id": "unique-string",
//!   "type": "reorder_proposal|draft_invoice|anomaly_flag|briefing",
//!   "title": "Short title",
//!   "rationale": "One-sentence explanation",
//!   "source_fragment": "fragment identifier"
//! }
//! ```
//! If the model produces anything else the fallback activates.

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const OLLAMA_URL: &str = "http://127.0.0.1:11434/api/generate";
const OLLAMA_MODEL: &str = "mistral";
const REQUEST_TIMEOUT_SECS: u64 = 20;

// ─── Types returned by this module (mirrors TS CaioProposal) ─────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmProposal {
    pub id: String,
    /// Matches the TS ProposalType enum
    pub r#type: String,
    pub title: String,
    pub rationale: String,
    pub source_fragment: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>, // "llm" | "rules"
}

// ─── Ollama request / response shapes ────────────────────────────────────────

#[derive(Serialize)]
struct OllamaRequest<'a> {
    model: &'a str,
    prompt: String,
    stream: bool,
    format: &'a str,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
}

// ─── Public entry point ───────────────────────────────────────────────────────

pub struct CaioContext {
    pub org_id: String,
    pub tx_count: usize,
    pub draft_count: usize,
    pub posted_count: usize,
    pub party_count: usize,
    pub account_count: usize,
}

/// Query the local Ollama instance for CAIO proposals.
///
/// Returns `(Vec<LlmProposal>, used_llm: bool)`.
/// `used_llm = true` means the LLM responded and proposals were parsed.
/// `used_llm = false` means the deterministic fallback was used.
pub fn query_caio(ctx: &CaioContext, user_query: &str) -> (Vec<LlmProposal>, bool) {
    match try_ollama(ctx, user_query) {
        Some(proposals) if !proposals.is_empty() => (proposals, true),
        _ => (deterministic_proposals(ctx), false),
    }
}

// ─── Ollama call ──────────────────────────────────────────────────────────────

fn try_ollama(ctx: &CaioContext, user_query: &str) -> Option<Vec<LlmProposal>> {
    let prompt = build_prompt(ctx, user_query);

    let client = Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .ok()?;

    let req = OllamaRequest {
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: "json",
    };

    let resp = client.post(OLLAMA_URL).json(&req).send().ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let body: OllamaResponse = resp.json().ok()?;

    // The model should return a JSON array as the response string
    let raw = body.response.trim();
    let proposals: Vec<LlmProposal> = serde_json::from_str(raw).ok()?;

    // Tag each proposal as LLM-sourced
    Some(
        proposals
            .into_iter()
            .map(|mut p| {
                p.source = Some("llm".into());
                p
            })
            .collect(),
    )
}

fn build_prompt(ctx: &CaioContext, user_query: &str) -> String {
    format!(
        r#"You are CAIO Guardian, an AI CFO assistant for a small business ERP system called Corngr.

Current ledger context:
- Organisation: {org_id}
- Total transactions: {tx_count} ({draft_count} draft, {posted_count} posted)
- Parties on file: {party_count}
- Chart of Accounts entries: {account_count}

User question / query: {user_query}

Your task: Analyse the context and user query, then return a JSON array of 1–4 proposal objects.
Each object MUST have exactly these fields:
  "id": a short unique slug (e.g. "caio-llm-001"),
  "type": one of: "reorder_proposal", "draft_invoice", "anomaly_flag", "briefing",
  "title": a short title (max 8 words),
  "rationale": one plain-English sentence explaining the proposal,
  "source_fragment": a relevant fragment identifier (e.g. "org:{org_id}:indexes")

Return ONLY the JSON array, no markdown, no explanation, no preamble.

Example output:
[{{"id":"caio-llm-001","type":"briefing","title":"Ledger Status Summary","rationale":"You have {draft_count} drafts and {posted_count} posted transactions on record.","source_fragment":"org:{org_id}:indexes"}}]"#,
        org_id = ctx.org_id,
        tx_count = ctx.tx_count,
        draft_count = ctx.draft_count,
        posted_count = ctx.posted_count,
        party_count = ctx.party_count,
        account_count = ctx.account_count,
        user_query = user_query,
    )
}

// ─── Deterministic fallback ───────────────────────────────────────────────────

/// Mirrors the Phase A rules engine — runs when Ollama is unavailable.
fn deterministic_proposals(ctx: &CaioContext) -> Vec<LlmProposal> {
    let mut proposals: Vec<LlmProposal> = Vec::new();

    // Rule: stale drafts
    if ctx.draft_count >= 3 {
        proposals.push(LlmProposal {
            id: "caio-rules-anomaly".into(),
            r#type: "anomaly_flag".into(),
            title: "Stale Draft Accumulation".into(),
            rationale: format!(
                "{} transactions remain in draft. Review or void stale entries.",
                ctx.draft_count
            ),
            source_fragment: format!("org:{}:indexes", ctx.org_id),
            source: Some("rules".into()),
        });
    }

    // Rule: no CoA seeded
    if ctx.account_count == 0 {
        proposals.push(LlmProposal {
            id: "caio-rules-coa".into(),
            r#type: "briefing".into(),
            title: "Chart of Accounts Not Seeded".into(),
            rationale:
                "No accounts are defined. Seed a CoA template to enable double-entry posting."
                    .into(),
            source_fragment: format!("org:{}:coa", ctx.org_id),
            source: Some("rules".into()),
        });
    }

    // Rule: healthy ledger
    if proposals.is_empty() {
        proposals.push(LlmProposal {
            id: "caio-rules-briefing".into(),
            r#type: "briefing".into(),
            title: "Ledger Looks Healthy".into(),
            rationale: format!(
                "{} total transactions, {} posted. No anomalies detected by rules engine.",
                ctx.tx_count, ctx.posted_count
            ),
            source_fragment: format!("org:{}:indexes", ctx.org_id),
            source: Some("rules".into()),
        });
    }

    proposals
}
