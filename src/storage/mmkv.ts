@@
   // Readings cache (most-recent N readings for offline open of History)
   READINGS_CACHE: 'readings.cache.v1',
+  // Threads cache (thread-first conversation storage)
+  THREADS_CACHE: 'threads.cache.v1',
+
+  // Per-account migration sentinel prefix: used as `${THREADS_MIGRATED_PREFIX}${uid}`
+  THREADS_MIGRATED_PREFIX: 'threads.migrated.v1.',
@@
 export type StorageKey = (typeof KEYS)[keyof typeof KEYS];
