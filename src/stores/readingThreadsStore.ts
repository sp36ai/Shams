*** Begin Patch
*** Update File: src/stores/readingThreadsStore.ts
@@
 import { storage, KEYS } from '@storage/mmkv';
+import type { Reading } from '@stores/readingsStore';
@@
 const THREADS_CACHE_KEY = KEYS.READINGS_CACHE.replace('readings.cache.v1', 'threads.cache.v1');
+const THREADS_MIGRATED_PREFIX = KEYS.THREADS_MIGRATED_PREFIX; // 'threads.migrated.v1.' + uid
@@
 export const useReadingThreadsStore = create<ReadingThreadsState>((set, get) => ({
   threads: readThreadsCache(),
@@
   clearAll: () => {
     storage.delete(THREADS_CACHE_KEY);
     set({ threads: [] });
   },
+  // Migration helper: migrate persisted readings (READINGS_CACHE) into thread model
+  // Account-scoped, idempotent, interruption-safe. Writes sentinel only after
+  // full pass completes. If a thread already exists for a reading id, it is
+  // preserved/merged and not duplicated.
}));
+
+/**
+ * Migrate existing persisted readings into threads for the given userId.
+ * Idempotent and interruption-safe: skips existing threads and writes sentinel
+ * only after successful completion.
+ */
+export async function migrateReadingsToThreadsForUser(uid: string): Promise<void> {
+  if (!uid) return;
+  const sentinelKey = THREADS_MIGRATED_PREFIX + uid;
+  // If sentinel present, consider migration already complete for this account
+  const already = storage.getString(sentinelKey);
+  if (already !== undefined) {
+    return;
+  }
+
+  // Read legacy readings cache
+  const raw = storage.getString(KEYS.READINGS_CACHE);
+  if (!raw) {
+    // Nothing to migrate; write sentinel and return
+    storage.set(sentinelKey, new Date().toISOString());
+    return;
+  }
+
+  let parsed: unknown;
+  try {
+    parsed = JSON.parse(raw);
+  } catch (e) {
+    // Corrupt legacy cache — do not attempt migration; write sentinel to avoid loops
+    storage.set(sentinelKey, new Date().toISOString());
+    return;
+  }
+
+  if (!Array.isArray(parsed)) {
+    storage.set(sentinelKey, new Date().toISOString());
+    return;
+  }
+
+  const legacyReadings = parsed as Reading[];
+  // Load current threads once
+  const currentThreads = readThreadsCache();
+  const threadsMap = new Map(currentThreads.map(t => [t.id, t]));
+
+  // Iterate readings and upsert threads preserving relationships
+  for (const r of legacyReadings) {
+    if (!r || typeof r.id !== 'string') continue;
+    const existing = threadsMap.get(r.id);
+    if (existing !== undefined) {
+      // Merge: ensure reading metadata present
+      const merged = { ...existing };
+      if (!merged.readingId && r.id) merged.readingId = r.id;
+      // Ensure createdAt/lastActivityAt preserved
+      merged.createdAt = merged.createdAt ?? r.createdAt;
+      merged.lastActivityAt = merged.lastActivityAt ?? r.createdAt;
+      threadsMap.set(r.id, merged);
+      continue;
+    }
+
+    // Construct minimal thread with two messages: user question and oracle response
+    const userMsgId = `u_${r.id}`;
+    const oracleMsgId = `o_${r.id}`;
+    const userMessage = {
+      id: userMsgId,
+      role: 'user' as const,
+      text: r.question,
+      createdAt: r.createdAt,
+    } as ThreadMessage;
+    const oracleMessage = {
+      id: oracleMsgId,
+      role: 'oracle' as const,
+      createdAt: r.createdAt,
+      status: 'sent' as const,
+      reading: r,
+    } as ThreadMessage;
+
+    const thread: Thread = {
+      id: r.id,
+      question: r.question,
+      createdAt: r.createdAt,
+      lastActivityAt: r.createdAt,
+      messages: [userMessage, oracleMessage],
+      readingId: r.id,
+    };
+    threadsMap.set(thread.id, thread);
+  }
+
+  const mergedThreads = Array.from(threadsMap.values()).sort((a, b) =>
+    b.lastActivityAt.localeCompare(a.lastActivityAt),
+  );
+
+  // Write merged threads cache atomically
+  try {
+    writeThreadsCache(mergedThreads);
+    // finally write sentinel to mark migration complete for this account
+    storage.set(sentinelKey, new Date().toISOString());
+  } catch (e) {
+    // If write fails, do not write sentinel so migration can be retried
+    throw e;
+  }
+}
*** End Patch
