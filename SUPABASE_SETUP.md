# 🚀 Supabase RLS Quick Fix Guide

**Purpose:** Enable Realtime collaboration by configuring Row Level Security policies  
**Time:** ~5 minutes  
**Status:** ⚠️ Required for collaboration to work

---

## 📋 Prerequisites

- [ ] Supabase project created (you have: `juhzmpncciuzbiaehojr.supabase.co`)
- [ ] Supabase account access
- [ ] `documents` table exists in your database

---

## 🔧 Step-by-Step Setup

### 1️⃣ Access Supabase SQL Editor

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project (`juhzmpncciuzbiaehojr`)
3. Navigate to: **SQL Editor** (left sidebar)
4. Click **"New Query"**

### 2️⃣ Run the RLS Configuration Script

1. Open `supabase-rls-setup.sql` in this directory
2. **Copy the entire contents**
3. **Paste into the Supabase SQL Editor**
4. Click **"Run"** (or press `Cmd+Enter`)

### 3️⃣ Verify Setup

After running the script, check the results:

```sql
-- Should show: rowsecurity = true
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'documents';

-- Should show 4 policies
SELECT policyname FROM pg_policies WHERE tablename = 'documents';
```

Expected policies:
- ✅ Allow authenticated users to read documents
- ✅ Allow authenticated users to insert documents  
- ✅ Allow authenticated users to update own documents
- ✅ Allow authenticated users to delete own documents

### 4️⃣ Enable Realtime in Dashboard

1. Go to **Database** → **Replication** (left sidebar)
2. Find the `documents` table
3. Toggle **"Enable Realtime"** to ON
4. Click **"Save"**

---

## ✅ Test Collaboration

After setup, test multi-user collaboration:

1. **Hard refresh** your browser windows (`Cmd+Shift+R`)
2. Open the app in **two separate browser windows**
3. Navigate to the **same document** in both windows
4. Check console logs for: `📡 Real-Time Subscription Status: SUBSCRIBED` (should stay SUBSCRIBED)
5. Type in Window 1 → should appear in Window 2
6. Verify:
   - ✅ Text syncs between windows
   - ✅ Active Users shows "2"
   - ✅ Remote cursors visible
   - ✅ Presence notifications appear

---

## 🐛 Troubleshooting

### Issue: Connection still shows CLOSED

**Check 1:** Verify `documents` table exists
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'documents';
```

**Check 2:** Verify user is authenticated
```sql
SELECT auth.uid(); -- Should return a UUID, not null
```

**Check 3:** Check Realtime logs
- Dashboard → Logs → Realtime Logs
- Look for subscription errors

### Issue: No "documents" table in Replication settings

You need to create the table first:

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🎯 What This Fixes

| Before | After |
|--------|-------|
| ❌ SUBSCRIBED → CLOSED loop | ✅ Stable SUBSCRIBED connection |
| ❌ Active Users: 1 | ✅ Active Users: 2+ |
| ❌ No text sync | ✅ Real-time text sync |
| ❌ No remote cursors | ✅ Colored remote cursors |
| ❌ No presence notifications | ✅ "{User} joined" messages |

---

## 📚 Next Steps

Once collaboration is working:
1. ✅ Verify all features in `COLLABORATION_DEMO.md`
2. 📋 Review `TAURI_WEBSOCKET_MIGRATION_PLAN.md` for long-term solution
3. 🚀 Plan migration away from Supabase dependency

---

## 🔗 Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Realtime Guide](https://supabase.com/docs/guides/realtime)
- [Debugging Realtime](https://supabase.com/docs/guides/realtime/debugging)

**Questions?** Check the console logs or Supabase Dashboard → Logs → Realtime
