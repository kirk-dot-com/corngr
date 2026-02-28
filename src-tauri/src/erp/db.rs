//! db.rs — SQLite persistence layer for Phase B (M10)
//!
//! Architecture: write-through cache.
//!   - On startup:  `init_db()` opens/creates corngr.db and `load_all()` warms ErpStore.
//!   - On writes:   each engine mutation calls the matching `upsert_*` helper.
//!   - ErpStore remains the in-process working set; SQLite is the durable source of truth.

use rusqlite::{params, Connection, Error as SqlErr, Result as SqlResult};
use std::path::Path;

use crate::erp::engine::{AccountRecord, ErpStore};
use crate::erp::types::{
    InvMove, InventoryEffect, Party, PartyKind, Posting, TxHeader, TxLine, TxStatus, TxType,
};

// ─── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA: &str = "
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS tx_headers (
    tx_id             TEXT PRIMARY KEY,
    org_id            TEXT NOT NULL,
    tx_type           TEXT NOT NULL,
    status            TEXT NOT NULL,
    party_id          TEXT,
    currency          TEXT NOT NULL DEFAULT 'AUD',
    ref_number        TEXT,
    description       TEXT,
    tx_date           TEXT NOT NULL DEFAULT '',
    site_id           TEXT NOT NULL DEFAULT 'primary',
    created_at_ms     INTEGER NOT NULL DEFAULT 0,
    created_by_pubkey TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tx_lines (
    line_id            TEXT PRIMARY KEY,
    tx_id              TEXT NOT NULL,
    item_id            TEXT,
    account_id         TEXT,
    description        TEXT,
    qty                REAL NOT NULL DEFAULT 0,
    unit_price         REAL NOT NULL DEFAULT 0,
    inventory_effect   TEXT NOT NULL DEFAULT 'none',
    tax_code           TEXT,
    tax_rate           REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS postings (
    posting_id    TEXT PRIMARY KEY,
    tx_id         TEXT NOT NULL,
    account_id    TEXT NOT NULL,
    debit_amount  REAL NOT NULL DEFAULT 0,
    credit_amount REAL NOT NULL DEFAULT 0,
    currency      TEXT NOT NULL DEFAULT 'AUD',
    description   TEXT,
    status        TEXT NOT NULL DEFAULT 'committed',
    generated_by  TEXT NOT NULL DEFAULT 'engine'
);

CREATE TABLE IF NOT EXISTS inv_moves (
    move_id          TEXT PRIMARY KEY,
    tx_id            TEXT NOT NULL,
    tx_line_id       TEXT NOT NULL,
    item_id          TEXT NOT NULL,
    qty_delta        REAL NOT NULL DEFAULT 0,
    location_id      TEXT,
    moved_at_ms      INTEGER NOT NULL DEFAULT 0,
    moved_by_pubkey  TEXT NOT NULL DEFAULT '',
    site_id          TEXT NOT NULL DEFAULT 'primary'
);

CREATE TABLE IF NOT EXISTS parties (
    party_id      TEXT PRIMARY KEY,
    org_id        TEXT NOT NULL,
    name          TEXT NOT NULL,
    kind          TEXT NOT NULL DEFAULT 'other',
    email         TEXT,
    contact       TEXT,
    abn           TEXT,
    created_at_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts (
    code           TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    acct_type      TEXT NOT NULL,
    normal_balance TEXT NOT NULL
);
";

// ─── Init ─────────────────────────────────────────────────────────────────────

/// Open (or create) the SQLite database at `db_path`, apply the schema, and return
/// the connection.  Called once on app startup from `lib.rs`.
pub fn init_db(db_path: &Path) -> SqlResult<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(SCHEMA)?;
    Ok(conn)
}

// ─── Upsert helpers ───────────────────────────────────────────────────────────

pub fn upsert_tx(conn: &Connection, tx: &TxHeader) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO tx_headers
         (tx_id, org_id, tx_type, status, party_id, currency, ref_number, description,
          tx_date, site_id, created_at_ms, created_by_pubkey)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            tx.tx_id,
            tx.org_id,
            tx.tx_type.as_str(),
            tx.status.as_str(),
            tx.party_id,
            tx.currency,
            tx.ref_number,
            tx.description,
            tx.tx_date,
            tx.site_id,
            tx.created_at_ms,
            tx.created_by_pubkey,
        ],
    )?;
    Ok(())
}

pub fn upsert_line(conn: &Connection, line: &TxLine) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO tx_lines
         (line_id, tx_id, item_id, account_id, description, qty, unit_price,
          inventory_effect, tax_code, tax_rate)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            line.line_id,
            line.tx_id,
            line.item_id,
            line.account_id,
            line.description,
            line.qty,
            line.unit_price,
            line.inventory_effect.as_str(),
            line.tax_code,
            line.tax_rate,
        ],
    )?;
    Ok(())
}

pub fn upsert_posting(conn: &Connection, p: &Posting) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO postings
         (posting_id, tx_id, account_id, debit_amount, credit_amount, currency,
          description, status, generated_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            p.posting_id,
            p.tx_id,
            p.account_id,
            p.debit_amount,
            p.credit_amount,
            p.currency,
            p.description,
            p.status,
            p.generated_by,
        ],
    )?;
    Ok(())
}

pub fn upsert_invmove(conn: &Connection, m: &InvMove) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO inv_moves
         (move_id, tx_id, tx_line_id, item_id, qty_delta, location_id, moved_at_ms,
          moved_by_pubkey, site_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            m.move_id,
            m.tx_id,
            m.tx_line_id,
            m.item_id,
            m.qty_delta,
            m.location_id,
            m.moved_at_ms,
            m.moved_by_pubkey,
            m.site_id,
        ],
    )?;
    Ok(())
}

pub fn upsert_party(conn: &Connection, p: &Party) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO parties
         (party_id, org_id, name, kind, email, contact, abn, created_at_ms)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            p.party_id,
            p.org_id,
            p.name,
            p.kind.as_str(),
            p.email,
            p.contact,
            p.abn,
            p.created_at_ms,
        ],
    )?;
    Ok(())
}

pub fn upsert_account(conn: &Connection, a: &AccountRecord) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO accounts (code, name, acct_type, normal_balance)
         VALUES (?1, ?2, ?3, ?4)",
        params![a.code, a.name, a.acct_type, a.normal_balance],
    )?;
    Ok(())
}

// ─── Load all — warms ErpStore from SQLite on startup ────────────────────────

/// Convert an `ErpError` string form to a `rusqlite::Error` so it can bubble
/// through query_map closures.
fn erp_err_to_sql(msg: String) -> SqlErr {
    SqlErr::InvalidParameterName(msg)
}

/// Populate a fresh `ErpStore` from the SQLite database.
/// Called once during the `lazy_static` initialisation in `engine.rs`.
pub fn load_all(conn: &Connection) -> SqlResult<ErpStore> {
    let mut store = ErpStore::new();

    // ── tx_headers ────────────────────────────────────────────────────────────
    {
        let mut stmt = conn.prepare(
            "SELECT tx_id, org_id, tx_type, status, party_id, currency,
                    ref_number, description, tx_date, site_id, created_at_ms, created_by_pubkey
             FROM tx_headers",
        )?;
        let rows = stmt.query_map([], |row| {
            let tx_type_s: String = row.get(2)?;
            let status_s: String = row.get(3)?;
            Ok(TxHeader {
                tx_id: row.get(0)?,
                org_id: row.get(1)?,
                tx_type: TxType::from_str(&tx_type_s).map_err(|e| erp_err_to_sql(e.to_string()))?,
                status: TxStatus::from_str(&status_s).map_err(|e| erp_err_to_sql(e.to_string()))?,
                party_id: row.get(4)?,
                currency: row
                    .get::<_, Option<String>>(5)?
                    .unwrap_or_else(|| "AUD".into()),
                ref_number: row.get(6)?,
                description: row.get(7)?,
                tx_date: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
                site_id: row
                    .get::<_, Option<String>>(9)?
                    .unwrap_or_else(|| "primary".into()),
                created_at_ms: row.get(10)?,
                created_by_pubkey: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
            })
        })?;
        for r in rows {
            let tx = r?;
            store.transactions.insert(tx.tx_id.clone(), tx);
        }
    }

    // ── tx_lines ─────────────────────────────────────────────────────────────
    {
        let mut stmt = conn.prepare(
            "SELECT line_id, tx_id, item_id, account_id, description,
                    qty, unit_price, inventory_effect, tax_code, tax_rate
             FROM tx_lines",
        )?;
        let rows = stmt.query_map([], |row| {
            let inv_s: String = row.get(7)?;
            Ok(TxLine {
                line_id: row.get(0)?,
                tx_id: row.get(1)?,
                item_id: row.get(2)?,
                account_id: row.get(3)?,
                description: row.get(4)?,
                qty: row.get(5)?,
                unit_price: row.get(6)?,
                inventory_effect: InventoryEffect::from_str(&inv_s),
                tax_code: row.get(8)?,
                tax_rate: row.get(9)?,
                move_ids: vec![], // re-linked from inv_moves below
            })
        })?;
        for r in rows {
            let line = r?;
            store.lines.insert(line.line_id.clone(), line);
        }
    }

    // ── inv_moves ─────────────────────────────────────────────────────────────
    {
        let mut stmt = conn.prepare(
            "SELECT move_id, tx_id, tx_line_id, item_id, qty_delta, location_id,
                    moved_at_ms, moved_by_pubkey, site_id
             FROM inv_moves",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(InvMove {
                move_id: row.get(0)?,
                tx_id: row.get(1)?,
                tx_line_id: row.get(2)?,
                item_id: row.get(3)?,
                qty_delta: row.get(4)?,
                location_id: row.get(5)?,
                moved_at_ms: row.get(6)?,
                moved_by_pubkey: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                site_id: row
                    .get::<_, Option<String>>(8)?
                    .unwrap_or_else(|| "primary".into()),
            })
        })?;
        for r in rows {
            let m = r?;
            // Re-link move_id back to its parent line
            if let Some(line) = store.lines.get_mut(&m.tx_line_id) {
                line.move_ids.push(m.move_id.clone());
            }
            store.invmoves.insert(m.move_id.clone(), m);
        }
    }

    // ── postings ─────────────────────────────────────────────────────────────
    {
        let mut stmt = conn.prepare(
            "SELECT posting_id, tx_id, account_id, debit_amount, credit_amount,
                    currency, description, status, generated_by
             FROM postings",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Posting {
                posting_id: row.get(0)?,
                tx_id: row.get(1)?,
                account_id: row.get(2)?,
                debit_amount: row.get(3)?,
                credit_amount: row.get(4)?,
                currency: row
                    .get::<_, Option<String>>(5)?
                    .unwrap_or_else(|| "AUD".into()),
                description: row.get(6)?,
                status: row
                    .get::<_, Option<String>>(7)?
                    .unwrap_or_else(|| "committed".into()),
                generated_by: row
                    .get::<_, Option<String>>(8)?
                    .unwrap_or_else(|| "engine".into()),
            })
        })?;
        for r in rows {
            let p = r?;
            store.postings.insert(p.posting_id.clone(), p);
        }
    }

    // ── parties ──────────────────────────────────────────────────────────────
    {
        let mut stmt = conn.prepare(
            "SELECT party_id, org_id, name, kind, email, contact, abn, created_at_ms
             FROM parties",
        )?;
        let rows = stmt.query_map([], |row| {
            let kind_s: String = row.get(3)?;
            Ok(Party {
                party_id: row.get(0)?,
                org_id: row.get(1)?,
                name: row.get(2)?,
                kind: PartyKind::from_str(&kind_s),
                email: row.get(4)?,
                contact: row.get(5)?,
                abn: row.get(6)?,
                created_at_ms: row.get(7)?,
            })
        })?;
        for r in rows {
            let p = r?;
            store.parties.insert(p.party_id.clone(), p);
        }
    }

    // ── accounts ─────────────────────────────────────────────────────────────
    {
        let mut stmt =
            conn.prepare("SELECT code, name, acct_type, normal_balance FROM accounts")?;
        let rows = stmt.query_map([], |row| {
            Ok(AccountRecord {
                code: row.get(0)?,
                name: row.get(1)?,
                acct_type: row.get(2)?,
                normal_balance: row.get(3)?,
            })
        })?;
        for r in rows {
            let a = r?;
            store.accounts.insert(a.code.clone(), a);
        }
    }

    Ok(store)
}
