@@
-import { useColors, useTheme } from '@theme/ThemeProvider';
+import { useColors, useTheme } from '@theme/ThemeProvider';
 import { useTypography } from '@theme/useTypography';
 import { useTranslation, useI18n } from '@i18n/I18nProvider';
@@
-import StarfieldBackground from '@components/StarfieldBackground';
+import StarfieldBackground from '@components/StarfieldBackground';
 import RkpWatchCard from '@components/oracle/RkpWatchCard';
 import RemedyProtocolCard from '@components/oracle/RemedyProtocolCard';
+import { FEATURE_FLAGS } from '@config/featureFlags';
@@
-  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);
+  // Legacy modal selection state — only used when the dev QA flag is enabled.
+  const [selectedReading, setSelectedReading] = useState<Reading | null>(null);
+  const enableLegacyModal = FEATURE_FLAGS.ENABLE_LEGACY_READING_MODAL;
@@
-  const renderItem = useCallback(
-    ({ item }: { item: Reading }) => (
-      <ReadingRow
-        reading={item}
-        onPress={() => navigation.navigate('Reading', { threadId: item.id })}
-        onLongPress={() => handleDelete(item)}
-      />
-    ),
-    [handleDelete, navigation],
-  );
+  const renderItem = useCallback(
+    ({ item }: { item: Reading }) => (
+      <ReadingRow
+        reading={item}
+        onPress={() =>
+          enableLegacyModal ? setSelectedReading(item) : navigation.navigate('Reading', { threadId: item.id })
+        }
+        onLongPress={() => handleDelete(item)}
+      />
+    ),
+    [handleDelete, navigation, enableLegacyModal],
+  );
@@
-      {/* Detail modal removed: Reading route is the canonical detail UI */}
+      {/* Legacy modal — only rendered for dev/QA when the feature flag is enabled. */}
+      {enableLegacyModal && selectedReading !== null && (
+        <ReadingDetailModal
+          reading={selectedReading}
+          onClose={() => setSelectedReading(null)}
+          onDelete={() => {
+            handleDelete(selectedReading);
+            setSelectedReading(null);
+          }}
+        />
+      )}
*** End Patch