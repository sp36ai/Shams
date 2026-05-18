# DĀR AL-SHAMS — COMPONENT IMPLEMENTATION GUIDE

Sacred UI component patterns for the manuscript chamber aesthetic.

---

## SACRED BUTTON

The Ask button must feel like **a sacred seal being pressed**.

### Visual Requirements
- Illuminated gold border
- Engraved text (Cinzel Bold)
- Subtle breathing glow
- Parchment texture background
- No modern flat design

### Implementation Pattern

```typescript
import { useColors } from '@theme/ThemeProvider';
import { useTypography } from '@theme/useTypography';
import { MOTION, SPACING, RADIUS } from '@theme/themes';

const SacredButton = ({ onPress, children }) => {
  const colors = useColors();
  const typography = useTypography();
  
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.gold,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING.lg,
        paddingHorizontal: SPACING.xl,
        shadowColor: colors.sacredGlow,
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <Text style={[typography.button, { color: colors.gold }]}>
        {children}
      </Text>
    </Pressable>
  );
};
```

---

## VERDICT SEAL

The verdict must appear like **opening a sealed manuscript**.

### MAQBOOL Seal

```typescript
const MaqboolSeal = ({ question }) => {
  const colors = useColors();
  const typography = useTypography();
  
  return (
    <View style={{
      backgroundColor: colors.maqboolGlow,
      borderWidth: 2,
      borderColor: colors.maqbool,
      borderRadius: RADIUS.lg,
      padding: SPACING.xxl,
      alignItems: 'center',
    }}>
      <Text style={[typography.hero, { color: colors.maqbool }]}>
        MAQBOOL
      </Text>
      <Text style={[typography.caption, { color: colors.text, marginTop: SPACING.sm }]}>
        The answer is YES
      </Text>
    </View>
  );
};
```

### MARDOOD Seal

```typescript
const MardoodSeal = ({ question }) => {
  const colors = useColors();
  const typography = useTypography();
  
  return (
    <View style={{
      backgroundColor: colors.mardoodGlow,
      borderWidth: 2,
      borderColor: colors.mardood,
      borderRadius: RADIUS.lg,
      padding: SPACING.xxl,
      alignItems: 'center',
    }}>
      <Text style={[typography.hero, { color: colors.mardood }]}>
        MARDOOD
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: SPACING.sm }]}>
        The answer is NO
      </Text>
    </View>
  );
};
```

---

## MANUSCRIPT CARD

Cards should feel like **parchment strips with wax-seal energy**.

```typescript
const ManuscriptCard = ({ children, elevated = false }) => {
  const colors = useColors();
  
  return (
    <View style={{
      backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: SPACING.lg,
      shadowColor: '#000000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    }}>
      {children}
    </View>
  );
};
```

---

## MANUSCRIPT DIVIDER

Geometric separators between oracle content blocks.

```typescript
const ManuscriptDivider = () => {
  const colors = useColors();
  
  return (
    <View style={{
      height: 1,
      backgroundColor: colors.border,
      marginVertical: SPACING.lg,
      opacity: 0.6,
    }} />
  );
};
```

### Ornamental Divider

```typescript
const OrnamentalDivider = () => {
  const colors = useColors();
  
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: SPACING.xl,
    }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ color: colors.gold, marginHorizontal: SPACING.md }}>
        ✦
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
};
```

---

## BREATHING GLOW

Sacred objects should pulse slowly like breathing (6-10 second cycles).

```typescript
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

const BreathingGlow = ({ children }) => {
  const opacity = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: MOTION.breathe / 2,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: MOTION.breathe / 2,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);
  
  return (
    <Animated.View style={{ opacity }}>
      {children}
    </Animated.View>
  );
};
```

---

## CELESTIAL LOADING

**Do NOT use spinner.** Use rotating astrolabe or breathing seal.

```typescript
const CelestialLoading = () => {
  const colors = useColors();
  const typography = useTypography();
  const rotation = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);
  
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Text style={{ fontSize: 64, color: colors.gold }}>✦</Text>
      </Animated.View>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: SPACING.lg }]}>
        Casting the Sacred Chart
      </Text>
      <Text style={[typography.caption, { color: colors.textFaint, marginTop: SPACING.xs }]}>
        The heavens are speaking...
      </Text>
    </View>
  );
};
```

---

## HORA STATUS INDICATOR

Current hora should feel like **a living celestial marker**.

```typescript
const HoraIndicator = ({ planet, timeRemaining }) => {
  const colors = useColors();
  const typography = useTypography();
  
  return (
    <BreathingGlow>
      <View style={{
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.gold,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        shadowColor: colors.sacredGlow,
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          Current Hora
        </Text>
        <Text style={[typography.title, { color: colors.gold, marginTop: SPACING.xs }]}>
          {planet} Hora
        </Text>
        <Text style={[typography.caption, { color: colors.textFaint, marginTop: SPACING.xs }]}>
          {timeRemaining} remaining
        </Text>
      </View>
    </BreathingGlow>
  );
};
```

---

## MOON MANSION DISPLAY

```typescript
const MoonMansionDisplay = ({ arabicName, transliteration, description }) => {
  const colors = useColors();
  const typography = useTypography();
  
  return (
    <ManuscriptCard elevated>
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        Moon Manzil
      </Text>
      <Text style={[typography.heading, { color: colors.gold, marginTop: SPACING.sm }]}>
        {arabicName}
      </Text>
      <Text style={[typography.subheading, { color: colors.text, marginTop: SPACING.xs }]}>
        {transliteration}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted, marginTop: SPACING.md }]}>
        {description}
      </Text>
    </ManuscriptCard>
  );
};
```

---

## TIER BADGE

```typescript
const TierBadge = ({ tier }) => {
  const colors = useColors();
  const typography = useTypography();
  
  const tierConfig = {
    wanderer: { label: 'WANDERER', color: colors.textMuted },
    mureed: { label: 'MUREED', color: colors.gold },
    khass: { label: 'KHASS', color: colors.goldBright },
  };
  
  const config = tierConfig[tier];
  
  return (
    <View style={{
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: config.color,
      borderRadius: RADIUS.pill,
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.md,
    }}>
      <Text style={[typography.label, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
};
```

---

## QUESTION INPUT

The input field should resemble **an engraved manuscript strip, not a chat textbox**.

```typescript
const QuestionInput = ({ value, onChangeText, placeholder }) => {
  const colors = useColors();
  const typography = useTypography();
  
  return (
    <View style={{
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: SPACING.lg,
    }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        multiline
        style={[
          typography.body,
          {
            color: colors.text,
            minHeight: 120,
            textAlignVertical: 'top',
          }
        ]}
      />
    </View>
  );
};
```

---

## HISTORY CARD

Cards should feel like **archival registry entries with wax-seal energy**.

```typescript
const HistoryCard = ({ question, verdict, timestamp, hora, onPress }) => {
  const colors = useColors();
  const typography = useTypography();
  
  const verdictColor = verdict === 'MAQBOOL' ? colors.maqbool : colors.mardood;
  
  return (
    <Pressable onPress={onPress}>
      <ManuscriptCard>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[typography.label, { color: verdictColor }]}>
            {verdict}
          </Text>
          <Text style={[typography.caption, { color: colors.textFaint }]}>
            {hora} Hora
          </Text>
        </View>
        
        <Text 
          style={[typography.body, { color: colors.text, marginTop: SPACING.md }]}
          numberOfLines={2}
        >
          {question}
        </Text>
        
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: SPACING.sm }]}>
          {timestamp}
        </Text>
      </ManuscriptCard>
    </Pressable>
  );
};
```

---

## SCREEN CONTAINER

Every screen should have the base manuscript chamber atmosphere.

```typescript
const ScreenContainer = ({ children }) => {
  const colors = useColors();
  
  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.bg,
    }}>
      {/* Vellum overlay */}
      <View style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.vellumOverlay,
        pointerEvents: 'none',
      }} />
      
      {/* Manuscript fog */}
      <View style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.manuscriptFog,
        pointerEvents: 'none',
      }} />
      
      {/* Content */}
      <SafeAreaView style={{ flex: 1 }}>
        {children}
      </SafeAreaView>
    </View>
  );
};
```

---

## USAGE RULES

### DO:
- Use breathing glow on sacred elements
- Apply manuscript texture overlays
- Use slow, ceremonial animations
- Implement gold borders on focus states
- Add subtle shadows for depth
- Use proper typography variants

### DON'T:
- Use spinners for loading
- Apply bounce animations
- Use bright colors
- Create flat, modern cards
- Use aggressive transitions
- Hardcode font families

---

## ACCESSIBILITY

All components must maintain:
- Minimum contrast ratio 4.5:1 for body text
- Minimum contrast ratio 3:1 for large text
- Touch targets minimum 44x44dp
- Screen reader support
- Keyboard navigation support

---

**These patterns establish the sacred UI language for the entire app.**
