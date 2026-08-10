#!/usr/bin/env python3
"""
Extiende la plantilla de contrato DOCX para soportar hasta 6 dependientes.
Clona la fila del dependiente 2 y renombra los placeholders a 3,4,5,6.
"""
import zipfile
import re
import shutil

SRC = 'public/plantillas/plantilla contrato.docx'
TMP = 'public/plantillas/_plantilla_contrato_tmp.docx'

shutil.copy(SRC, TMP)

# Leer todos los items del zip original
zin = zipfile.ZipFile(TMP, 'r')
items = zin.namelist()
xml = zin.read('word/document.xml').decode('utf-8')
original_items = {item: zin.read(item) for item in items if item != 'word/document.xml'}
zin.close()

# Encontrar la fila del dependiente 2 (contiene NOMBRE_DEPENDIENTE_2)
trs = re.findall(r'<w:tr[ >].*?</w:tr>', xml, re.DOTALL)
fila2 = None
for tr in trs:
    if 'NOMBRE_DEPENDIENTE_2' in tr:
        fila2 = tr
        break

if not fila2:
    print('ERROR: No se encontró la fila de dependiente 2')
    exit(1)

# Clonar para dependientes 3..6 renumerando placeholders y paraIds
nuevas_filas = []
for n in range(3, 7):
    fila = fila2
    fila = re.sub(r'(_DEPENDIENTE_)\d+', lambda m: f'{m.group(1)}{n}', fila)
    fila = re.sub(r'w14:paraId="[0-9A-F]+"', lambda m: f'w14:paraId="{n:X}D{n:X}DD"', fila)
    nuevas_filas.append(fila)

# Insertar las filas clonadas justo después de la fila original del dependiente 2
xml_nuevo = xml.replace(fila2, fila2 + ''.join(nuevas_filas), 1)

if xml_nuevo == xml:
    print('ERROR: No se pudo insertar las filas')
    exit(1)

# Escribir el nuevo DOCX
zout = zipfile.ZipFile(TMP, 'w', zipfile.ZIP_DEFLATED)
for item in items:
    if item == 'word/document.xml':
        zout.writestr(item, xml_nuevo)
    else:
        zout.writestr(item, original_items[item])
zout.close()

# Reemplazar el original
shutil.move(TMP, SRC)
print('OK: Plantilla actualizada con 6 dependientes')
