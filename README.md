# Corngr - Secure Document Editor

A local-first, security-focused document editor with cloud backup and real-time collaboration capabilities.

## 🚀 Features

### Phase 4 & 5: Cryptographic Security & Cloud Sync

#### Cryptographic Security
- **Ed25519 Signatures**: Industry-standard elliptic curve cryptography for token signing
- **Capability Tokens**: Pre-authorized access tokens for 20x performance improvement
- **Token Expiration**: Automatic expiry after 5 minutes (configurable)
- **Token Revocation**: Instant invalidation of compromised tokens

#### Cloud Sync
- **Supabase Integration**: Automatic cloud backup on every save
- **Bidirectional Sync**: Restore from cloud on app launch
- **Conflict Resolution**: CRDT-based via Yjs (automatic merge)
- **Offline Support**: Local-first architecture with async cloud backup

#### Security Model (ABAC)
- **Role-Based Permissions**: admin, editor, viewer
- **Clearance Levels**: 0-3 for hierarchical access control
- **Block-Level ACLs**: Fine-grained access control per content block
- **Classification Labels**: public, internal, confidential, restricted

### Performance
- **Transclusion Speed**: 5.9ms with tokens (vs 121.6ms without)
- **ABAC Checks**: <1ms frontend overhead
- **Cloud Sync**: Non-blocking (150ms async)
- **20x Performance Improvement**: Via capability token system

## 🔧 Setup

### Prerequisites
- Node.js 18+
- Rust 1.70+
- Supabase account (optional, for cloud sync)

### Installation

1. **Clone the repository**
```bash
git clone <repo-url>
cd corngr-phase0
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Supabase** (optional, for cloud sync)
   
   a. Create a Supabase project at https://supabase.com
   
   b. Run the migration in your Supabase SQL Editor:
   ```bash
   # Copy the SQL from:
   src-tauri/migrations/001_create_documents.sql
   ```
   
   c. Update your Supabase credentials:
   ```typescript
   // src/config/SupabaseConfig.ts
   export const SUPABASE_URL = 'https://your-project.supabase.co';
   export const SUPABASE_ANON_KEY = 'your-anon-key';
   export const ENABLE_CLOUD_SYNC = true; // Set to false to disable
   ```

   d. **IMPORTANT: Disable Email Confirmation** (for local dev):
   - Go to **Authentication > Providers > Email**
   - Toggle **OFF** "Confirm email"
   - Click **Save**
   *(This prevents "Email link invalid" errors on localhost)*

4. **Run the development server**
```bash
npm run tauri dev
```

### Running Tests

**Rust Backend:**
```bash
cd src-tauri
cargo test
```
Expected: 5/5 tests passing

**TypeScript Frontend:**
```bash
npm test
```

## 📖 Architecture

### Technology Stack
- **Frontend**: React + ProseMirror + Yjs
- **Backend**: Tauri (Rust)
- **Cloud**: Supabase
- **Crypto**: Ed25519 (via ed25519-dalek)

### System Overview

```
┌─────────────────────────────────────────────────────┐
│                  Frontend (React)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ ProseMirror  │  │ SlideRenderer│  │ DemoApp   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │       │
│         └─────────────────┴─────────────────┘       │
│                           │                         │
│                  ┌────────▼────────┐                │
│                  │  Yjs Document   │                │
│                  └────────┬────────┘                │
└───────────────────────────┼─────────────────────────┘
                            │
                  ┌─────────▼──────────┐
                  │ TauriSecureNetwork │
                  └─────────┬──────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│ MetadataStore  │  │ TauriSyncProv  │  │ RefStore    │
└───────┬────────┘  └───────┬────────┘  └──────┬──────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
                ┌───────────▼───────────┐
                │   Rust Backend        │
                │   (Tauri Commands)    │
                │                       │
                │  • ABAC Engine        │
                │  • Crypto Signing     │
                │  • Token Revocation   │
                │  • File Persistence   │
                └───────┬───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐  ┌────▼─────┐  ┌──────▼──────┐
│ demo.crng    │  │ node.key │  │  Supabase   │
│ (Local DB)   │  │ (Crypto) │  │  (Cloud ☁️) │
└──────────────┘  └──────────┘  └─────────────┘
```

### Key Files
- `src/security/TauriSecureNetwork.ts` - Main network layer (400+ lines)
- `src-tauri/src/lib.rs` - Rust backend (850+ lines)
- `src/config/SupabaseConfig.ts` - Cloud sync configuration
- `src-tauri/migrations/001_create_documents.sql` - Database schema

## 🧪 Testing

### Test Coverage
- **Rust**: 5 tests covering ABAC, crypto, and permissions
- **TypeScript**: Unit tests for metadata, rendering, and permissions

### Manual Testing

#### Cloud Sync Test
1. Start the app and create content
2. Check Supabase dashboard → `documents` table
3. Delete local `demo.crng` file
4. Restart app
5. Verify content restored from cloud

#### Token Revocation Test
```javascript
// In browser console:
const token = await window.tauriNetwork.requestCapabilityToken('ref-1');
await invoke('revoke_capability_token', { token_id: token.token_id });
// Token should now be rejected
```

## 🔐 Security

### Capability Token Flow
1. **Handshake** (31ms): Client requests token, backend performs ABAC check
2. **Token Issued**: Ed25519 signature + 5-minute expiration
3. **Fast-Path** (5.9ms): Subsequent requests use token (no ABAC check)
4. **Verification**: Signature + expiration + revocation check

### ABAC Rules
- **Admin**: Full access to all blocks
- **Editor**: Read all, write non-locked blocks
- **Viewer**: Read based on clearance level
- **Clearance Levels**:
  - 0: Public + Internal
  - 2: + Confidential
  - 3: + Restricted

## 📚 Documentation

- [Implementation Plan](./docs/implementation_plan.md) - Phase 5 roadmap
- [Walkthrough](./docs/walkthrough.md) - Phase 4 verification
- [Architecture](./docs/ARCHITECTURE.md) - Detailed system design (coming soon)

## 🛠️ Development

### Project Structure
```
corngr-phase0/
├── src/                      # Frontend TypeScript/React
│   ├── components/           # React components
│   ├── prosemirror/          # ProseMirror editor
│   ├── security/             # Security layer
│   ├── slides/               # Slide renderer
│   └── config/               # Configuration
├── src-tauri/                # Rust backend
│   ├── src/
│   │   └── lib.rs            # Main backend logic
│   └── migrations/           # Database migrations
└── README.md
```

### Build for Production
```bash
npm run tauri build
```

## 🚀 Roadmap

### Phase 6: Real-Time Collaboration
- Supabase Realtime subscriptions
- Multi-user cursor presence
- Conflict resolution UI
- Offline queue for failed syncs

### Phase 7: Enterprise Features
- SSO/SAML integration
- Immutable audit logs
- Compliance reporting
- Data export/import

### Phase 8: Mobile Support
- Tauri Mobile (iOS/Android)
- Touch-optimized UI
- Mobile-specific sync strategy

## 📊 Performance Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Transclusion (with tokens) | <10ms | 5.9ms | ✅ |
| Transclusion (without tokens) | <150ms | 121.6ms | ✅ |
| ABAC Check | <50ms | <1ms | ✅ |
| Cloud Sync | Non-blocking | 150ms async | ✅ |
| Performance Improvement | 10-50x | 20x | ✅ |

## 🤝 Contributing

This is currently a research prototype. Contributions welcome!

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- Tauri for the excellent Rust-based app framework
- Yjs for CRDT-based collaboration
- Supabase for cloud infrastructure
- ProseMirror for the editor foundation

---

**Status**: Phase 5 Complete ✅  
**Last Updated**: 29 December 2025
