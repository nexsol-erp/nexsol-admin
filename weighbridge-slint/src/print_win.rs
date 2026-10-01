// Printing on Windows, straight to the printer driver (no browser, no PDF viewer):
//   A5 / 80 mm  the voucher layout drawn with GDI (Arial), the photo too when asked for.
//               A5 asks the driver for A5 paper; an 80 mm roll printer keeps its own paper.
//   text        plain text sent RAW to the printer, for dot-matrix printers (ESC/P bold, a form
//               feed at the end). No photo.
// printer "" means the Windows default printer, like the Qt app.

use crate::voucher::Item;

pub fn is_supported() -> bool {
    cfg!(windows)
}

#[cfg(not(windows))]
mod imp {
    use super::Item;
    pub fn printers() -> Vec<String> {
        vec![]
    }
    pub fn print_gdi(_printer: &str, _items: &[Item], _layout: &str, _title: &str) -> Result<(), String> {
        Err("Printing works on Windows only".into())
    }
    pub fn print_raw(_printer: &str, _data: &[u8], _title: &str) -> Result<(), String> {
        Err("Printing works on Windows only".into())
    }
}

#[cfg(windows)]
mod imp {
    use super::Item;
    use crate::voucher::Align;
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::{COLORREF, SIZE};
    use windows::Win32::Graphics::Gdi::*;
    use windows::Win32::Graphics::Printing::*;
    use windows::Win32::Storage::Xps::{EndDoc, EndPage, StartDocW, StartPage, DOCINFOW};

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn from_wide(p: PWSTR) -> String {
        if p.is_null() { String::new() } else { unsafe { p.to_string().unwrap_or_default() } }
    }

    pub fn printers() -> Vec<String> {
        unsafe {
            let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
            let (mut needed, mut count) = (0u32, 0u32);
            let _ = EnumPrintersW(flags, PCWSTR::null(), 4, None, &mut needed, &mut count);
            if needed == 0 {
                return vec![];
            }
            let mut buf = vec![0u8; needed as usize];
            if EnumPrintersW(flags, PCWSTR::null(), 4, Some(&mut buf), &mut needed, &mut count).is_err() {
                return vec![];
            }
            let infos = std::slice::from_raw_parts(buf.as_ptr() as *const PRINTER_INFO_4W, count as usize);
            infos.iter().map(|i| from_wide(i.pPrinterName)).filter(|n| !n.is_empty()).collect()
        }
    }

    pub fn default_printer() -> String {
        unsafe {
            let mut len = 0u32;
            let _ = GetDefaultPrinterW(None, &mut len);
            if len == 0 {
                return String::new();
            }
            let mut buf = vec![0u16; len as usize];
            if !GetDefaultPrinterW(Some(PWSTR(buf.as_mut_ptr())), &mut len).as_bool() {
                return String::new();
            }
            String::from_utf16_lossy(&buf[..buf.iter().position(|c| *c == 0).unwrap_or(buf.len())])
        }
    }

    fn pick(printer: &str) -> Result<String, String> {
        let p = if printer.is_empty() { default_printer() } else { printer.to_string() };
        if p.is_empty() { Err("No printer: set a Windows default printer or choose one in Settings".into()) } else { Ok(p) }
    }

    /// The driver's settings for this printer, with A5 paper when asked for.
    fn devmode(name: &[u16], a5: bool) -> Option<Vec<u8>> {
        unsafe {
            let mut h = PRINTER_HANDLE::default();
            OpenPrinterW(PCWSTR(name.as_ptr()), &mut h, None).ok()?;
            let size = DocumentPropertiesW(None, h, PCWSTR(name.as_ptr()), None, None, 0);
            if size <= 0 {
                let _ = ClosePrinter(h);
                return None;
            }
            let mut buf = vec![0u8; size as usize];
            let dm = buf.as_mut_ptr() as *mut DEVMODEW;
            let ok = DocumentPropertiesW(None, h, PCWSTR(name.as_ptr()), Some(dm), None, DM_OUT_BUFFER.0) >= 0;
            if ok && a5 {
                (*dm).Anonymous1.Anonymous1.dmPaperSize = DMPAPER_A5 as i16;
                (*dm).dmFields |= DM_PAPERSIZE;
                let _ = DocumentPropertiesW(None, h, PCWSTR(name.as_ptr()), Some(dm), Some(dm), DM_IN_BUFFER.0 | DM_OUT_BUFFER.0);
            }
            let _ = ClosePrinter(h);
            ok.then_some(buf)
        }
    }

    struct Dc {
        hdc: HDC,
        px_mm: f32,
        py_mm: f32,
        off_x: i32,
        off_y: i32,
        dpi_y: f32,
    }

    impl Dc {
        fn x(&self, mm: f32) -> i32 {
            (mm * self.px_mm) as i32 - self.off_x
        }
        fn y(&self, mm: f32) -> i32 {
            (mm * self.py_mm) as i32 - self.off_y
        }
        fn font(&self, pt: f32, bold: bool) -> HFONT {
            let face = wide("Arial");
            unsafe {
                CreateFontW(
                    -((pt * self.dpi_y / 72.0) as i32), 0, 0, 0,
                    if bold { FW_BOLD.0 as i32 } else { 400 },
                    0, 0, 0, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, PROOF_QUALITY, DEFAULT_PITCH.0 as u32,
                    PCWSTR(face.as_ptr()),
                )
            }
        }
        /// Width of the text in mm, in the given font.
        fn width(&self, s: &str, pt: f32, bold: bool) -> f32 {
            let f = self.font(pt, bold);
            let w: Vec<u16> = s.encode_utf16().collect();
            let mut sz = SIZE::default();
            unsafe {
                let old = SelectObject(self.hdc, f.into());
                let _ = GetTextExtentPoint32W(self.hdc, &w, &mut sz);
                SelectObject(self.hdc, old);
                let _ = DeleteObject(f.into());
            }
            sz.cx as f32 / self.px_mm
        }
        fn text(&self, x_mm: f32, y_mm: f32, s: &str, pt: f32, bold: bool) {
            let f = self.font(pt, bold);
            let w: Vec<u16> = s.encode_utf16().collect();
            unsafe {
                let old = SelectObject(self.hdc, f.into());
                let _ = TextOutW(self.hdc, self.x(x_mm), self.y(y_mm), &w);
                SelectObject(self.hdc, old);
                let _ = DeleteObject(f.into());
            }
        }
        fn rule(&self, x1: f32, x2: f32, y: f32, solid: bool) {
            unsafe {
                let w = if solid { (0.5 * self.px_mm) as i32 } else { 1 };
                let pen = CreatePen(if solid { PS_SOLID } else { PS_DOT }, w.max(1), COLORREF(0));
                let old = SelectObject(self.hdc, pen.into());
                let _ = MoveToEx(self.hdc, self.x(x1), self.y(y), None);
                let _ = LineTo(self.hdc, self.x(x2), self.y(y));
                SelectObject(self.hdc, old);
                let _ = DeleteObject(pen.into());
            }
        }
        fn photo(&self, jpeg: &[u8], x: f32, y: f32, w_mm: f32, h_mm: f32) {
            let Ok(img) = image::load_from_memory_with_format(jpeg, image::ImageFormat::Jpeg) else { return };
            let rgb = img.to_rgb8();
            let (w, h) = (rgb.width() as usize, rgb.height() as usize);
            let stride = (w * 3 + 3) & !3;
            let mut bits = vec![0u8; stride * h];
            for (yy, row) in rgb.rows().enumerate() {
                for (xx, p) in row.enumerate() {
                    let i = yy * stride + xx * 3;
                    bits[i] = p[2];
                    bits[i + 1] = p[1];
                    bits[i + 2] = p[0];
                }
            }
            let mut bmi = BITMAPINFO::default();
            bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bmi.bmiHeader.biWidth = w as i32;
            bmi.bmiHeader.biHeight = -(h as i32); // top-down
            bmi.bmiHeader.biPlanes = 1;
            bmi.bmiHeader.biBitCount = 24;
            unsafe {
                SetStretchBltMode(self.hdc, HALFTONE);
                StretchDIBits(
                    self.hdc, self.x(x), self.y(y), (w_mm * self.px_mm) as i32, (h_mm * self.py_mm) as i32,
                    0, 0, w as i32, h as i32, Some(bits.as_ptr() as *const _), &bmi, DIB_RGB_COLORS, SRCCOPY,
                );
            }
        }
    }

    pub fn print_gdi(printer: &str, items: &[Item], layout: &str, title: &str) -> Result<(), String> {
        let name = pick(printer)?;
        let wname = wide(&name);
        let narrow = layout == "80mm";
        let dm = devmode(&wname, !narrow);
        let driver = wide("WINSPOOL");
        unsafe {
            let hdc = CreateDCW(PCWSTR(driver.as_ptr()), PCWSTR(wname.as_ptr()), PCWSTR::null(), dm.as_ref().map(|b| b.as_ptr() as *const DEVMODEW));
            if hdc.is_invalid() {
                return Err(format!("Printer \"{name}\" is not available"));
            }
            let dc = Dc {
                hdc,
                px_mm: GetDeviceCaps(Some(hdc), LOGPIXELSX) as f32 / 25.4,
                py_mm: GetDeviceCaps(Some(hdc), LOGPIXELSY) as f32 / 25.4,
                off_x: GetDeviceCaps(Some(hdc), PHYSICALOFFSETX),
                off_y: GetDeviceCaps(Some(hdc), PHYSICALOFFSETY),
                dpi_y: GetDeviceCaps(Some(hdc), LOGPIXELSY) as f32,
            };
            let wtitle = wide(title);
            let di = DOCINFOW { cbSize: std::mem::size_of::<DOCINFOW>() as i32, lpszDocName: PCWSTR(wtitle.as_ptr()), ..Default::default() };
            if StartDocW(hdc, &di) <= 0 {
                let _ = DeleteDC(hdc);
                return Err(format!("Printer \"{name}\" refused the voucher"));
            }
            StartPage(hdc);
            SetBkMode(hdc, TRANSPARENT);
            let (page_w, margin) = crate::pdf::page_for(layout);
            draw(&dc, items, margin, page_w - 2.0 * margin, narrow);
            EndPage(hdc);
            let ok = EndDoc(hdc) > 0;
            let _ = DeleteDC(hdc);
            if ok { Ok(()) } else { Err(format!("Printer \"{name}\" did not finish the voucher")) }
        }
    }

    fn draw(dc: &Dc, items: &[Item], margin: f32, inner: f32, narrow: bool) {
        const PT: f32 = 25.4 / 72.0; // mm per point
        let base: f32 = if narrow { 9.0 } else { 10.5 };
        let mut y = margin;
        for it in items {
            match it {
                Item::Text { text, size, bold, align } => {
                    let mut lines = vec![];
                    let mut line = String::new();
                    for w in text.split_whitespace() {
                        let cand = if line.is_empty() { w.to_string() } else { format!("{line} {w}") };
                        if !line.is_empty() && dc.width(&cand, *size, *bold) > inner {
                            lines.push(std::mem::replace(&mut line, w.to_string()));
                        } else {
                            line = cand;
                        }
                    }
                    lines.push(line);
                    for l in lines {
                        let x = if *align == Align::Center { margin + (inner - dc.width(&l, *size, *bold)) / 2.0 } else { margin };
                        dc.text(x, y, &l, *size, *bold);
                        y += size * 1.3 * PT;
                    }
                }
                Item::Pair { label, value, big } => {
                    let vs = if *big { base + 3.0 } else { base };
                    dc.text(margin, y + (vs - base) * PT, label, base, false);
                    dc.text(margin + inner - dc.width(value, vs, true), y, value, vs, true);
                    y += vs * 1.35 * PT + if narrow { 0.2 } else { 0.7 };
                }
                Item::Split { left, right, bold } => {
                    dc.text(margin, y, left, base, *bold);
                    dc.text(margin + inner - dc.width(right, base, *bold), y, right, base, *bold);
                    y += base * 1.5 * PT;
                }
                Item::Rule { solid } => {
                    y += 0.8;
                    dc.rule(margin, margin + inner, y, *solid);
                    y += 1.4;
                }
                Item::Gap(mm) => y += mm,
                Item::Photo(p) => {
                    if let Some((w, h, _)) = crate::pdf::jpeg_info(p) {
                        let max_h = if narrow { 45.0 } else { 60.0 };
                        let scale = (inner / w as f32).min(max_h / h as f32);
                        let (dw, dh) = (w as f32 * scale, h as f32 * scale);
                        y += 1.5;
                        dc.photo(p, margin + (inner - dw) / 2.0, y, dw, dh);
                        y += dh + 1.5;
                    }
                }
                Item::Signatures => {
                    y += if narrow { 6.0 } else { 12.0 };
                    dc.text(margin, y, "Driver", base - 2.0, false);
                    dc.text(margin + inner - dc.width("Operator", base - 2.0, false), y, "Operator", base - 2.0, false);
                    y += base * 1.4 * PT;
                }
            }
        }
    }

    /// Bytes straight to the printer (dot-matrix text).
    pub fn print_raw(printer: &str, data: &[u8], title: &str) -> Result<(), String> {
        let name = pick(printer)?;
        let wname = wide(&name);
        unsafe {
            let mut h = PRINTER_HANDLE::default();
            OpenPrinterW(PCWSTR(wname.as_ptr()), &mut h, None).map_err(|_| format!("Printer \"{name}\" is not available"))?;
            let mut wtitle = wide(title);
            let mut raw = wide("RAW");
            let di = DOC_INFO_1W { pDocName: PWSTR(wtitle.as_mut_ptr()), pOutputFile: PWSTR::null(), pDatatype: PWSTR(raw.as_mut_ptr()) };
            if StartDocPrinterW(h, 1, &di) == 0 {
                let _ = ClosePrinter(h);
                return Err(format!("Printer \"{name}\" refused the voucher"));
            }
            let _ = StartPagePrinter(h);
            let mut written = 0u32;
            let ok = WritePrinter(h, data.as_ptr() as *const _, data.len() as u32, &mut written).as_bool() && written as usize == data.len();
            let _ = EndPagePrinter(h);
            let _ = EndDocPrinter(h);
            let _ = ClosePrinter(h);
            if ok { Ok(()) } else { Err(format!("Printer \"{name}\" did not take the voucher")) }
        }
    }
}

pub use imp::{print_gdi, print_raw, printers};

/// Dot-matrix bytes: ESC @ (reset), each line (bold with ESC E / ESC F), CR LF, then a form feed
/// to the next page when asked.
pub fn escp_bytes(lines: &[(String, bool)], form_feed: bool) -> Vec<u8> {
    let mut out = vec![0x1B, b'@'];
    for (text, bold) in lines {
        if *bold {
            out.extend([0x1B, b'E']);
        }
        out.extend(text.bytes().filter(|b| b.is_ascii()));
        if *bold {
            out.extend([0x1B, b'F']);
        }
        out.extend(b"\r\n");
    }
    if form_feed {
        out.push(0x0C);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escp_text() {
        let b = escp_bytes(&[("TITLE".into(), true), ("x".into(), false)], true);
        assert_eq!(b, b"\x1b@\x1bETITLE\x1bF\r\nx\r\n\x0c".to_vec());
    }
}
