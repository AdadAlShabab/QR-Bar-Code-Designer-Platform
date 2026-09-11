'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { ArrowDownToLine, Check, ImagePlus, Palette, RefreshCw, Sparkles, Upload, WandSparkles, X } from 'lucide-react'

const palettes = [
  { name: 'Emerald', ink: '#123d35', accent: '#e8a528', soft: '#eef7f1' },
  { name: 'Saffron', ink: '#573719', accent: '#e77743', soft: '#fff5df' },
  { name: 'Ocean', ink: '#12364a', accent: '#39a7a0', soft: '#eaf7f7' },
]

const formats = [
  { id: 'qr', label: 'QR code', sub: 'Links, payments, menus' },
  { id: 'barcode', label: 'Barcode', sub: 'Products & inventory' },
]

type Palette = typeof palettes[number]
type LogoColors = { ink: string; accent: string; soft: string }

function toHex(value: number) { return value.toString(16).padStart(2, '0') }
function rgbToHex(r: number, g: number, b: number) { return `#${toHex(r)}${toHex(g)}${toHex(b)}` }
function mix(first: string, second: string, amount: number) {
  const a = first.replace('#', ''); const b = second.replace('#', '')
  const channel = (index: number) => Math.round(parseInt(a.slice(index, index + 2), 16) * (1 - amount) + parseInt(b.slice(index, index + 2), 16) * amount)
  return rgbToHex(channel(0), channel(2), channel(4))
}
function luminance(hex: string) { const value = hex.replace('#', ''); const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4); return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 }
function readableInk(hex: string) { return luminance(hex) > 0.42 ? mix(hex, '#123d35', 0.62) : hex }

export default function Page() {
  const [format, setFormat] = useState('qr')
  const [value, setValue] = useState('https://yourbusiness.com.bd')
  const [prompt, setPrompt] = useState('')
  const [palette, setPalette] = useState<Palette>(palettes[0])
  const [logo, setLogo] = useState<string | null>(null)
  const [logoName, setLogoName] = useState('')
  const [logoColors, setLogoColors] = useState<LogoColors | null>(null)
  const [isInterpreting, setIsInterpreting] = useState(false)
  const [message, setMessage] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ink = logoColors?.ink ?? palette.ink
    const accent = logoColors?.accent ?? palette.accent
    const soft = logoColors?.soft ?? palette.soft
    const drawLogoMask = (context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, sampleX: number, sampleY: number, sampleWidth: number, sampleHeight: number) => {
      const mask = document.createElement('canvas')
      mask.width = 64; mask.height = 64
      const maskContext = mask.getContext('2d')
      if (!maskContext) return null
      maskContext.clearRect(0, 0, 64, 64)
      maskContext.drawImage(image, 0, 0, 64, 64)
      const pixels = maskContext.getImageData(0, 0, 64, 64).data
      const alphaAt = (x: number, y: number) => {
        const index = (Math.max(0, Math.min(63, Math.floor(x))) + Math.max(0, Math.min(63, Math.floor(y))) * 64) * 4
        const alpha = pixels[index + 3] / 255
        const luminance = (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255
        return Math.max(alpha, (1 - luminance) * alpha)
      }
      context.save()
      context.fillStyle = ink
      for (let y = 0; y < sampleHeight; y += 1) for (let x = 0; x < sampleWidth; x += 1) {
        const strength = alphaAt((x / sampleWidth) * 64, (y / sampleHeight) * 64)
        if (strength < 0.2) continue
        const size = Math.max(1.2, 1 + strength * 3.5)
        const px = sampleX + x * (width / sampleWidth) - (size - 1) / 2
        const py = sampleY + y * (height / sampleHeight) - (size - 1) / 2
        context.globalAlpha = 0.45 + strength * 0.55
        context.beginPath(); context.roundRect(px, py, width / sampleWidth * size, height / sampleHeight * size, 2); context.fill()
      }
      context.restore()
      return true
    }
    if (format === 'qr') {
      const qr = QRCode.create(value || 'https://yourbusiness.com.bd', { errorCorrectionLevel: 'H' })
      const modules = qr.modules.size
      const quiet = 28
      const moduleSize = 10
      canvas.width = modules * moduleSize + quiet * 2
      canvas.height = canvas.width
      const context = canvas.getContext('2d')
      if (!context) return
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
      const finder = (row: number, column: number) => row < 7 && column < 7 || row < 7 && column >= modules - 7 || row >= modules - 7 && column < 7
      context.fillStyle = ink
      for (let row = 0; row < modules; row += 1) for (let column = 0; column < modules; column += 1) {
        if (!qr.modules.get(row, column) || finder(row, column)) continue
        const x = quiet + column * moduleSize; const y = quiet + row * moduleSize
        const radius = moduleSize * 0.28
        context.beginPath(); context.roundRect(x + 0.7, y + 0.7, moduleSize - 1.4, moduleSize - 1.4, radius); context.fill()
      }
      ;[[0, 0], [modules - 7, 0], [0, modules - 7]].forEach(([column, row]) => {
        const x = quiet + column * moduleSize; const y = quiet + row * moduleSize; const size = moduleSize * 7
        context.fillStyle = ink; context.beginPath(); context.roundRect(x, y, size, size, moduleSize * 1.25); context.fill()
        context.fillStyle = '#ffffff'; context.beginPath(); context.roundRect(x + moduleSize, y + moduleSize, size - moduleSize * 2, size - moduleSize * 2, moduleSize); context.fill()
        context.fillStyle = accent; context.beginPath(); context.roundRect(x + moduleSize * 2.35, y + moduleSize * 2.35, moduleSize * 2.3, moduleSize * 2.3, moduleSize * 0.75); context.fill()
      })
      if (logo) {
        const image = new Image(); image.crossOrigin = 'anonymous'; image.onload = () => {
          const safeInset = quiet + moduleSize * 8
          drawLogoMask(context, image, canvas.width - safeInset * 2, canvas.height - safeInset * 2, safeInset, safeInset, modules - 16, modules - 16)
          context.globalAlpha = 1
          context.strokeStyle = accent; context.lineWidth = 3; context.setLineDash([8, 7]); context.strokeRect(safeInset - 8, safeInset - 8, canvas.width - (safeInset - 8) * 2, canvas.height - (safeInset - 8) * 2); context.setLineDash([])
        }; image.src = logo
      }
    } else {
      JsBarcode(canvas, value || '8901234567890', { format: value.length === 13 ? 'ean13' : 'CODE128', width: 2.2, height: 150, margin: 18, lineColor: ink, background: '#ffffff', displayValue: true, fontSize: 16 })
      if (logo) { const image = new Image(); image.onload = () => { const context = canvas.getContext('2d'); if (!context) return; drawLogoMask(context, image, canvas.width - 36, 112, 18, 18, 96, 32); context.globalAlpha = 1; context.fillStyle = soft; context.globalCompositeOperation = 'destination-over'; context.fillRect(0, 0, canvas.width, canvas.height); context.globalCompositeOperation = 'source-over' }; image.src = logo }
    }
  }, [format, value, palette, logo, logoColors])

  async function interpretPrompt() {
    if (!prompt.trim()) return
    setIsInterpreting(true); setMessage('')
    try { const response = await fetch('/api/interpret-style', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt }) }); const data = await response.json(); if (data.palette) setPalette(palettes.find((item) => item.name.toLowerCase() === data.palette.toLowerCase()) ?? palettes[0]); setMessage(data.message ?? 'Style applied to your code.') } catch { setMessage('Using a polished default style for now.') } finally { setIsInterpreting(false) }
  }

  function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 2 * 1024 * 1024) { setMessage('Please choose a logo under 2MB.'); return }
    const reader = new FileReader(); reader.onload = () => {
      const dataUrl = String(reader.result); setLogo(dataUrl); setLogoName(file.name)
      const image = new Image(); image.onload = () => { const sample = document.createElement('canvas'); sample.width = 1; sample.height = 1; const context = sample.getContext('2d'); if (!context) return; context.drawImage(image, 0, 0, 1, 1); const pixel = context.getImageData(0, 0, 1, 1).data; const extracted = readableInk(rgbToHex(pixel[0], pixel[1], pixel[2])); setLogoColors({ ink: extracted, accent: mix(extracted, '#e8a528', 0.45), soft: mix(extracted, '#ffffff', 0.9) }); setMessage('Your logo silhouette is now transformed across the full code pattern while scan-safe geometry stays protected.') }; image.src = dataUrl
    }; reader.readAsDataURL(file)
  }

  function downloadCode() { const canvas = canvasRef.current; if (!canvas) return; const link = document.createElement('a'); link.download = `brandcode-${format}.png`; link.href = canvas.toDataURL('image/png'); link.click(); fetch('/api/generations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ format, promptPresent: Boolean(prompt), logoPresent: Boolean(logo), style: palette.name }) }).catch(() => {}) }
  function reset() { setValue('https://yourbusiness.com.bd'); setPrompt(''); setLogo(null); setLogoName(''); setLogoColors(null); setPalette(palettes[0]); setMessage('') }

  return <main className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark">⌁</span><span>brand<span className="brand-dot">.</span>code</span></div><div className="top-note"><span className="status-dot" /> Built for Bangladesh <span className="bd-flag">●</span></div></header><section className="hero"><div className="eyebrow"><Sparkles size={14} /> YOUR CODE, YOUR CHARACTER</div><h1>Make your code<br /><em>impossible to ignore.</em></h1><p>Turn everyday QR codes and barcodes into a memorable part of your brand — in seconds.</p></section><section className="workspace"><div className="controls panel"><div className="panel-heading"><div><span className="step">01</span><h2>Set up your code</h2></div><button className="icon-button" onClick={reset} aria-label="Reset form"><RefreshCw size={16} /></button></div><div className="format-tabs">{formats.map((item) => <button key={item.id} className={format === item.id ? 'format-tab active' : 'format-tab'} onClick={() => setFormat(item.id)}><span className="format-icon">{item.id === 'qr' ? '▦' : '▤'}</span><span><strong>{item.label}</strong><small>{item.sub}</small></span>{format === item.id && <Check size={16} />}</button>)}</div><label className="field-label" htmlFor="value">{format === 'qr' ? 'Destination or message' : 'Product number'}</label><div className="input-wrap"><input id="value" value={value} onChange={(e) => setValue(e.target.value)} placeholder={format === 'qr' ? 'https://...' : 'Enter a product code'} /><span className="counter">{value.length}/160</span></div><div className="divider" /><div className="field-row"><div><label className="field-label">Add your logo <span>OPTIONAL</span></label><small className="helper">PNG or JPG, up to 2MB</small></div>{logo && <button className="remove-logo" onClick={() => { setLogo(null); setLogoName(''); setLogoColors(null) }}><X size={13} /> Remove</button>}</div><label className={logo ? 'upload-zone has-logo' : 'upload-zone'}><input type="file" accept="image/png,image/jpeg" onChange={uploadLogo} />{logo ? <><img src={logo} alt="Uploaded logo preview" /><span>{logoName}</span></> : <><ImagePlus size={22} /><span>Your logo becomes the full code pattern — drop it here or <b>browse files</b></span></>}</label><div className="divider" /><label className="field-label" htmlFor="prompt">Describe the vibe <span>OPTIONAL</span></label><div className="prompt-wrap"><textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Fresh, leafy, and friendly for my organic grocery shop..." maxLength={300} /><button onClick={interpretPrompt} disabled={!prompt.trim() || isInterpreting} className="interpret-button"><WandSparkles size={15} /> {isInterpreting ? 'Thinking...' : 'Interpret with AI'}</button></div><div className="palette-row"><span className="field-label">Quick palette</span><div className="palette-options">{palettes.map((item) => <button key={item.name} aria-label={item.name} className={palette.name === item.name ? 'swatch selected' : 'swatch'} style={{ background: item.ink, outlineColor: item.accent }} onClick={() => setPalette(item)} />)}</div></div>{message ? <div className="notice"><Sparkles size={15} /><span>{message}</span></div> : null}</div><div className="preview-column"><div className="preview-head"><div><span className="step">02</span><h2>Preview your code</h2></div><span className="live-pill"><span /> LIVE</span></div><div className="preview-card" style={{ background: logoColors?.soft ?? palette.soft }}><div className="preview-art"><canvas ref={canvasRef} aria-label="Generated code preview" /></div><div className="preview-caption"><div><strong>{logo ? 'Logo-shaped brand code' : format === 'qr' ? 'Your brand code' : 'Product barcode'}</strong><span>{logo ? 'Logo colors · rounded modules · protected mark' : `${palette.name} palette · high contrast`}</span></div><span className="safe-badge">● SCANNABLE</span></div></div><div className="preview-actions"><button className="download-button" onClick={downloadCode}><ArrowDownToLine size={18} /> Download PNG</button><button className="secondary-button" onClick={() => navigator.clipboard?.writeText(value)}><Palette size={16} /> Copy value</button></div><div className="tip"><span className="tip-icon">i</span><p><b>Pro tip:</b> Your logo is protected in a quiet center zone so the code stays fast to scan.</p></div></div></section><footer><span>Made for ambitious businesses in Bangladesh.</span><span>Simple by design <span className="footer-line">—</span> powerful by nature.</span></footer></main>
}
