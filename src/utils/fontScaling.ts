/**
 * Global font-scaling clamp.
 * --------------------------------------------------------------------------
 * Shams al-Asrar is a fixed-dp "illuminated manuscript" layout: every screen is
 * composed from absolute type sizes and tight spacing (see theme/typography.ts).
 * By default React Native scales all text by the device's system Font size
 * setting, which on a design-locked layout like this reads as "everything is too
 * big and no longer fits the screen" the moment a user raises that setting.
 *
 * We therefore default every Text / TextInput to allowFontScaling=false so the
 * manuscript renders at its designed sizes. A caller that genuinely wants
 * scaling (e.g. a future accessibility surface) can still pass allowFontScaling
 * explicitly — the clamp only fills in the default.
 *
 * Why not Text.defaultProps: React 19 (shipped with RN 0.78) no longer applies
 * `defaultProps` to function components, so the classic
 * `Text.defaultProps.allowFontScaling = false` silently stops working. RN's Text
 * and TextInput are forwardRef components, so we wrap their `render` instead —
 * the one approach that still takes effect under React 19.
 *
 * NOTE: this does NOT affect Samsung "Display size" / screen zoom. That setting
 * changes the device's density system-wide; an app cannot (and should not)
 * override it. If the UI is still oversized after this clamp, the cause is
 * Display size, not Font size.
 */

import React from 'react';
import { Text, TextInput } from 'react-native';

type FontScalingProps = { allowFontScaling?: boolean };
type RenderFn = (props: FontScalingProps, ref: React.Ref<unknown>) => React.ReactNode;
type ClampableForwardRef = { render?: RenderFn & { __fontScalingClamped?: boolean } };

function clampComponent(component: ClampableForwardRef): void {
  const original = component.render;
  // Not a forwardRef component (nothing to wrap), or already clamped — no-op.
  if (typeof original !== 'function' || original.__fontScalingClamped === true) {
    return;
  }

  const wrapped: RenderFn & { __fontScalingClamped?: boolean } = (props, ref) => {
    const element = original(props, ref);
    if (!React.isValidElement(element)) {
      return element;
    }
    // Preserve an explicit caller choice; default everything else to no scaling.
    const callerValue = props.allowFontScaling;
    return React.cloneElement(element as React.ReactElement<FontScalingProps>, {
      allowFontScaling: callerValue ?? false,
    });
  };
  wrapped.__fontScalingClamped = true;
  component.render = wrapped;
}

/**
 * Disable OS Font-size scaling app-wide. Call once at startup, before the app
 * tree renders. Idempotent.
 */
export function clampGlobalFontScaling(): void {
  clampComponent(Text as unknown as ClampableForwardRef);
  clampComponent(TextInput as unknown as ClampableForwardRef);
}
