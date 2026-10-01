// The voucher as a PDF (the copy kept in Documents\TradeLink247 Weighbridge\Vouchers). A small
// hand-written PDF: the standard Helvetica fonts (no font files to ship) and the camera photo
// embedded as it is (JPEG, DCTDecode). Page: A5, or 80 mm wide for the receipt layout.

use crate::voucher::{Align, Item};

// Helvetica and Helvetica-Bold advance widths (1/1000 em) for ASCII 32..=126, from the AFM files.
const HELV: [u16; 95] = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELV_BOLD: [u16; 95] = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

const MM: f32 = 72.0 / 25.4;

/// Text the standard fonts can show: "₹" becomes "Rs.", anything else outside ASCII "?".
fn pdf_text(s: &str) -> String {
    s.replace('₹', "Rs.").chars().map(|c| if (' '..='~').contains(&c) { c } else { '?' }).collect()
}

/// Width in points.
pub fn text_width(s: &str, size: f32, bold: bool) -> f32 {
    let table = if bold { &HELV_BOLD } else { &HELV };
    pdf_text(s).chars().map(|c| table[(c as usize).saturating_sub(32).min(94)] as f32).sum::<f32>() * size / 1000.0
}

fn esc(s: &str) -> String {
    pdf_text(s).replace('\\', "\\\\").replace('(', "\\(").replace(')', "\\)")
}

/// Width, height and colour components of a JPEG (from its SOF marker).
pub fn jpeg_info(b: &[u8]) -> Option<(u32, u32, u8)> {
    let mut i = 2;
    while i + 9 < b.len() {
        if b[i] != 0xFF {
            i += 1;
            continue;
        }
        let m = b[i + 1];
        let len = u16::from_be_bytes([b[i + 2], b[i + 3]]) as usize;
        if matches!(m, 0xC0..=0xC3 | 0xC5..=0xC7 | 0xC9..=0xCB | 0xCD..=0xCF) {
            let h = u16::from_be_bytes([b[i + 5], b[i + 6]]) as u32;
            let w = u16::from_be_bytes([b[i + 7], b[i + 8]]) as u32;
            return Some((w, h, b[i + 9]));
        }
        i += 2 + len;
    }
    None
}

/// Page size and margins in mm for a layout.
pub fn page_for(layout: &str) -> (f32, f32) {
    if layout == "80mm" { (80.0, 4.0) } else { (148.0, 10.0) }
}

struct Draw {
    ops: String,
    y: f32, // from the top, in points
}

/// Builds the PDF. Items are drawn top to bottom; an 80 mm page is as tall as its content.
pub fn render(items: &[Item], layout: &str) -> Vec<u8> {
    let (width_mm, margin_mm) = page_for(layout);
    let narrow = layout == "80mm";
    let page_w = width_mm * MM;
    let margin = margin_mm * MM;
    let inner = page_w - 2.0 * margin;
    let photo = items.iter().find_map(|i| if let Item::Photo(p) = i { jpeg_info(p).map(|info| (p.clone(), info)) } else { None });

    let mut d = Draw { ops: String::new(), y: margin };
    let base = if narrow { 9.0 } else { 10.5 };
    let text_at = |d: &mut Draw, x: f32, s: &str, size: f32, bold: bool| {
        let f = if bold { "F2" } else { "F1" };
        d.ops.push_str(&format!("BT /{f} {size:.1} Tf {x:.2} \x01{:.2} Td ({}) Tj ET\n", d.y + size, esc(s)));
    };
    for it in items {
        match it {
            Item::Text { text, size, bold, align } => {
                // wrap to the width
                let mut lines: Vec<String> = vec![];
                let mut line = String::new();
                for w in text.split_whitespace() {
                    let cand = if line.is_empty() { w.to_string() } else { format!("{line} {w}") };
                    if !line.is_empty() && text_width(&cand, *size, *bold) > inner {
                        lines.push(std::mem::replace(&mut line, w.to_string()));
                    } else {
                        line = cand;
                    }
                }
                lines.push(line);
                for l in lines {
                    let x = if *align == Align::Center { margin + (inner - text_width(&l, *size, *bold)) / 2.0 } else { margin };
                    text_at(&mut d, x, &l, *size, *bold);
                    d.y += size * 1.3;
                }
            }
            Item::Pair { label, value, big } => {
                let vs = if *big { base + 3.0 } else { base };
                text_at(&mut d, margin, label, base, false);
                let shift = vs - base;
                d.y -= shift;
                text_at(&mut d, margin + inner - text_width(value, vs, true), value, vs, true);
                d.y += shift + vs * 1.35 + if narrow { 0.5 } else { 2.0 };
            }
            Item::Split { left, right, bold } => {
                text_at(&mut d, margin, left, base, *bold);
                text_at(&mut d, margin + inner - text_width(right, base, *bold), right, base, *bold);
                d.y += base * 1.5;
            }
            Item::Rule { solid } => {
                d.y += 2.0;
                let (lw, dash) = if *solid { (1.5, "[] 0") } else { (0.6, "[2 2] 0") };
                d.ops.push_str(&format!("{lw} w {dash} d {:.2} \x01{:.2} m {:.2} \x01{:.2} l S\n", margin, d.y, margin + inner, d.y));
                d.y += 4.0;
            }
            Item::Gap(mm) => d.y += mm * MM,
            Item::Photo(_) => {
                if let Some((_, (w, h, _))) = &photo {
                    let max_h = (if narrow { 45.0 } else { 60.0 }) * MM;
                    let scale = (inner / *w as f32).min(max_h / *h as f32);
                    let (dw, dh) = (*w as f32 * scale, *h as f32 * scale);
                    d.y += 4.0;
                    d.ops.push_str(&format!("q {dw:.2} 0 0 {dh:.2} {:.2} \x01{:.2} cm /Im1 Do Q\n", margin + (inner - dw) / 2.0, d.y + dh));
                    d.y += dh + 4.0;
                }
            }
            Item::Signatures => {
                d.y += if narrow { 18.0 } else { 36.0 };
                text_at(&mut d, margin, "Driver", base - 2.0, false);
                text_at(&mut d, margin + inner - text_width("Operator", base - 2.0, false), "Operator", base - 2.0, false);
                d.y += base * 1.4;
            }
        }
    }
    let page_h = if narrow { d.y + margin } else { 210.0 * MM };
    // PDF y runs up from the bottom: turn each "\x01<top-down y>" into page_h - y
    let mut ops = String::new();
    let mut rest = d.ops.as_str();
    while let Some(i) = rest.find('\x01') {
        ops.push_str(&rest[..i]);
        let tail = &rest[i + 1..];
        let end = tail.find(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-')).unwrap_or(tail.len());
        let y: f32 = tail[..end].parse().unwrap_or(0.0);
        ops.push_str(&format!("{:.2}", page_h - y));
        rest = &tail[end..];
    }
    ops.push_str(rest);
    ops.insert_str(0, "0 g 0 G\n");

    let mut objs: Vec<Vec<u8>> = vec![];
    objs.push(b"<< /Type /Catalog /Pages 2 0 R >>".to_vec());
    objs.push(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_vec());
    let xobj = if photo.is_some() { " /XObject << /Im1 7 0 R >>" } else { "" };
    objs.push(
        format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_w:.2} {page_h:.2}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >>{xobj} >> >>"
        )
        .into_bytes(),
    );
    let mut content = format!("<< /Length {} >>\nstream\n", ops.len()).into_bytes();
    content.extend(ops.as_bytes());
    content.extend(b"\nendstream");
    objs.push(content);
    objs.push(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>".to_vec());
    objs.push(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>".to_vec());
    if let Some((bytes, (w, h, comps))) = &photo {
        let cs = if *comps == 1 { "/DeviceGray" } else { "/DeviceRGB" };
        let mut img = format!("<< /Type /XObject /Subtype /Image /Width {w} /Height {h} /ColorSpace {cs} /BitsPerComponent 8 /Filter /DCTDecode /Length {} >>\nstream\n", bytes.len()).into_bytes();
        img.extend(bytes);
        img.extend(b"\nendstream");
        objs.push(img);
    }

    let mut out = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".to_vec();
    let mut offsets = vec![];
    for (i, o) in objs.iter().enumerate() {
        offsets.push(out.len());
        out.extend(format!("{} 0 obj\n", i + 1).as_bytes());
        out.extend(o);
        out.extend(b"\nendobj\n");
    }
    let xref = out.len();
    out.extend(format!("xref\n0 {}\n0000000000 65535 f \n", objs.len() + 1).as_bytes());
    for off in offsets {
        out.extend(format!("{off:010} 00000 n \n").as_bytes());
    }
    out.extend(format!("trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n", objs.len() + 1).as_bytes());
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::voucher::{layout, VoucherOptions};

    #[test]
    fn widths() {
        assert!((text_width("Amount", 10.0, false) - 34.46).abs() < 0.01);
        assert!(text_width("WW", 10.0, true) > text_width("ii", 10.0, true));
    }

    #[test]
    fn jpeg_size() {
        let img = image::RgbImage::from_pixel(64, 48, image::Rgb([200, 10, 10]));
        let mut buf = vec![];
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 80).encode_image(&img).unwrap();
        assert_eq!(jpeg_info(&buf), Some((64, 48, 3)));
    }

    #[test]
    fn a5_and_roll_pdfs_are_well_formed() {
        let row = crate::store::Weighing { voucher_number: "000001".into(), vehicle_number: "KL07AB1234".into(), lcd_number: 12000.0, amount: 100.0, ..Default::default() };
        let img = image::RgbImage::from_pixel(64, 48, image::Rgb([20, 120, 10]));
        let mut photo = vec![];
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut photo, 80).encode_image(&img).unwrap();
        for lay in ["a5", "80mm"] {
            let items = layout(&row, &VoucherOptions { layout: lay.into(), header: vec!["ACME (Kochi)".into()], photo: Some(photo.clone()), ..Default::default() });
            let pdf = render(&items, lay);
            let s = String::from_utf8_lossy(&pdf);
            assert!(s.starts_with("%PDF-1.4") && s.trim_end().ends_with("%%EOF"));
            assert!(s.contains("(ACME \\(Kochi\\)) Tj"));
            assert!(s.contains("(Rs. 100.00) Tj"));
            assert!(s.contains("/DCTDecode"));
            let content = &s[s.find("4 0 obj").unwrap()..s.find("5 0 obj").unwrap()];
            assert!(!content.contains('\x01'), "every y was placed");
            // xref offsets point at the objects
            let xref_at: usize = s.rsplit("startxref\n").next().unwrap().lines().next().unwrap().parse().unwrap();
            assert!(pdf[xref_at..].starts_with(b"xref"));
        }
    }
}
