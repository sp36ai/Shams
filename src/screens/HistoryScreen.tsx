*** Begin Patch
*** Update File: src/screens/HistoryScreen.tsx
@@
-  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);
+  // remove local modal-based selection — History now navigates to a thread-first Reading route
@@
-  const renderItem = useCallback(
-    ({ item }: { item: Reading }) => (
-      <ReadingRow
-        reading={item}
-        onPress={() => setSelectedReading(item)}
-        onLongPress={() => handleDelete(item)}
-      />
-    ),
-    [handleDelete],
-  );
+  const renderItem = useCallback(
+    ({ item }: { item: Reading }) => (
+      <ReadingRow
+        reading={item}
+        onPress={() => navigation.navigate('Reading', { threadId: item.id })}
+        onLongPress={() => handleDelete(item)}
+      />
+    ),
+    [handleDelete, navigation],
+  );
@@
-      {/* ── Detail modal ── */}
-      {selectedReading !== null && (
-        <ReadingDetailModal
-          reading={selectedReading}
-          onClose={() => setSelectedReading(null)}
-          onDelete={() => {
-            handleDelete(selectedReading);
-            setSelectedReading(null);
-          }}
-        />
-      )}
+      {/* Detail modal removed: Reading route is the canonical detail UI */}
*** End Patch
