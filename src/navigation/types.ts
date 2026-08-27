@@
 export type RootStackParamList = {
   Splash: undefined;
   Auth: undefined;
   Onboarding: undefined;
   LocationPermission: undefined;
   Main: undefined;
   Premium: undefined;
   /** Settings — reached via the gear icon in the Home dashboard header. */
   Settings: undefined;
   /** Oracle Chat — the question/verdict conversation, reached via Home's
    *  "Ask New Question" CTA. A root-level push, not a persistent tab. */
   OracleChat: undefined;
+  /** Reading — thread-first conversation; accepts a threadId or an initialQuestion. */
+  Reading: { threadId?: string; initialQuestion?: string } | undefined;
 };
@@
 export type AppNavigation = CompositeNavigationProp<
   BottomTabNavigationProp<MainTabParamList>,
   NativeStackNavigationProp<RootStackParamList>
 >;
