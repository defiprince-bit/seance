import pathlib,re
d=pathlib.Path(__file__).parent
fonts='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&family=Instrument+Serif:ital@0;1&family=VT323&family=Jolly+Lodger&display=swap" rel="stylesheet">'
head=fonts+'<style>\n'+(d/'tokens.css').read_text()+'\n'+(d/'base.css').read_text()+'\n</style>'
mark=(d/'mark.svg').read_text().strip()
web=(d/'web.svg').read_text().strip()
for n in ['landing','workspace','picker']:
    if not (d/f'{n}.src.html').exists(): continue
    s=(d/f'{n}.src.html').read_text().replace('<!--HEAD-->',head).replace('{{MARK}}',mark).replace('{{WEB}}',web)
    (d.parent/'mocks'/f'{n}.html').write_text(s)
print('built')
