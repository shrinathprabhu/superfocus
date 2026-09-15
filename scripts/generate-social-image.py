"""Generate the editable social card as SVG paths using the bundled Geist font.
Requires fonttools and brotli (asset authoring only, never part of app builds).
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

source = TTFont('public/fonts/geist-sans-v1.7.2.woff2')
fonts = {}
parts = ['''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
  <radialGradient id="glow"><stop stop-color="#574166" stop-opacity=".5"/><stop offset="1" stop-color="#121218" stop-opacity="0"/></radialGradient>
  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d3b6ff"/><stop offset="1" stop-color="#8e66ba"/></linearGradient>
</defs>
<rect width="1200" height="630" fill="#121218"/>
<ellipse cx="975" cy="300" rx="380" ry="355" fill="url(#glow)"/>
<rect x="28" y="28" width="1144" height="574" rx="24" fill="none" stroke="#36303e"/>
<rect x="70" y="66" width="42" height="42" rx="12" fill="#c8a3ff"/>
<path d="M96 73 82 92h10l-2 11 15-20H95z" fill="#271635"/>
<circle cx="932" cy="302" r="170" fill="#1b1722" stroke="#3d324b"/>
<circle cx="932" cy="302" r="145" fill="none" stroke="#2f2739" stroke-width="10"/>
<circle cx="932" cy="302" r="145" fill="none" stroke="url(#ring)" stroke-width="10" stroke-linecap="round" stroke-dasharray="698 912" transform="rotate(-90 932 302)"/>
<circle cx="903" cy="391" r="5" fill="#c8a3ff"/>
<circle cx="923" cy="391" r="5" fill="#c8a3ff"/>
<circle cx="943" cy="391" r="5" fill="#c8a3ff"/>
<circle cx="963" cy="391" r="5" fill="#51415f"/>
<path d="M70 516h1060" stroke="#36303e"/>
''']

def text(value, x, y, size, color='#f3eff8', weight=500, center=False):
    if weight not in fonts:
        font = instantiateVariableFont(source, {'wght': weight}, inplace=False)
        fonts[weight] = (font, font.getGlyphSet(), font.getBestCmap())
    font, glyphs, cmap = fonts[weight]
    scale = size / font['head'].unitsPerEm
    width = sum(glyphs[cmap[ord(c)]].width for c in value) * scale
    if center:
        x -= width / 2
    for char in value:
        glyph = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(pen)
        parts.append(f'<path d="{pen.getCommands()}" transform="translate({x:.3f} {y}) scale({scale} {-scale})" fill="{color}"/>')
        x += glyph.width * scale

text('SuperFocus', 126, 97, 29, weight=650)
text('One thing', 70, 242, 76, weight=600)
text('at a time.', 70, 327, 76, '#c8a3ff', weight=600)
text('Pomodoro. Tasks. Quiet music.', 74, 394, 26, '#c3b9cd')
text('Your focus space, even offline.', 74, 437, 24, '#a89bb5')
text('FOCUS SESSION', 932, 246, 15, '#bca9cb', 500, True)
text('25:00', 932, 326, 66, '#f3eff8', 500, True)
text('A fresh start.', 932, 356, 17, '#b7a8c3', 450, True)
text('by @shrinath_prabhu', 70, 561, 21, '#c3b9cd')
parts.append('</svg>')
Path('scripts/social-card.svg').write_text('\n'.join(parts))
print('Generated scripts/social-card.svg with Geist outlines.')
