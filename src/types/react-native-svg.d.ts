/**
 * Type shim for react-native-svg@15.x
 *
 * The library ships class-based components inheriting from Shape<P>, which
 * carries an `[x: string]: unknown` index signature. TypeScript 5.x strict
 * JSX checking cannot resolve the construct signature through that index
 * signature (TS2604). We re-declare every component we use as React.FC so
 * callers get autocomplete without `as any` casts at usage sites.
 */

declare module 'react-native-svg' {
  import type React from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  interface CommonProps {
    id?: string;
    fill?: string;
    fillOpacity?: number | string;
    fillRule?: 'nonzero' | 'evenodd';
    stroke?: string;
    strokeWidth?: number | string;
    strokeOpacity?: number | string;
    strokeLinecap?: 'butt' | 'square' | 'round';
    strokeLinejoin?: 'miter' | 'round' | 'bevel';
    strokeDasharray?: number | string | readonly number[];
    strokeDashoffset?: number | string;
    x?: number | string;
    y?: number | string;
    opacity?: number | string;
    transform?: string;
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    testID?: string;
  }

  export interface SvgProps extends CommonProps {
    width?: number | string;
    height?: number | string;
    viewBox?: string;
    preserveAspectRatio?: string;
    color?: string;
    title?: string;
  }

  export interface PathProps extends CommonProps {
    d?: string;
  }

  export interface CircleProps extends CommonProps {
    cx?: number | string;
    cy?: number | string;
    r?: number | string;
  }

  export interface LineProps extends CommonProps {
    x1?: number | string;
    y1?: number | string;
    x2?: number | string;
    y2?: number | string;
  }

  export interface TextProps extends CommonProps {
    fontSize?: number | string;
    fontWeight?: string;
    fontFamily?: string;
    textAnchor?: 'start' | 'middle' | 'end';
    alignmentBaseline?: string;
    dx?: number | string;
    dy?: number | string;
  }

  export interface GProps extends CommonProps {
    rotation?: number | string;
    scale?: number | string;
    origin?: string;
    originX?: number | string;
    originY?: number | string;
    translate?: string;
    translateX?: number | string;
    translateY?: number | string;
    onPress?: () => void;
  }

  export interface EllipseProps extends CommonProps {
    cx?: number | string;
    cy?: number | string;
    rx?: number | string;
    ry?: number | string;
    rotation?: number | string;
    origin?: string;
  }

  export interface DefsProps {
    children?: React.ReactNode;
  }

  export interface RadialGradientProps {
    id?: string;
    cx?: number | string;
    cy?: number | string;
    rx?: number | string;
    ry?: number | string;
    fx?: number | string;
    fy?: number | string;
    gradientUnits?: string;
    children?: React.ReactNode;
  }

  export interface StopProps {
    offset?: number | string;
    stopColor?: string;
    stopOpacity?: number | string;
  }

  const Svg: React.FC<SvgProps>;
  const Path: React.FC<PathProps>;
  const Circle: React.FC<CircleProps>;
  const Ellipse: React.FC<EllipseProps>;
  const Line: React.FC<LineProps>;
  const Text: React.FC<TextProps>;
  const G: React.FC<GProps>;
  const Defs: React.FC<DefsProps>;
  const RadialGradient: React.FC<RadialGradientProps>;
  const Stop: React.FC<StopProps>;

  export { Svg as default, Svg, Path, Circle, Ellipse, Line, Text, G, Defs, RadialGradient, Stop };
}
