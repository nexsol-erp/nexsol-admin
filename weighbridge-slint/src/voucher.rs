// The weighment voucher. Same content as the Qt voucher (wbVoucherPrint) and the Electron app:
// branch header, voucher number and date, vehicle, weight, first weight and its date, net weight,
// amount, material, a declaration and Driver/Operator signature lines, optionally the camera photo.
//
// One layout (a list of items in millimetres) feeds every output: the PDF copy (pdf.rs), the
// Windows printer (print_win.rs) and plain text for dot-matrix printers (text_lines below).
// Paper: "a5" (what the Qt app printed), "80mm" receipt roll, or "text" (dot-matrix, plain text).

use crate::store::Weighing;

#[derive(Debug, Clone, Default)]
pub struct VoucherOptions {
    pub header: Vec<String>,
    pub layout: String,
    pub currency: String,
    pub footer: String,
    pub copy_label: String,
    /// the weighing's camera photo (JPEG), printed under the weights when given
    pub photo: Option<Vec<u8>>,
    /// characters per line for the text layout (dot-matrix)
    pub text_width: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Align {
    Left,
    Center,
}

#[derive(Debug, Clone)]
pub enum Item {
    /// one line of text
    Text { text: String, size: f32, bold: bool, align: Align },
    /// label on the left, value on the right
    Pair { label: String, value: String, big: bool },
    /// two values on one line, left and right (voucher number and date)
    Split { left: String, right: String, bold: bool },
    Rule { solid: bool },
    Gap(f32),
    Photo(Vec<u8>),
    /// "Driver" and "Operator" at the two ends, after space to sign
    Signatures,
}

/// "2026-09-30 14:05:09" → "30/09/2026 14:05"
pub fn fmt_date(stamp: &str) -> String {
    let b = stamp.as_bytes();
    if b.len() >= 16 && b[4] == b'-' && b[7] == b'-' && (b[10] == b' ' || b[10] == b'T') {
        return format!("{}/{}/{} {}", &stamp[8..10], &stamp[5..7], &stamp[0..4], &stamp[11..16]);
    }
    stamp.to_string()
}

/// Indian grouping: 1234567 → "12,34,567"; up to 3 decimals, trailing zeros dropped.
pub fn fmt_num(v: f64) -> String {
    let neg = v < 0.0;
    let s = format!("{:.3}", v.abs());
    let (int, frac) = s.split_once('.').unwrap_or((&s, ""));
    let frac = frac.trim_end_matches('0');
    let mut out = String::new();
    let digits: Vec<char> = int.chars().collect();
    let n = digits.len();
    for (i, c) in digits.iter().enumerate() {
        out.push(*c);
        let left = n - i - 1;
        if left > 0 && (left == 3 || (left > 3 && (left - 3) % 2 == 0)) {
            out.push(',');
        }
    }
    if !frac.is_empty() {
        out.push('.');
        out.push_str(frac);
    }
    if neg { format!("-{out}") } else { out }
}

pub fn fmt_kg(v: f64) -> String {
    format!("{} kg", fmt_num(v))
}

pub fn layout(row: &Weighing, o: &VoucherOptions) -> Vec<Item> {
    let fw = row.first_weight;
    let tare = row.first_weight_kind.as_deref() == Some("tare");
    let lines: Vec<&String> = o.header.iter().filter(|l| !l.trim().is_empty()).collect();
    let title = lines.first().map(|s| s.to_string()).unwrap_or_else(|| "WEIGHBRIDGE".into());
    let narrow = o.layout == "80mm";
    let base: f32 = if narrow { 9.0 } else { 10.5 };
    let mut v = vec![Item::Text { text: title, size: base + 4.5, bold: true, align: Align::Center }];
    for l in lines.iter().skip(1) {
        v.push(Item::Text { text: l.to_string(), size: base - 0.5, bold: false, align: Align::Center });
    }
    v.push(Item::Rule { solid: true });
    v.push(Item::Text { text: "WEIGHBRIDGE VOUCHER".into(), size: base, bold: true, align: Align::Center });
    if !o.copy_label.is_empty() {
        v.push(Item::Text { text: o.copy_label.clone(), size: base - 1.5, bold: false, align: Align::Center });
    }
    v.push(Item::Split { left: format!("No. {}", row.voucher_number), right: fmt_date(&row.voucher_date), bold: true });
    v.push(Item::Rule { solid: false });
    v.push(Item::Pair { label: "Vehicle No.".into(), value: row.vehicle_number.clone(), big: true });
    v.push(Item::Pair { label: "Wheel Type".into(), value: row.wheel_type.clone(), big: false });
    if !row.material.is_empty() {
        v.push(Item::Pair { label: "Material".into(), value: row.material.clone(), big: false });
    }
    if !row.mobile_number.is_empty() {
        v.push(Item::Pair { label: "Mobile".into(), value: row.mobile_number.clone(), big: false });
    }
    v.push(Item::Rule { solid: false });
    v.push(Item::Pair { label: "Weight".into(), value: fmt_kg(row.lcd_number), big: true });
    if fw != 0.0 {
        v.push(Item::Pair { label: if tare { "Tare Weight" } else { "First Weight" }.into(), value: fmt_kg(fw), big: false });
        if let Some(d) = row.first_weight_date.as_deref().filter(|d| !d.is_empty()) {
            v.push(Item::Pair { label: if tare { "Tare Date" } else { "First Weight Date" }.into(), value: fmt_date(d), big: false });
        }
        v.push(Item::Pair { label: "Net Weight".into(), value: fmt_kg(row.net_weight()), big: true });
    }
    v.push(Item::Rule { solid: false });
    let currency = if o.currency.is_empty() { "₹" } else { o.currency.as_str() };
    v.push(Item::Pair { label: "Amount".into(), value: format!("{currency} {:.2}", row.amount), big: true });
    if let Some(p) = o.photo.as_ref().filter(|p| crate::camera::is_jpeg(p)) {
        v.push(Item::Photo(p.clone()));
    }
    v.push(Item::Rule { solid: true });
    v.push(Item::Text { text: "The above weights are recorded accurately and truthfully.".into(), size: base - 2.5, bold: false, align: Align::Left });
    v.push(Item::Signatures);
    if !o.footer.is_empty() {
        v.push(Item::Gap(2.0));
        v.push(Item::Text { text: o.footer.clone(), size: base, bold: false, align: Align::Center });
    }
    v
}

/// The voucher as plain text lines for a dot-matrix (or any text-only) printer. "₹" is printed as
/// "Rs." since these printers have no such character. No photo.
pub fn text_lines(items: &[Item], width: usize) -> Vec<(String, bool)> {
    let w = width.max(24);
    let ascii = |s: &str| -> String { s.replace('₹', "Rs.").chars().map(|c| if c.is_ascii() { c } else { '?' }).collect() };
    let center = |s: &str| -> String {
        let s: String = s.chars().take(w).collect();
        let pad = (w - s.chars().count()) / 2;
        format!("{}{}", " ".repeat(pad), s)
    };
    let both = |l: &str, r: &str| -> String {
        let (l, r) = (ascii(l), ascii(r));
        let used = l.chars().count() + r.chars().count();
        if used + 1 > w {
            format!("{l} {r}")
        } else {
            format!("{l}{}{r}", " ".repeat(w - used))
        }
    };
    let mut out = Vec::new();
    for it in items {
        match it {
            Item::Text { text, bold, align, .. } => {
                let t = ascii(text);
                // wrap long lines (the declaration)
                let mut line = String::new();
                for word in t.split_whitespace() {
                    if !line.is_empty() && line.chars().count() + 1 + word.chars().count() > w {
                        out.push((if *align == Align::Center { center(&line) } else { line.clone() }, *bold));
                        line.clear();
                    }
                    if !line.is_empty() {
                        line.push(' ');
                    }
                    line.push_str(word);
                }
                out.push((if *align == Align::Center { center(&line) } else { line }, *bold));
            }
            Item::Pair { label, value, big } => out.push((both(label, value), *big)),
            Item::Split { left, right, bold } => out.push((both(left, right), *bold)),
            Item::Rule { solid } => out.push(((if *solid { "=" } else { "-" }).repeat(w), false)),
            Item::Gap(_) => out.push((String::new(), false)),
            Item::Photo(_) => {}
            Item::Signatures => {
                out.push((String::new(), false));
                out.push((String::new(), false));
                out.push((both("Driver", "Operator"), false));
            }
        }
    }
    out
}

pub fn pdf_file_name(row: &Weighing) -> String {
    let safe = |s: &str| -> String { s.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-').collect() };
    let parts: Vec<String> = [safe(&row.vehicle_number), safe(&row.voucher_number), safe(&row.mobile_number)].into_iter().filter(|s| !s.is_empty()).collect();
    format!("{}.pdf", parts.join("-"))
}

#[cfg(test)]
mod tests {
    use super::*;

    pub fn sample() -> Weighing {
        Weighing {
            id: "t".into(),
            voucher_number: "000123".into(),
            voucher_date: "2026-09-30 14:05:09".into(),
            vehicle_number: "KL07AB1234".into(),
            wheel_type: "10 WHEEL".into(),
            material: "Sand".into(),
            lcd_number: 18250.0,
            first_weight: 7120.0,
            first_weight_date: Some("2026-09-30 09:00:00".into()),
            first_weight_kind: Some("previous".into()),
            amount: 0.0,
            ..Default::default()
        }
    }

    #[test]
    fn numbers_and_dates() {
        assert_eq!(fmt_num(1234567.0), "12,34,567");
        assert_eq!(fmt_num(18250.0), "18,250");
        assert_eq!(fmt_num(12.5), "12.5");
        assert_eq!(fmt_num(-150.0), "-150");
        assert_eq!(fmt_num(999.0), "999");
        assert_eq!(fmt_date("2026-09-30 14:05:09"), "30/09/2026 14:05");
    }

    #[test]
    fn voucher_content() {
        let items = layout(&sample(), &VoucherOptions { header: vec!["ACME WEIGHBRIDGE".into(), "Kochi".into()], ..Default::default() });
        let text: Vec<String> = text_lines(&items, 40).into_iter().map(|l| l.0).collect();
        let all = text.join("\n");
        assert!(all.contains("ACME WEIGHBRIDGE"));
        assert!(all.contains("No. 000123") && all.contains("30/09/2026 14:05"));
        assert!(all.contains("Net Weight") && all.contains("11,130 kg"));
        assert!(all.contains("Amount") && all.contains("Rs. 0.00"));
        assert!(text.iter().all(|l| l.chars().count() <= 40), "{all}");
        assert!(all.lines().any(|l| l.starts_with("Driver") && l.ends_with("Operator")));
    }

    #[test]
    fn tare_labels_and_no_first_weight() {
        let mut r = sample();
        r.first_weight_kind = Some("tare".into());
        let all: String = text_lines(&layout(&r, &VoucherOptions::default()), 40).into_iter().map(|l| l.0 + "\n").collect();
        assert!(all.contains("Tare Weight") && all.contains("Tare Date"));
        r.first_weight = 0.0;
        let all: String = text_lines(&layout(&r, &VoucherOptions::default()), 40).into_iter().map(|l| l.0 + "\n").collect();
        assert!(!all.contains("Net Weight"));
    }

    #[test]
    fn pdf_name() {
        let mut r = sample();
        r.mobile_number = "9876543210".into();
        assert_eq!(pdf_file_name(&r), "KL07AB1234-000123-9876543210.pdf");
    }
}
