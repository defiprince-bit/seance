# Background removal for generated 3D props: fit a smooth bg field from the borders, key it out, flood from edges.
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, sys
def cut(src,dst,lo,hi,maxw):
    raw=np.asarray(Image.open(src).convert('RGB')).astype(float)
    a=np.asarray(Image.open(src).convert('RGB').filter(ImageFilter.GaussianBlur(1))).astype(float)
    h,w,_=a.shape; yy,xx=np.mgrid[0:h,0:w]; X=xx/w-.5; Y=yy/h-.5
    B=30; border=np.zeros((h,w),bool); border[:B]=1;border[-B:]=1;border[:,:B]=1;border[:,-B:]=1
    F=np.stack([np.ones_like(X),X,Y,X*X,Y*Y,X*Y,X*X*Y*Y],-1); field=np.zeros_like(a)
    for c in range(3):
        coef,*_=np.linalg.lstsq(F[border],a[...,c][border],rcond=None); field[...,c]=F@coef
    d=np.sqrt(((a-field)**2).sum(2))
    alpha=np.clip((d-lo)/(hi-lo),0,1)
    m=Image.fromarray(((d<hi)*255).astype('uint8')).copy()
    for p in [(0,0),(w-1,0),(0,h-1),(w-1,h-1),(w//2,0),(0,h//2),(w-1,h//2),(w//2,h-1)]:
        if m.getpixel(p)==255: ImageDraw.floodfill(m,p,128)
    reach=np.asarray(m)==128
    alpha=np.where(reach,alpha,1.0)
    alpha=np.asarray(Image.fromarray((alpha*255).astype('uint8')).filter(ImageFilter.GaussianBlur(1))).astype(float)/255
    al=alpha[...,None]
    rgb=np.where(al>0.05,(raw-field*(1-al))/np.maximum(al,0.05),raw)
    o=Image.fromarray(np.dstack([np.clip(rgb,0,255),alpha*255]).astype('uint8'),'RGBA')
    bb=Image.fromarray(((alpha>0.04)*255).astype('uint8')).getbbox(); o=o.crop(bb)
    if o.width>maxw: o=o.resize((maxw,round(o.height*maxw/o.width)),Image.LANCZOS)
    o.save(dst,optimize=True); print(dst,o.size,bb, 'transparent %.0f%%'%(100*(alpha<.05).mean()))
    for col in [(60,140,200)]:
        bg=Image.new('RGBA',o.size,col+(255,)); bg.alpha_composite(o); bg.convert('RGB').save('/tmp/chk-'+dst.replace('.png','.jpg'))
cut('src-hero-terminal.jpg','hero-terminal.png',6,22,820)
cut('src-prop-hat-floppy.jpg','prop-hat-floppy.png',8,24,480)
cut('src-prop-candle-cards.jpg','prop-candle-cards.png',8,24,480)
