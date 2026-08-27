*** Begin Patch
*** Update File: src/screens/OracleChatScreen.tsx
@@
 import { useReadingsStore } from '@stores/readingsStore';
+import { useReadingThreadsStore } from '@stores/readingThreadsStore';
@@
   const addReading = useReadingsStore(
     (s: ReturnType<typeof useReadingsStore.getState>) => s.addReading,
   );
+  const addThread = useReadingThreadsStore(s => s.addThread);
+  const addMessageToThread = useReadingThreadsStore(s => s.addMessageToThread);
+  const attachReadingToThread = useReadingThreadsStore(s => s.attachReadingToThread);
@@
-        updateMessage(oracleMessageId, { status: 'sent', reading: result.reading });
-
-        await addReading(
-          toReadingRecord({
-            id: result.reading.readingId,
-            question,
-            questionLang: lang,
-            createdAt: result.reading.computedAt,
-            reading: result.reading,
-          }),
-        );
-
-        runGuidanceSelection(oracleMessageId, question, result.reading);
+        updateMessage(oracleMessageId, { status: 'sent', reading: result.reading });
+
+        // Persist structured Reading (existing behavior)
+        await addReading(
+          toReadingRecord({
+            id: result.reading.readingId,
+            question,
+            questionLang: lang,
+            createdAt: result.reading.computedAt,
+            reading: result.reading,
+          }),
+        );
+
+        // Integrate into thread model: create or merge a thread whose id === readingId
+        try {
+          const threadId = result.reading.readingId;
+          const now = result.reading.computedAt ?? new Date().toISOString();
+          const thread = {
+            id: threadId,
+            question,
+            createdAt: now,
+            lastActivityAt: now,
+            messages: [],
+            readingId: threadId,
+          } as any;
+          // Upsert thread if not present
+          addThread(thread);
+
+          // Add user + oracle messages into the thread
+          const userMsg = {
+            id: `u_${Date.now()}`,
+            role: 'user',
+            text: question,
+            createdAt: now,
+          } as any;
+          const oracleMsg = {
+            id: `o_${Date.now()}`,
+            role: 'oracle',
+            createdAt: now,
+            status: 'sent',
+            reading: result.reading,
+          } as any;
+          addMessageToThread(threadId, userMsg);
+          addMessageToThread(threadId, oracleMsg);
+          // Attach reading to thread metadata
+          attachReadingToThread(threadId, threadId, result.reading);
+        } catch (e) {
+          // Thread integration is best-effort; preserve existing chat behavior regardless
+        }
+
+        runGuidanceSelection(oracleMessageId, question, result.reading);
*** End Patch