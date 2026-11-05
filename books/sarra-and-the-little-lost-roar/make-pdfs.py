"""Typeset clean family reading PDFs, without draft-only scanner links or baked-in story lettering."""
import json
from pathlib import Path
from fontTools.ttLib import TTFont as FontFile
from fontTools.varLib.instancer import instantiateVariableFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader

root=Path(__file__).resolve().parent
repo=root.parent.parent
out=repo/'output/pdf'
work=repo/'tmp/pdfs/sarra'
for directory in [out,work]:directory.mkdir(parents=True,exist_ok=True)
fontpaths=list((repo/'.next/dev/static/media').glob('*.woff2'))
for family,weight in [('Gelasio',500),('Fredoka',700)]:
 found=None
 for file in fontpaths:
  font=FontFile(file)
  if family in (font['name'].getDebugName(1) or '') and all(ord(c) in font.getBestCmap() for c in 'ABCabcéèàùçœ’“”'):
   found=font;break
 if found is None:raise RuntimeError(f'{family} Latin font is missing from Next development assets.')
 if 'fvar' in found:
  axes={axis.axisTag:axis.defaultValue for axis in found['fvar'].axes};axes['wght']=weight
  found=instantiateVariableFont(found,axes,inplace=False)
 found.flavor=None
 destination=work/f'{family}.ttf';found.save(destination)
 pdfmetrics.registerFont(TTFont(family,str(destination)))

pages=json.loads((root/'pages.json').read_text())['pages']
W,H=150*mm,200*mm
ink=HexColor('#2b2118');sound=HexColor('#8a5a35')

def wrap(text,font,size,width):
 words=text.split();lines=[];line=''
 for word in words:
  candidate=f'{line} {word}'.strip()
  if line and pdfmetrics.stringWidth(candidate,font,size)>width:lines.append(line);line=word
  else:line=candidate
 if line:lines.append(line)
 return lines

for locale in ['en','fr']:
 output=out/f'sarra-and-the-little-lost-roar-{locale}.pdf'
 pdf=canvas.Canvas(str(output),pagesize=(W,H),pageCompression=1)
 pdf.setTitle('Sarra and the Little Lost Roar' if locale=='en' else 'Sarra et le petit rugissement')
 pdf.setAuthor('Sketchling')
 for index,page in enumerate(pages):
  image=root/'assets'/('fr-page-01.jpg' if index==0 and locale=='fr' else f'page-{index+1:02}.jpg')
  pdf.drawImage(ImageReader(str(image)),0,0,width=W,height=H)
  if index:
   story=page['story'] if locale=='en' else page['translations']['fr']['story']
   width=W-24*mm
   for size in [18,17,16,15,14]:
    lines=[]
    for raw in story.split('\n'):
     if not raw.strip():lines.append(('',False));continue
     expressive=raw.strip().startswith('*') and raw.strip().endswith('*')
     font='Fredoka' if expressive else 'Gelasio'
     for line in wrap(raw.strip().strip('*'),font,size*1.38 if expressive else size,width):lines.append((line,expressive))
    height=sum(size*(1.5 if expressive else 1.23) if line else size*.3 for line,expressive in lines)
    if height<=47*mm:break
   assert size>=14 and height<=47*mm
   # The top third is deliberately unpainted in all final illustrations.
   baseline=H-16*mm
   for line,expressive in lines:
    if not line:baseline-=size*.3;continue
    pdf.setFont('Fredoka' if expressive else 'Gelasio',size*1.38 if expressive else size)
    pdf.setFillColor(sound if expressive else ink)
    pdf.drawCentredString(W/2,baseline,line)
    baseline-=size*(1.5 if expressive else 1.23)
   assert baseline>H-66*mm
  pdf.showPage()
 pdf.save()
 print(output)
