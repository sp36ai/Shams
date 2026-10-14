#!/usr/bin/env python3
"""
Shams al-Asrār — Home hero mandala generator
============================================================================
Builds the Home hero's embossed-gold mandala (an eight-pointed filigree star
around a sunken medallion holding an amber crescent) as an SVG, then renders
it to the transparent PNG the app ships:

    assets/images/home-mandala.svg   source of truth (edit this script, not the SVG)
    assets/images/home-mandala.png   960 x 960, transparent, used by MandalaEmblem

Colour variants (same geometry, different metal and medallion) for the
premium themes, written alongside as home-mandala-<variant>.svg / .png:

    gold     the default artwork (Midnight Celestial and every colour theme)
    silver   moonlit silver filigree, indigo well, pearl crescent
    emerald  gold filigree, emerald well, gold crescent

The relief comes from SVG lighting filters (feDiffuseLighting /
feSpecularLighting) over a gold gradient with the filigree cut out by a mask.
react-native-svg does not implement those filters, which is why the app shows
a pre-rendered image instead of drawing the SVG live.

Original artwork drawn from geometry in this file; nothing is traced or copied.

Requires: Pillow (`pip install Pillow`) and a Chromium/Chrome binary for the
PNG step (set CHROME=/path/to/chrome if it is not on PATH as chromium /
google-chrome).

Usage:
    python3 scripts/generate-home-mandala.py [gold|silver|emerald ...]   (default: gold)
"""
import math, os, shutil, subprocess, sys, tempfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, 'assets', 'images')

# Colour keys per variant. 'gold' reproduces the original artwork exactly.
VARIANTS = {
    'gold': dict(
        metal=('#EFD49A', '#B98C48', '#7E5527', '#C79C58', '#5A3A18'), spec='#FFF4D6',
        aura=('#E9B96A', '#C5A36A'), spark='#F2D9A0',
        well=('#16314A', '#0A1A2A', '#030A12'), moonGlow=('#FFC976', '#E39A45'),
        moon=('#FFF0C8', '#F7C979', '#D98C3A'), star='#FFE7B0'),
    'silver': dict(
        metal=('#F4F7FC', '#B4BECD', '#5D6879', '#C9D2DF', '#343C4A'), spec='#FFFFFF',
        aura=('#AFC3E6', '#C9D3E3'), spark='#E6EEFA',
        well=('#1C2A4A', '#0D1528', '#04070F'), moonGlow=('#DCE8FF', '#8FA6D6'),
        moon=('#FFFFFF', '#E3EAF5', '#A7B4CC'), star='#F4F8FF'),
    'emerald': dict(
        metal=('#F3DA9C', '#C49A4E', '#80592A', '#D2A963', '#5C3D18'), spec='#FFF6DC',
        aura=('#5FBF92', '#D4AF5A'), spark='#F3DC9A',
        well=('#145A43', '#0A3326', '#03140E'), moonGlow=('#FFE09A', '#C99A3E'),
        moon=('#FFF4D2', '#F0CF80', '#C9952F'), star='#FFEAB4'),
}

def outputs(variant):
    stem = 'home-mandala' if variant == 'gold' else f'home-mandala-{variant}'
    return os.path.join(IMAGES, stem + '.svg'), os.path.join(IMAGES, stem + '.png')
PNG_SIZE = 960

C = 500
def P(x, y): return f"{x:.1f},{y:.1f}"
def polar(r, deg):
    a = math.radians(deg - 90); return C + r*math.cos(a), C + r*math.sin(a)

# ---------- shapes defined pointing UP (tip toward y=0), mirrored for symmetry
def lobe(tip, base_r, half_w, shoulder):
    # ogee arch: base at y=C-base_r, tip at y=C-tip
    by = C - base_r; ty = C - tip
    sy = by - (base_r and (tip-base_r)*shoulder)
    return (f"M{P(C-half_w, by+40)} L{P(C-half_w, by)} "
            f"C{P(C-half_w, sy)} {P(C-half_w*0.15, ty+ (tip-base_r)*0.35)} {P(C, ty)} "
            f"C{P(C+half_w*0.15, ty+(tip-base_r)*0.35)} {P(C+half_w, sy)} {P(C+half_w, by)} "
            f"L{P(C+half_w, by+40)} Z")

def rot(deg): return f'transform="rotate({deg} {C} {C})"'

silhouette = []
for k in range(8):
    silhouette.append(f'<path d="{lobe(468, 250, 128, 0.55)}" {rot(k*45)}/>')
for k in range(8):
    silhouette.append(f'<path d="{lobe(392, 240, 78, 0.5)}" {rot(k*45+22.5)}/>')
silhouette.append(f'<circle cx="{C}" cy="{C}" r="300"/>')

# ---------- engraving (cut into the gold): drawn black in the mask
eng = []
def half_motif():
    s = []
    # inner outline of the big lobe (left half)
    s.append(f'<path d="M{P(C-96,C-262)} C{P(C-96,C-330)} {P(C-14,C-372)} {P(C,C-430)}" />')
    # stem
    s.append(f'<path d="M{P(C,C-424)} L{P(C,C-300)}" />')
    # scroll curls
    s.append(f'<path d="M{P(C-4,C-395)} C{P(C-40,C-392)} {P(C-62,C-360)} {P(C-48,C-338)} C{P(C-36,C-320)} {P(C-14,C-332)} {P(C-22,C-350)}" />')
    s.append(f'<path d="M{P(C-4,C-330)} C{P(C-50,C-330)} {P(C-82,C-298)} {P(C-70,C-276)} C{P(C-58,C-256)} {P(C-32,C-266)} {P(C-40,C-286)}" />')
    # teardrop
    s.append(f'<path d="M{P(C-76,C-318)} C{P(C-90,C-340)} {P(C-84,C-362)} {P(C-70,C-372)} C{P(C-62,C-352)} {P(C-62,C-334)} {P(C-76,C-318)} Z" />')
    s.append(f'<path d="M{P(C-70,C-262)} C{P(C-70,C-300)} {P(C-30,C-340)} {P(C-6,C-378)}" />')
    s.append(f'<path d="M{P(C-4,C-418)} C{P(C-22,C-418)} {P(C-30,C-402)} {P(C-20,C-394)}" />')
    s.append(f'<circle cx="{C-30:.1f}" cy="{C-262:.1f}" r="6" fill="black" stroke="none"/>')
    return s
for k in range(8):
    g = "".join(half_motif())
    eng.append(f'<g {rot(k*45)}>{g}<g transform="matrix(-1 0 0 1 {2*C} 0)">{g}</g></g>')
for k in range(8):
    sm = (f'<path d="M{P(C-56,C-252)} C{P(C-56,C-300)} {P(C-10,C-326)} {P(C,C-366)}" />'
          f'<path d="M{P(C,C-360)} L{P(C,C-270)}" />'
          f'<path d="M{P(C-4,C-318)} C{P(C-34,C-314)} {P(C-44,C-290)} {P(C-30,C-276)} C{P(C-20,C-266)} {P(C-8,C-276)} {P(C-14,C-288)}" />')
    eng.append(f'<g {rot(k*45+22.5)}>{sm}<g transform="matrix(-1 0 0 1 {2*C} 0)">{sm}</g></g>')
# rings and band lattice
for r in (300, 262, 214, 168):
    eng.append(f'<circle cx="{C}" cy="{C}" r="{r}" />')
for i in range(32):
    a = i*11.25
    p0 = polar(266,a); p1 = polar(266,a+11.25); k = polar(292,a+5.625)
    eng.append(f'<path d="M{P(*p0)} Q{P(*k)} {P(*p1)}" stroke-width="4"/>')
    bx,by = polar(282,a+5.625)
    eng.append(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="3.2" fill="black" stroke="none"/>')
# 16-petal rosette between 168 and 214
for i in range(16):
    a = i*22.5
    b1 = polar(170, a-11.25); b2 = polar(170, a+11.25); t = polar(212, a)
    k1 = polar(205, a-9); k2 = polar(205, a+9)
    eng.append(f'<path d="M{P(*b1)} Q{P(*k1)} {P(*t)} Q{P(*k2)} {P(*b2)}" />')
    dx,dy = polar(190, a)
    eng.append(f'<circle cx="{dx:.1f}" cy="{dy:.1f}" r="4" fill="black" stroke="none"/>')
# pierced holes in the band
for i in range(16):
    x,y = polar(238, i*22.5+11.25)
    eng.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="black" stroke="none"/>')

# ---------- sparkles
def star4(cx, cy, r):
    w = r*0.22
    return (f"M{P(cx,cy-r)} Q{P(cx+w,cy-w)} {P(cx+r,cy)} Q{P(cx+w,cy+w)} {P(cx,cy+r)} "
            f"Q{P(cx-w,cy+w)} {P(cx-r,cy)} Q{P(cx-w,cy-w)} {P(cx,cy-r)} Z")
sparks = []
for k in range(8):
    x,y = polar(452, k*45+22.5); sparks.append(f'<path d="{star4(x,y,15)}"/>')
    x,y = polar(400, k*45+11); sparks.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.2"/>')
    x,y = polar(400, k*45+34); sparks.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.2"/>')

# ---------- crescent
def crescent(cx, cy, r):
    ix, iy, ir = cx + r*0.40, cy - r*0.16, r*0.84
    dx, dy = ix-cx, iy-cy; d = math.hypot(dx,dy)
    a = (r*r - ir*ir + d*d)/(2*d); h = math.sqrt(r*r - a*a)
    mx, my = cx + a*dx/d, cy + a*dy/d
    p1 = (mx + h*dy/d, my - h*dx/d); p2 = (mx - h*dy/d, my + h*dx/d)
    return f"M{P(*p1)} A{r},{r} 0 1 0 {P(*p2)} A{ir:.1f},{ir:.1f} 0 1 1 {P(*p1)} Z"

def build_svg(v):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{v['metal'][0]}"/><stop offset="0.25" stop-color="{v['metal'][1]}"/>
    <stop offset="0.5" stop-color="{v['metal'][2]}"/><stop offset="0.75" stop-color="{v['metal'][3]}"/>
    <stop offset="1" stop-color="{v['metal'][4]}"/>
  </linearGradient>
  <mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
    <g fill="white">{''.join(silhouette)}</g>
    <g fill="none" stroke="black" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">{''.join(eng)}</g>
    <circle cx="{C}" cy="{C}" r="150" fill="black"/>
  </mask>
  <filter id="emboss" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="b"/>
    <feSpecularLighting in="b" surfaceScale="6" specularConstant="1.05" specularExponent="30" lighting-color="{v['spec']}" result="s">
      <fePointLight x="260" y="120" z="520"/></feSpecularLighting>
    <feComposite in="s" in2="SourceAlpha" operator="in" result="si"/>
    <feDiffuseLighting in="b" surfaceScale="6" diffuseConstant="1.05" lighting-color="#FFFFFF" result="d">
      <feDistantLight azimuth="235" elevation="52"/></feDiffuseLighting>
    <feComposite in="d" in2="SourceAlpha" operator="in" result="di"/>
    <feBlend in="SourceGraphic" in2="di" mode="multiply" result="sh"/>
    <feComposite in="si" in2="sh" operator="arithmetic" k1="0" k2="0.85" k3="1" k4="0" result="lit"/>
    <feDropShadow in="lit" dx="0" dy="6" stdDeviation="7" flood-color="#000" flood-opacity="0.65"/>
  </filter>
  <radialGradient id="aura" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="{v['aura'][0]}" stop-opacity="0.28"/><stop offset="0.55" stop-color="{v['aura'][1]}" stop-opacity="0.08"/>
    <stop offset="1" stop-color="{v['aura'][1]}" stop-opacity="0"/></radialGradient>
  <radialGradient id="well" cx="0.5" cy="0.42" r="0.6">
    <stop offset="0" stop-color="{v['well'][0]}"/><stop offset="0.6" stop-color="{v['well'][1]}"/><stop offset="1" stop-color="{v['well'][2]}"/></radialGradient>
  <radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="{v['moonGlow'][0]}" stop-opacity="0.75"/><stop offset="0.5" stop-color="{v['moonGlow'][1]}" stop-opacity="0.22"/>
    <stop offset="1" stop-color="{v['moonGlow'][1]}" stop-opacity="0"/></radialGradient>
  <linearGradient id="moon" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{v['moon'][0]}"/><stop offset="0.5" stop-color="{v['moon'][1]}"/><stop offset="1" stop-color="{v['moon'][2]}"/></linearGradient>
  <filter id="inner" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="b"/>
    <feOffset dy="10" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out" result="ring"/>
    <feFlood flood-color="#000" flood-opacity="0.85"/><feComposite in2="ring" operator="in" result="sh"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sh"/></feMerge></filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="5" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<circle cx="{C}" cy="{C}" r="500" fill="url(#aura)"/>
<g fill="{v['spark']}" filter="url(#glow)">{''.join(sparks)}</g>
<g filter="url(#emboss)">
  <rect x="0" y="0" width="1000" height="1000" fill="url(#gold)" mask="url(#cut)"/>
  <circle cx="{C}" cy="{C}" r="150" fill="none" stroke="url(#gold)" stroke-width="16"/>
</g>
<circle cx="{C}" cy="{C}" r="142" fill="url(#well)" filter="url(#inner)"/>
<circle cx="{C-8}" cy="{C+2}" r="120" fill="url(#moonGlow)"/>
<path d="{crescent(C-12, C+4, 66)}" fill="url(#moon)" filter="url(#glow)"/>
<path d="{star4(C+52, C-30, 15)}" fill="{v['star']}" filter="url(#glow)"/>
<circle cx="{C+70}" cy="{C+40}" r="2.6" fill="{v['star']}"/><circle cx="{C-60}" cy="{C-70}" r="2" fill="{v['star']}"/>
</svg>'''

chrome = os.environ.get('CHROME') or next(
    (p for p in (shutil.which(n) for n in ('chromium', 'chromium-browser', 'google-chrome')) if p),
    None,
)
if chrome is None:
    sys.exit('No Chromium found: set CHROME=/path/to/chrome to render the PNG.')

def render(svg, out_png):
    html = ('<html><body style="margin:0;background:transparent">'
            + svg.replace('width="1000" height="1000"', f'width="{PNG_SIZE}" height="{PNG_SIZE}"', 1)
            + '</body></html>')
    with tempfile.TemporaryDirectory() as tmp:
        page = os.path.join(tmp, 'm.html')
        with open(page, 'w') as fh:
            fh.write(html)
        shot = os.path.join(tmp, 'shot.png')
        # Headless Chromium's capture is shorter than --window-size by its
        # (invisible) browser chrome, so capture a taller window and crop.
        subprocess.run([chrome, '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                        '--default-background-color=00000000', f'--window-size={PNG_SIZE},{PNG_SIZE + 200}',
                        f'--screenshot={shot}', 'file://' + page], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        Image.open(shot).crop((0, 0, PNG_SIZE, PNG_SIZE)).save(out_png, optimize=True)
    print(f'wrote {out_png}')


for name in (sys.argv[1:] or ['gold']):
    if name not in VARIANTS:
        sys.exit(f'Unknown variant {name!r}; choose from {", ".join(VARIANTS)}.')
    out_svg, out_png = outputs(name)
    svg = build_svg(VARIANTS[name])
    with open(out_svg, 'w') as fh:
        fh.write(svg)
    print(f'wrote {out_svg}')
    render(svg, out_png)
