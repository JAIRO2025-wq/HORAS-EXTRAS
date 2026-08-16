/*
 * plain-placeholder.js
 * --------------------
 * Fork local de @signpdf/placeholder-plain (+ placeholder-pdfkit010), MIT,
 * con dos correcciones que Adobe necesita para dar el visto bueno:
 *
 * 1) ENCODING 'binary':
 *    El original serializa los objetos con `Buffer.from(string)` (UTF-8).
 *    Eso corrompe cualquier string con acentos del diccionario de firma
 *    (Reason/Location/ContactInfo): el BOM UTF-16 `FE FF` se escribe como
 *    `C3 BE C3 BF` y Adobe muestra "Razón: A³A̅". Con `'binary'` los bytes
 *    se escriben tal cual y Adobe decodifica el UTF-16BE correctamente.
 *
 * 2) /AP en el widget:
 *    El widget de firma se crea sin apariencia (/AP). Adobe genera la
 *    apariencia en memoria y eso lo percibe como "documento modificado" y
 *    "anotaciones eliminadas (Widget)". Agregamos un Form XObject mínimo
 *    (invisible, igual que el widget) como /AP /N.
 *
 * Uso: import { plainAddPlaceholder } from './plain-placeholder'
 */
'use strict';

const {
  PDFObject,
  PDFKitReferenceMock,
  SignPdfError,
  removeTrailingNewLine,
  DEFAULT_SIGNATURE_LENGTH,
  DEFAULT_BYTE_RANGE_PLACEHOLDER,
  SUBFILTER_ADOBE_PKCS7_DETACHED,
  SIG_FLAGS,
  ANNOTATION_FLAGS,
} = require('@signpdf/utils');

const toBuffer = (str) => Buffer.from(str, 'binary');

/* ---------------- helpers de parseo (de @signpdf/placeholder-plain) ---------------- */

function getLastTrailerPosition(pdf) {
  const trailerStart = pdf.lastIndexOf(Buffer.from('trailer', 'utf8'));
  const trailer = pdf.slice(trailerStart, pdf.length - 6);
  const xRefPosition = trailer.slice(trailer.lastIndexOf(Buffer.from('startxref', 'utf8')) + 10).toString();
  return parseInt(xRefPosition, 10);
}

function getXref(pdf, position) {
  let refTable = pdf.slice(position);
  const realPosition = refTable.indexOf(Buffer.from('xref', 'utf8'));
  if (realPosition === -1) {
    throw new SignPdfError(`Could not find xref anywhere at or after ${position}.`, SignPdfError.TYPE_PARSE);
  }
  if (realPosition > 0) {
    const prefix = refTable.slice(0, realPosition);
    if (prefix.toString().replace(/\s*/g, '') !== '') {
      throw new SignPdfError(`Expected xref at ${position} but found other content.`, SignPdfError.TYPE_PARSE);
    }
  }
  const nextEofPosition = refTable.indexOf(Buffer.from('%%EOF', 'utf8'));
  if (nextEofPosition === -1) {
    throw new SignPdfError('Expected EOF after xref and trailer but could not find one.', SignPdfError.TYPE_PARSE);
  }
  refTable = refTable.slice(0, nextEofPosition);
  refTable = refTable.slice(realPosition + 4);
  refTable = refTable.slice(refTable.indexOf('\n') + 1);

  let size = refTable.toString().split('/Size')[1];
  if (!size) {
    throw new SignPdfError('Size not found in xref table.', SignPdfError.TYPE_PARSE);
  }
  size = /^\s*(\d+)/.exec(size);
  if (size === null) {
    throw new SignPdfError('Failed to parse size of xref table.', SignPdfError.TYPE_PARSE);
  }
  size = parseInt(size[1], 10);
  const [objects, infos] = refTable.toString().split('trailer');
  const isContainingPrev = infos.split('/Prev')[1] != null;
  let prev;
  if (isContainingPrev) {
    const prevRe = /Prev (\d+)/g;
    const match = prevRe.exec(infos);
    const [, prevPosition] = match;
    prev = prevPosition;
  }
  const xRefContent = xrefToRefMap(objects);
  return { size, prev, xRefContent };
}

function getFullXref(pdf, xRefPosition) {
  const lastXrefTable = getXref(pdf, xRefPosition);
  if (lastXrefTable.prev === undefined) {
    return lastXrefTable.xRefContent;
  }
  const partOfXrefTable = getFullXref(pdf, lastXrefTable.prev);
  return new Map([...partOfXrefTable, ...lastXrefTable.xRefContent]);
}

function getFullXrefTable(pdf) {
  const lastTrailerPosition = getLastTrailerPosition(pdf);
  return getFullXref(pdf, lastTrailerPosition);
}

function xrefToRefMap(xrefString) {
  const lines = xrefString.split('\n').filter((l) => l !== '');
  let index = 0;
  let expectedLines = 0;
  const xref = new Map();
  lines.forEach((line) => {
    const split = line.split(' ');
    if (split.length === 2) {
      index = parseInt(split[0], 10);
      expectedLines = parseInt(split[1], 10);
      return;
    }
    if (expectedLines <= 0) {
      throw new SignPdfError('Too many lines in xref table.', SignPdfError.TYPE_PARSE);
    }
    expectedLines -= 1;
    const [offset, , inUse] = split;
    if (inUse.trim() === 'f') {
      index += 1;
      return;
    }
    if (inUse.trim() !== 'n') {
      throw new SignPdfError(`Unknown in-use flag "${inUse}". Expected "n" or "f".`, SignPdfError.TYPE_PARSE);
    }
    if (!/^\d+$/.test(offset.trim())) {
      throw new SignPdfError(`Expected integer offset. Got "${offset}".`, SignPdfError.TYPE_PARSE);
    }
    xref.set(index, parseInt(offset.trim(), 10));
    index += 1;
  });
  return xref;
}

function readRefTable(pdf) {
  const fullXrefTable = getFullXrefTable(pdf);
  const startingIndex = 0;
  const maxIndex = Math.max(...fullXrefTable.keys());
  return { startingIndex, maxIndex, offsets: fullXrefTable };
}

function getIndexFromRef(refTable, ref) {
  let [index] = ref.split(' ');
  index = parseInt(index, 10);
  if (!refTable.offsets.has(index)) {
    throw new SignPdfError(`Failed to locate object "${ref}".`, SignPdfError.TYPE_PARSE);
  }
  return index;
}

function getPagesDictionaryRef(info) {
  const pagesRefRegex = /\/Pages\s+(\d+\s+\d+\s+R)/g;
  const match = pagesRefRegex.exec(info.root);
  if (match === null) {
    throw new SignPdfError(
      'Failed to find the pages descriptor. This is probably a problem in node-signpdf.',
      SignPdfError.TYPE_PARSE
    );
  }
  return match[1];
}

function findObject(pdf, refTable, ref) {
  const index = getIndexFromRef(refTable, ref);
  const offset = refTable.offsets.get(index);
  let slice = pdf.slice(offset);
  slice = slice.slice(0, slice.indexOf('endobj', 'utf8'));
  slice = slice.slice(slice.indexOf('<<', 'utf8') + 2);
  slice = slice.slice(0, slice.lastIndexOf('>>', 'utf8'));
  return slice;
}

function getPageRef(pdfBuffer, info) {
  const pagesRef = getPagesDictionaryRef(info);
  const pagesDictionary = findObject(pdfBuffer, info.xref, pagesRef);
  const kidsPosition = pagesDictionary.indexOf('/Kids');
  const kidsStart = pagesDictionary.indexOf('[', kidsPosition) + 1;
  const kidsEnd = pagesDictionary.indexOf(']', kidsPosition);
  const pages = pagesDictionary.slice(kidsStart, kidsEnd).toString();
  const split = pages.trim().split(' ', 3);
  return `${split[0]} ${split[1]} ${split[2]}`;
}

function getValue(trailer, key) {
  let index = trailer.indexOf(key);
  if (index === -1) {
    return undefined;
  }
  const slice = trailer.slice(index);
  index = slice.indexOf('/', 1);
  if (index === -1) {
    index = slice.indexOf('>', 1);
  }
  return slice.slice(key.length + 1, index).toString().trim();
}

function readPdf(pdfBuffer) {
  const trailerStart = pdfBuffer.lastIndexOf('trailer');
  const trailer = pdfBuffer.slice(trailerStart, pdfBuffer.length - 6);
  let xRefPosition = trailer.slice(trailer.lastIndexOf('startxref') + 10).toString();
  xRefPosition = parseInt(xRefPosition, 10);
  const refTable = readRefTable(pdfBuffer);
  const rootRef = getValue(trailer, '/Root');
  const root = findObject(pdfBuffer, refTable, rootRef).toString();
  const infoRef = getValue(trailer, '/Info');
  return {
    xref: refTable,
    rootRef,
    root,
    infoRef,
    trailerStart,
    previousXrefs: [],
    xRefPosition,
  };
}

/* ---------------- helpers de escritura (de @signpdf/placeholder-plain) ---------------- */

function createBufferTrailer(pdf, info, addedReferences) {
  let rows = [];
  rows[0] = '0000000000 65535 f ';
  addedReferences.forEach((offset, index) => {
    const paddedOffset = `0000000000${offset}`.slice(-10);
    rows[index + 1] = `${index} 1\n${paddedOffset} 00000 n `;
  });
  rows = rows.filter((row) => row !== undefined);
  return Buffer.concat([
    Buffer.from('xref\n'),
    Buffer.from(`${info.xref.startingIndex} 1\n`),
    Buffer.from(rows.join('\n')),
    Buffer.from('\ntrailer\n'),
    Buffer.from('<<\n'),
    Buffer.from(`/Size ${info.xref.maxIndex + 1}\n`),
    Buffer.from(`/Root ${info.rootRef}\n`),
    Buffer.from(info.infoRef ? `/Info ${info.infoRef}\n` : ''),
    Buffer.from(`/Prev ${info.xRefPosition}\n`),
    Buffer.from('>>\n'),
    Buffer.from('startxref\n'),
    Buffer.from(`${pdf.length}\n`),
    Buffer.from('%%EOF'),
  ]);
}

function createBufferRootWithAcroform(pdf, info, form) {
  const rootIndex = getIndexFromRef(info.xref, info.rootRef);
  return Buffer.concat([
    toBuffer(`${rootIndex} 0 obj\n`),
    toBuffer('<<\n'),
    toBuffer(`${info.root}\n`),
    toBuffer(`/AcroForm ${form}`),
    toBuffer('\n>>\nendobj\n'),
  ]);
}

function createBufferPageWithAnnotation(pdf, info, pagesRef, widget) {
  const pagesDictionary = findObject(pdf, info.xref, pagesRef).toString();
  let annotsStart;
  let annotsEnd;
  let annots;
  annotsStart = pagesDictionary.indexOf('/Annots');
  if (annotsStart > -1) {
    annotsEnd = pagesDictionary.indexOf(']', annotsStart);
    annots = pagesDictionary.substr(annotsStart, annotsEnd + 1 - annotsStart);
    annots = annots.substr(0, annots.length - 1);
  } else {
    annotsStart = pagesDictionary.length;
    annotsEnd = pagesDictionary.length;
    annots = '/Annots [';
  }
  const pagesDictionaryIndex = getIndexFromRef(info.xref, pagesRef);
  const widgetValue = widget.toString();
  annots = `${annots} ${widgetValue}]`;

  const preAnnots = pagesDictionary.substr(0, annotsStart);
  let postAnnots = '';
  if (pagesDictionary.length > annotsEnd) {
    postAnnots = pagesDictionary.substr(annotsEnd + 1);
  }
  return Buffer.concat([
    toBuffer(`${pagesDictionaryIndex} 0 obj\n`),
    toBuffer('<<\n'),
    toBuffer(`${preAnnots + annots + postAnnots}\n`),
    toBuffer('\n>>\nendobj\n'),
  ]);
}

/* ---------------- placeholder de firma (fork con /AP) ---------------- */

function pdfkitAddPlaceholder({
  pdf,
  pdfBuffer,
  reason,
  contactInfo,
  name,
  location,
  signingTime = undefined,
  signatureLength = DEFAULT_SIGNATURE_LENGTH,
  byteRangePlaceholder = DEFAULT_BYTE_RANGE_PLACEHOLDER,
  subFilter = SUBFILTER_ADOBE_PKCS7_DETACHED,
  widgetRect = [0, 0, 0, 0],
  appName = undefined,
}) {
  // eslint-disable-next-line no-underscore-dangle,no-param-reassign
  const signature = pdf.ref({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: subFilter,
    ByteRange: [0, byteRangePlaceholder, byteRangePlaceholder, byteRangePlaceholder],
    Contents: Buffer.from(String.fromCharCode(0).repeat(signatureLength)),
    Reason: new String(reason),
    M: signingTime !== null && signingTime !== undefined ? signingTime : new Date(),
    ContactInfo: new String(contactInfo),
    Name: new String(name),
    Location: new String(location),
    Prop_Build: {
      Filter: { Name: 'Adobe.PPKLite' },
      ...(appName ? { App: { Name: appName } } : {}),
    },
  });

  const isAcroFormExists = typeof pdf._root.data.AcroForm !== 'undefined';
  let fieldIds = [];
  let acroFormId;
  if (isAcroFormExists) {
    const acroFormPosition = pdfBuffer.lastIndexOf('/Type /AcroForm');
    let acroFormStart = acroFormPosition;
    const charsUntilIdEnd = 10;
    const acroFormIdEnd = acroFormPosition - charsUntilIdEnd;
    const maxAcroFormIdLength = 12;
    let index = charsUntilIdEnd + 1;
    for (index; index < charsUntilIdEnd + maxAcroFormIdLength; index += 1) {
      const acroFormIdString = pdfBuffer.slice(acroFormPosition - index, acroFormIdEnd).toString();
      if (acroFormIdString[0] === '\n') {
        break;
      }
      acroFormStart = acroFormPosition - index;
    }
    const pdfSlice = pdfBuffer.slice(acroFormStart);
    const acroForm = pdfSlice.slice(0, pdfSlice.indexOf('endobj')).toString();
    acroFormId = parseInt(pdf._root.data.AcroForm.toString(), 10);
    const acroFormFields = acroForm.slice(acroForm.indexOf('/Fields [') + 9, acroForm.indexOf(']'));
    fieldIds = acroFormFields
      .split(' ')
      .filter(Boolean)
      .filter((element, i) => i % 3 === 0)
      .map((fieldId) => new PDFKitReferenceMock(fieldId));
  }
  const signatureName = 'Signature';

  // APARIENCIA (nuevo vs @signpdf): Form XObject mínimo e invisible. Evita que
  // Adobe genere la apariencia en memoria y marque "documento modificado".
  const appearance = pdf.ref({
    Type: 'XObject',
    Subtype: 'Form',
    FormType: 1,
    BBox: [0, 0, 1, 1],
    Resources: {},
    Length: 3,
    stream: 'q Q',
  });

  // Widget de firma (invisible, Rect [0,0,0,0]) con /AP referenciado.
  const widget = pdf.ref({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: widgetRect,
    V: signature,
    T: new String(signatureName + (fieldIds.length + 1)),
    F: ANNOTATION_FLAGS.PRINT,
    P: pdf.page.dictionary,
    AP: { N: appearance },
  });

  pdf.page.dictionary.data.Annots = [widget];
  let form;
  if (!isAcroFormExists) {
    form = pdf.ref({
      Type: 'AcroForm',
      SigFlags: SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY,
      Fields: [...fieldIds, widget],
    });
  } else {
    form = pdf.ref(
      {
        Type: 'AcroForm',
        SigFlags: SIG_FLAGS.SIGNATURES_EXIST | SIG_FLAGS.APPEND_ONLY,
        Fields: [...fieldIds, widget],
      },
      acroFormId
    );
  }
  pdf._root.data.AcroForm = form;
  return { signature, form, widget };
}

function getAcroFormRef(slice) {
  const bufferRootWithAcroformRefRegex = /\/AcroForm\s+(\d+\s\d+\sR)/g;
  const match = bufferRootWithAcroformRefRegex.exec(slice);
  if (match != null && match[1] != null && match[1] !== '') {
    return match[1];
  }
  return undefined;
}

/**
 * Agrega el placeholder de firma (diccionario /Sig + widget con /AP) a un PDF.
 * @param {object} parameters
 * @param {Buffer} parameters.pdfBuffer
 * @param {string} [parameters.reason]
 * @param {string} [parameters.contactInfo]
 * @param {string} [parameters.name]
 * @param {string} [parameters.location]
 * @param {Date} [parameters.signingTime]
 * @param {number} [parameters.signatureLength]
 * @param {string} [parameters.subFilter]
 * @param {number[]} [parameters.widgetRect]
 * @param {string} [parameters.appName]
 */
function plainAddPlaceholder({
  pdfBuffer,
  reason,
  contactInfo,
  name,
  location,
  signingTime = undefined,
  signatureLength = DEFAULT_SIGNATURE_LENGTH,
  subFilter = SUBFILTER_ADOBE_PKCS7_DETACHED,
  widgetRect = [0, 0, 0, 0],
  appName = undefined,
}) {
  let pdf = removeTrailingNewLine(pdfBuffer);
  const info = readPdf(pdf);
  const pageRef = getPageRef(pdf, info);
  const pageIndex = getIndexFromRef(info.xref, pageRef);
  const addedReferences = new Map();
  const pdfKitMock = {
    ref: (input, knownIndex) => {
      info.xref.maxIndex += 1;
      const index = knownIndex != null ? knownIndex : info.xref.maxIndex;
      addedReferences.set(index, pdf.length + 1);
      pdf = Buffer.concat([
        pdf,
        Buffer.from('\n'),
        Buffer.from(`${index} 0 obj\n`),
        // CORRECCIÓN vs @signpdf: 'binary' para no corromper strings UTF-16 con acentos.
        toBuffer(PDFObject.convert(input)),
        Buffer.from('\nendobj\n'),
      ]);
      return new PDFKitReferenceMock(info.xref.maxIndex);
    },
    page: {
      dictionary: new PDFKitReferenceMock(pageIndex, {
        data: { Annots: [] },
      }),
    },
    _root: { data: {} },
  };
  const acroFormRef = getAcroFormRef(info.root);
  if (acroFormRef) {
    pdfKitMock._root.data.AcroForm = acroFormRef;
  }
  const { form, widget } = pdfkitAddPlaceholder({
    pdf: pdfKitMock,
    pdfBuffer,
    reason,
    contactInfo,
    name,
    location,
    signingTime,
    signatureLength,
    subFilter,
    widgetRect,
    appName,
  });
  if (!getAcroFormRef(pdf.toString())) {
    const rootIndex = getIndexFromRef(info.xref, info.rootRef);
    addedReferences.set(rootIndex, pdf.length + 1);
    pdf = Buffer.concat([pdf, Buffer.from('\n'), createBufferRootWithAcroform(pdf, info, form)]);
  }
  addedReferences.set(pageIndex, pdf.length + 1);
  pdf = Buffer.concat([pdf, Buffer.from('\n'), createBufferPageWithAnnotation(pdf, info, pageRef, widget)]);
  pdf = Buffer.concat([pdf, Buffer.from('\n'), createBufferTrailer(pdf, info, addedReferences)]);
  return pdf;
}

module.exports = { plainAddPlaceholder, pdfkitAddPlaceholder };
