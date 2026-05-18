# DĀR AL-SHAMS — MASTER DESIGN SYSTEM

**"The House of the Hidden Sun"**

The canonical theme architecture for Shams al-Asrār.

---

## VISUAL PHILOSOPHY

The user enters:
- A sacred observatory
- An illuminated manuscript vault
- A celestial court of judgment

The app must NEVER feel:
- Modern-minimal startup
- Neon cyberpunk
- Fantasy game UI
- Generic astrology app
- Luxury fintech

The interface should feel:
- Ancient but alive
- Ceremonial but readable
- Mystical but computational

---

## MATERIAL LANGUAGE

### Obsidian Manuscript Black

Not true black. Use:
- Charcoal-black
- Soot-black
- Deep blue-black
- Aged ink-black

The background must feel:
- Mineral
- Velvet
- Ancient paper burnt at edges
- Celestial night

**Colors:**
- `bg: #0A0A0F` — Deep blue-black void
- `surface: #12121A` — Elevated manuscript page
- `surfaceElevated: #1A1A26` — Sealed verdict container
- `border: #2A2A38` — Manuscript ruling lines

### Illuminated Gold

Not bright yellow. Gold must resemble:
- Quranic manuscript edging
- Brass astrolabe reflections
- Aged coin metal
- Sacred illumination

**Colors:**
- `gold: #C9A961` — Primary sacred gold
- `goldBright: #E8C77D` — Active glow state
- `brass: #9A8350` — Subdued aged brass

**Usage:**
- Seals
- Verdicts
- Headings
- Divine elements
- Interactive focus

**Never use gold as bulk UI fill.**

---

## TEXTURE SYSTEM

Every screen should carry subtle texture:
- Vellum grain
- Manuscript fiber
- Oxidized metal
- Dust haze
- Low-opacity celestial fog

**Implementation:**
- `vellumOverlay: rgba(244, 239, 227, 0.03)`
- `manuscriptFog: rgba(201, 169, 97, 0.08)`

Every screen should feel physically touchable.

---

## LIGHTING SYSTEM

The app is lit like:
- Candlelight
- Lantern glow
- Lunar reflection

Never:
- White light
- Glassmorphism
- Harsh bloom
- Apple-style gradients

### Glow Rules

Only sacred objects glow:
- Medallion
- Verdict pill
- Active hora
- Moon mansion
- Divine names
- Current ascendant marker

**Glow should pulse slowly like breathing.**
- Cycle: 6–10 seconds
- `breathe: 8000ms`

**Colors:**
- `sacredGlow: #C9A961` — Breathing pulse on medallions
- `lunarReflection: #8FA3B8` — Moon mansion markers
- `candlelight: #E8C77D` — Warm ambient glow

---

## TYPOGRAPHY SYSTEM

### Latin (English)

**Display:** Cinzel
- Engraved
- Ceremonial
- Archival

**Body:** Spectral
- Readable manuscript prose
- Stable serif
- High legibility

### Arabic (Urdu)

**All text:** Amiri
- Quranic
- Stable
- Reverent
- Highly legible

**CRITICAL:**
- Do NOT use decorative Arabic fonts everywhere
- RTL blocks need dedicated containers with:
  - Increased line-height (2.1)
  - Centered alignment
  - Soft manuscript panels

### Devanagari (Hindi)

**All text:** Noto Sans Devanagari

### Typography Scale

| Variant | Size | Spacing | Usage |
|---------|------|---------|-------|
| `hero` | 52dp | 2.0 | Splash wordmark, verdict seals |
| `title` | 30dp | 1.2 | Screen titles |
| `heading` | 22dp | 0.8 | Section headers |
| `subheading` | 18dp | 0.5 | Card titles |
| `body` | 17dp | 0.3 | Oracle prose |
| `caption` | 14dp | 0.4 | Timestamps |
| `label` | 13dp | 1.2 | Tier badges |
| `button` | 17dp | 1.4 | CTA text |

---

## VERDICT STATES

### MAQBOOL (YES)

**Emotion:** Acceptance, opening, destiny aligning

**Visual:**
- Warm gold atmosphere
- Soft amber diffusion
- Light descending from top
- Subtle upward movement

**Colors:**
- `maqbool: #D4A855` — Warm acceptance gold
- `maqboolGlow: rgba(212, 168, 85, 0.25)` — Soft golden atmosphere

### MARDOOD (NO)

**Emotion:** Silence, restraint, wisdom, delay

**Visual:**
- Cool restrained darkness
- Muted bronze
- Moonlight blue-black shadows
- No dramatic red denial

**Colors:**
- `mardood: #6B7C8C` — Cool moonlight blue-gray
- `mardoodGlow: rgba(107, 124, 140, 0.15)` — Blue-black shadow

---

## MOTION SYSTEM

### Animation Philosophy

Everything moves slowly.

**Never:**
- Bounce
- Playful easing
- Aggressive transitions

**Preferred:**
- Fade
- Drift
- Orbital motion
- Breathing scale
- Celestial rotation

### Timing

| Duration | Usage |
|----------|-------|
| `fast: 180ms` | Seal press, subtle resonance |
| `base: 320ms` | Fade, drift, breathing |
| `slow: 480ms` | Orbital motion, celestial rotation |
| `splash: 3200ms` | Gold dust emergence |
| `breathe: 8000ms` | Sacred breathing pulse |

---

## SCREEN ARCHITECTURE

### 1. SPLASH SCREEN

**Not a splash screen. A ritual awakening.**

**Sequence:**
1. Black void
2. Gold dust emergence
3. Medallion slowly revealed
4. "SHAMS AL-ASRĀR"
5. Tiny atmospheric shimmer
6. Fade into onboarding

**Duration:** 2.8–3.5 seconds

### 2. HOME SCREEN

**The Observatory Hall**

**Hierarchy:**
- Hora status at top
- Celestial state
- Ask entry
- Moon mansion
- User tier

**The Ask button must feel like a sacred seal being pressed.**

### 3. QUESTION SCREEN

**The ritual chamber**

**UI behavior:**
- Subtle ticking aura
- Live planetary state
- Slowly rotating geometry behind input

**The input field should resemble an engraved manuscript strip, not a chat textbox.**

### 4. ORACLE LOADING SCREEN

**Critical emotional screen**

**Do NOT use spinner.**

**Instead:**
- Rotating astrolabe
- Orbiting planetary glyphs
- Breathing seal
- Celestial calculations
- Manuscript illumination progression

**This screen determines perceived intelligence.**

### 5. ORACLE RESPONSE SCREENS

**The most important surface**

**These screens should feel like opening a sealed verdict.**

**Content hierarchy:**
- Verdict Seal
- Celestial Metadata
- Question Echo
- Manzil
- Oracle Text
- Quranic Verse
- Dua
- Divine Names
- Remedy
- Closing Seal

**Each block separated using:**
- Manuscript dividers
- Geometric separators
- Thin gold ruling lines

### 6. AL-FALAK SCREEN

**The crown jewel**

**The wheel must resemble:**
- Brass astrolabe
- Celestial instrument
- Illuminated observatory mechanism

**Not:** Flat SVG chart

**The wheel should:**
- Rotate subtly
- Breathe
- Shimmer on active markers

**Planet indicators should feel engraved.**

**The ASC pointer must feel mechanical and sacred.**

### 7. HISTORY SCREEN

**An archive of sealed verdicts**

**Cards:**
- Parchment strips
- Wax-seal energy
- Archival registry

**No modern feed behavior.**

### 8. PAYWALL

**Initiation tiers, not subscription commerce**

**Tiers:**
- Free → Wanderer
- Mureed → Initiated
- Khass → Keeper of the Inner Chamber

**Emotional framing:** Access to deeper chambers

---

## ICONOGRAPHY

### Use:
- Astrolabes
- Celestial geometry
- Engraved planetary glyphs
- Manuscript dividers
- Lunar sigils
- Islamic geometric fragments

### Avoid:
- Crystal balls
- Witches
- Fantasy moons
- Zodiac emoji aesthetics

---

## HAPTICS

If haptics are used, very soft:
- Seal press
- Subtle resonance
- Metallic confirmation

**Never:**
- Aggressive vibration
- iOS generic taps

---

## ATMOSPHERIC ELEMENTS

### Celestial Dust
- `celestialDust: #E8C77D` — Golden starfield particles

### Vellum Overlay
- `vellumOverlay: rgba(244, 239, 227, 0.03)` — Subtle grain

### Manuscript Fog
- `manuscriptFog: rgba(201, 169, 97, 0.08)` — Low-opacity haze

---

## WHAT THIS ACHIEVES

If executed correctly:
- The logo feels native to the environment
- The engine feels ancient yet computational
- The oracle feels authoritative
- The app becomes identifiable instantly
- The UI gains spiritual gravity without kitsch
- The premium tiers feel ceremonial instead of monetized

---

## POSITIONING

This app visually sits between:
- An illuminated Islamic manuscript
- An astronomical observatory
- A sacred oracle engine

**Not:**
- Meditation app
- AI chatbot
- Horoscope app
- Mystical social network

---

## IMPLEMENTATION NOTES

### Color Token Usage

```typescript
// Backgrounds
colors.bg              // Full-screen base
colors.surface         // Cards, parchment strips
colors.surfaceElevated // Modals, sealed verdicts

// Borders
colors.border          // Manuscript ruling lines
colors.borderAccent    // Illuminated gold edging

// Gold hierarchy
colors.gold            // Primary sacred accent
colors.goldBright      // Active glow state
colors.brass           // Subdued aged brass

// Verdict states
colors.maqbool         // Warm acceptance
colors.maqboolGlow     // Golden atmosphere
colors.mardood         // Cool restraint
colors.mardoodGlow     // Blue-black shadow

// Text
colors.text            // Cream manuscript ink
colors.textMuted       // Aged ink
colors.textFaint       // Barely visible
colors.textOnGold      // Dark on gold surfaces

// Atmospheric
colors.celestialDust   // Starfield particles
colors.vellumOverlay   // Subtle grain
colors.manuscriptFog   // Low-opacity haze
colors.sacredGlow      // Breathing pulse
colors.lunarReflection // Moon markers
colors.candlelight     // Warm ambient
```

### Typography Usage

```typescript
// Always use the hook
const typography = useTypography();

// Apply variants
<Text style={typography.hero}>MAQBOOL</Text>
<Text style={typography.title}>The Oracle Speaks</Text>
<Text style={typography.body}>Oracle prose...</Text>
```

### Motion Usage

```typescript
import { MOTION } from '@theme/themes';

// Breathing pulse
Animated.loop(
  Animated.sequence([
    Animated.timing(opacity, {
      toValue: 1,
      duration: MOTION.breathe / 2,
      useNativeDriver: true,
    }),
    Animated.timing(opacity, {
      toValue: 0.6,
      duration: MOTION.breathe / 2,
      useNativeDriver: true,
    }),
  ])
).start();
```

---

**This is now the single canonical design system for Shams al-Asrār.**
