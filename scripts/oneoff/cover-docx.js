import fs from 'node:fs'
import zlib from 'node:zlib'

const source = 'C:/Users/forbi/Desktop/ice cream site/docs/Documentation/Cold-Stone-Creamery-Website-Documentation.docx'
const output = 'C:/Users/forbi/AppData/Local/Temp/Cold-Stone-Creamery-Website-Documentation-covered.docx'
const logoPath = 'C:/Users/forbi/Desktop/ice cream site/logo.png'
const signature = { local: 0x04034b50, central: 0x02014b50, end: 0x06054b50 }

function findEndOfDirectory(buffer) {
  for (let position = buffer.length - 22; position >= Math.max(0, buffer.length - 65557); position--) {
    if (buffer.readUInt32LE(position) === signature.end) return position
  }
  throw new Error('DOCX zip directory not found')
}

function readZip(path) {
  const buffer = fs.readFileSync(path)
  const end = findEndOfDirectory(buffer)
  const count = buffer.readUInt16LE(end + 10)
  const directorySize = buffer.readUInt32LE(end + 12)
  const directoryStart = buffer.readUInt32LE(end + 16)
  const entries = []
  let position = directoryStart

  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(position) !== signature.central) throw new Error('Invalid DOCX directory')
    const flags = buffer.readUInt16LE(position + 8)
    const method = buffer.readUInt16LE(position + 10)
    const nameLength = buffer.readUInt16LE(position + 28)
    const extraLength = buffer.readUInt16LE(position + 30)
    const commentLength = buffer.readUInt16LE(position + 32)
    const name = buffer.toString('utf8', position + 46, position + 46 + nameLength)
    const compressedSize = buffer.readUInt32LE(position + 20)
    const size = buffer.readUInt32LE(position + 24)
    const localPosition = buffer.readUInt32LE(position + 42)
    if (flags & 1) throw new Error('Encrypted DOCX files are not supported')

    const localNameLength = buffer.readUInt16LE(localPosition + 26)
    const localExtraLength = buffer.readUInt16LE(localPosition + 28)
    const contentStart = localPosition + 30 + localNameLength + localExtraLength
    const compressed = buffer.subarray(contentStart, contentStart + compressedSize)
    const data = method === 8
      ? zlib.inflateRawSync(compressed)
      : method === 0
        ? Buffer.from(compressed)
        : null
    if (!data || data.length !== size) throw new Error(`Unsupported or damaged DOCX part: ${name}`)

    entries.push({
      name,
      data,
      time: buffer.readUInt16LE(position + 12),
      date: buffer.readUInt16LE(position + 14),
    })
    position += 46 + nameLength + extraLength + commentLength
  }

  if (position - directoryStart !== directorySize) throw new Error('Incomplete DOCX directory')
  return entries
}

const crcTable = new Uint32Array(256)
for (let value = 0; value < 256; value++) {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  crcTable[value] = crc >>> 0
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const value of buffer) crc = crcTable[(crc ^ value) & 255] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function writeZip(path, entries) {
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8')
    const compressed = zlib.deflateRawSync(data, { level: 6 })
    const checksum = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(signature.local, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(entry.time || 0, 10)
    local.writeUInt16LE(entry.date || 0, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    localParts.push(local, name, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(signature.central, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(entry.time || 0, 12)
    central.writeUInt16LE(entry.date || 0, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, name)
    offset += local.length + name.length + compressed.length
  }

  const localData = Buffer.concat(localParts)
  const centralData = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(signature.end, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralData.length, 12)
  end.writeUInt32LE(localData.length, 16)
  fs.writeFileSync(path, Buffer.concat([localData, centralData, end]))
}

const unescapeXml = (text) => text
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")

function plainText(xml) {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => unescapeXml(match[1]))
    .join('')
}

function coverParagraph(text, { size = 20, color = '5B6B80', bold = false, before = 0, after = 100, fill = '' } = {}) {
  const shading = fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''
  const paragraph = `<w:pPr><w:spacing w:before="${before}" w:after="${after}"/><w:jc w:val="center"/>${shading}<w:keepNext/></w:pPr>`
  const run = `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="${color}"/>${bold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`
  return `<w:p>${paragraph}<w:r>${run}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
}

const logoSize = 1371600
const logoRun = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${logoSize}" cy="${logoSize}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="12000" name="Cold Stone Creamery front cover logo" descr="Cold Stone Creamery logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="12000" name="Cover logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdCoverLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${logoSize}" cy="${logoSize}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`

const frontCover = [
  `<w:p><w:pPr><w:spacing w:before="620" w:after="150"/><w:jc w:val="center"/></w:pPr>${logoRun}</w:p>`,
  coverParagraph('COLD STONE CREAMERY  ·  CAMEROON', { size: 23, color: 'BD9C00', bold: true, before: 100, after: 320 }),
  coverParagraph('COMPLETE WEBSITE', { size: 48, color: '092A53', bold: true, after: 40 }),
  coverParagraph('DOCUMENTATION', { size: 60, color: '092A53', bold: true, after: 280 }),
  coverParagraph('A practical guide to the customer experience, store operations and technology behind the website.', { size: 24, after: 360 }),
  coverParagraph('CUSTOMER EXPERIENCE  ·  STORE OPERATIONS  ·  TECHNICAL REFERENCE', { size: 17, color: '092A53', bold: true, after: 340 }),
  coverParagraph('EDITION 1.2  ·  17 OCTOBER 2026', { size: 18, color: 'FFFFFF', bold: true, before: 120, after: 120, fill: '092A53' }),
  coverParagraph('Owner, manager and developer edition', { size: 17, color: '5B6B80', before: 120, after: 80 }),
  coverParagraph('https://ice-cream-shop-20eg.onrender.com', { size: 16, color: '5B6B80', after: 0 }),
].join('')

const entries = readZip(source)
const getEntry = (name) => {
  const entry = entries.find((item) => item.name === name)
  if (!entry) throw new Error(`Missing DOCX part: ${name}`)
  return entry
}

let documentXml = getEntry('word/document.xml').data.toString('utf8')
const disclaimerPatterns = [
  /disclaimer built into the site/i,
  /not an official cold stone creamery website/i,
  /does not claim affiliation/i,
  /illustrative estimates, not official branch prices/i,
  /the site is now named cold stone creamery, but several pages/i,
  /if the site is operated by or for cold stone creamery cameroon/i,
  /this is an independent website and does not claim affiliation/i,
]
let removedDisclaimerItems = 0

documentXml = documentXml.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (row) => {
  const text = plainText(row)
  if (disclaimerPatterns.some((pattern) => pattern.test(text))) {
    removedDisclaimerItems++
    return ''
  }
  return row
})
documentXml = documentXml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
  const text = plainText(paragraph)
  if (disclaimerPatterns.some((pattern) => pattern.test(text))) {
    removedDisclaimerItems++
    return ''
  }
  return paragraph
})

const bodyStart = documentXml.indexOf('<w:body>')
const firstBreak = documentXml.indexOf('<w:br w:type="page"/>', bodyStart)
if (bodyStart < 0 || firstBreak < 0) throw new Error('Could not locate the existing front cover page')
const pageBreakEnd = documentXml.indexOf('</w:p>', firstBreak)
if (pageBreakEnd < 0) throw new Error('Existing cover page break is malformed')
const replaceFrom = bodyStart + '<w:body>'.length
const replaceTo = pageBreakEnd + '</w:p>'.length
documentXml = documentXml.slice(0, replaceFrom) + frontCover + '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' + documentXml.slice(replaceTo)
getEntry('word/document.xml').data = Buffer.from(documentXml, 'utf8')

const relationships = getEntry('word/_rels/document.xml.rels')
let relationshipsXml = relationships.data.toString('utf8')
if (!relationshipsXml.includes('Id="rIdCoverLogo"')) {
  relationshipsXml = relationshipsXml.replace(
    '</Relationships>',
    '<Relationship Id="rIdCoverLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/cover-logo.png"/></Relationships>',
  )
  relationships.data = Buffer.from(relationshipsXml, 'utf8')
}
if (!entries.some((item) => item.name === 'word/media/cover-logo.png')) {
  entries.push({ name: 'word/media/cover-logo.png', data: fs.readFileSync(logoPath), time: 0, date: 0 })
}

const contentTypes = getEntry('[Content_Types].xml')
let contentTypesXml = contentTypes.data.toString('utf8')
if (!/Extension="png"/.test(contentTypesXml)) {
  contentTypesXml = contentTypesXml.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>')
  contentTypes.data = Buffer.from(contentTypesXml, 'utf8')
}

writeZip(output, entries)
const verified = readZip(output)
const verifiedXml = verified.find((item) => item.name === 'word/document.xml')?.data.toString('utf8')
if (!verifiedXml) throw new Error('Generated document is missing its Word content')
const finalCover = verifiedXml.slice(verifiedXml.indexOf('<w:body>'), verifiedXml.indexOf('<w:br w:type="page"/>'))
if (!finalCover.includes('COMPLETE WEBSITE') || !finalCover.includes('DOCUMENTATION') || !finalCover.includes('rIdCoverLogo')) {
  throw new Error('New front cover was not written correctly')
}
const verifiedRelationships = verified.find((item) => item.name === 'word/_rels/document.xml.rels')?.data.toString('utf8') || ''
const logoPart = verified.find((item) => item.name === 'word/media/cover-logo.png')
console.log(`Cover logo relationship: ${verifiedRelationships.match(/<Relationship[^>]*Id="rIdCoverLogo"[^>]*\/>/)?.[0] || 'missing'}`)
console.log(`Embedded cover logo: ${logoPart?.data.length || 0} bytes`)
for (const pattern of disclaimerPatterns) {
  if (pattern.test(plainText(verifiedXml))) throw new Error(`Disclaimer remains in the Word document: ${pattern}`)
}
console.log(`Created dedicated branded front cover and removed ${removedDisclaimerItems} disclaimer passages.`)
console.log(`Verified output: ${output} (${fs.statSync(output).size} bytes, ${verified.length} DOCX parts).`)
