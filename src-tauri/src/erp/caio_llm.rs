//! caio_llm.rs — Local LLM integration for the CAIO Guardian (Phase B M12)
//!
//! ## Architecture
//! Shells out to `ollama run mistral` via `std::process::Command` (stdin/stdout).
//! This avoids the `reqwest::blocking` deadlock that occurs when called from within
//! Tauri's tokio async runtime.
//!
//! Falls back to `deterministic_proposals()` if:
//!   - `ollama` is not in PATH or not installed
//!   - The process times out (20s)
//!   - The response cannot be parsed as a JSON array

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};
use std::time::Duration;

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

pub struct CaioContext {
    pub org_id: String,
    pub tx_count: usize,
    pub draft_count: usize,
    pub posted_count: usize,
    pub party_count: usize,
    pub account_count: usize,
}

/// Query the local Ollama instance for CAIO proposals.
/// Returns `(Vec<LlmProposal>, used_llm: bool)`.
pub fn query_caio(ctx: &CaioContext, user_query: &str) -> (Vec<LlmProposal>, bool) {
    match try_ollama_cli(ctx, user_query) {
        Some(proposals) if !proposals.is_empty() => (proposals, true),
        _ => (deterministic_proposals(ctx), false),
    }
}

// ─── Ollama CLI subprocess ────────────────────────────────────────────────────

fn try_ollama_cli(ctx: &CaioContext, user_query: &str) -> Option<Vec<LlmProposal>> {
    let prompt = build_prompt(ctx, user_query);

    // Try common ollama binary locations
    let ollama_paths = [
        "/usr/local/bin/ollama",
        "/usr/bin/ollama",
        "/opt/homebrew/bin/ollama",
        "ollama", // rely on PATH
    ];

    let ollama_bin = ollama_paths
        .iter()
        .find(|p| {
            if **p == "ollama" {
                return true; // try PATH fallback last
            }
            std::path::Path::new(p).exists()
        })
        .copied()
        .unwrap_or("ollama");

    let mut child = Command::new(ollama_bin)
        .args(["run", "mistral", "--format", "json"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;

    // Write prompt to stdin
    if let Some(stdin) = child.stdin.take() {
        let mut stdin = stdin;
        let _ = stdin.write_all(prompt.as_bytes());
        // stdin closes when dropped, signalling EOF to ollama
    }

    // Wait with a timeout using a thread
    use std::sync::mpsc;
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let result = child.wait_with_output();
        let _ = tx.send(result);
    });

    let output = rx.recv_timeout(Duration::from_secs(30)).ok()?.ok()?;

    if !output.status.success() && output.stdout.is_empty() {
        return None;
    }

    let raw = String::from_utf8_lossy(&output.stdout);
    let raw = raw.trim();

    // The model may wrap the array in ```json fences — strip them
    let json_str = strip_fences(raw);

    let proposals: Vec<LlmProposal> = serde_json::from_str(json_str).ok()?;

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

fn strip_fences(s: &str) -> &str {
    let s = s.trim();
    if let Some(inner) = s.strip_prefix("```json") {
        let inner = inner.trim_start();
        if let Some(body) = inner.strip_suffix("```") {
            return body.trim();
        }
    }
    if let Some(inner) = s.strip_prefix("```") {
        if let Some(body) = inner.strip_suffix("```") {
            return body.trim();
        }
    }
    s
}

fn build_prompt(ctx: &CaioContext, user_query: &str) -> String {
    format!(
        r#"You are CAIO Guardian, an AI CFO assistant for a small business ERP system called Corngr.

Current ledger context:
- Organisation: {org_id}
- Total transactions: {tx_count} ({draft_count} draft, {posted_count} posted)
- Parties on file: {party_count}
- Chart of Accounts entries: {account_count}

User question: {user_query}

Respond with ONLY a JSON array of 1-3 proposal objects. No markdown, no explanation.
Each object must have: "id" (unique slug), "type" (one of: reorder_proposal, draft_invoice, anomaly_flag, briefing), "title" (max 8 words), "rationale" (one sentence), "source_fragment" (e.g. "org:{org_id}:indexes").

Example: [{{"id":"caio-1","type":"briefing","title":"Ledger Status","rationale":"You have {draft_count} drafts pending.","source_fragment":"org:{org_id}:indexes"}}]"#,
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

fn deterministic_proposals(ctx: &CaioContext) -> Vec<LlmProposal> {
    let mut proposals = Vec::new();

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

    if proposals.is_empty() {
        proposals.push(LlmProposal {
            id: "caio-rules-briefing".into(),
            r#type: "briefing".into(),
            title: "Ledger Looks Healthy".into(),
            rationale: format!(
                "{} total transactions, {} posted. No anomalies detected.",
                ctx.tx_count, ctx.posted_count
            ),
            source_fragment: format!("org:{}:indexes", ctx.org_id),
            source: Some("rules".into()),
        });
    }

    proposals
}
