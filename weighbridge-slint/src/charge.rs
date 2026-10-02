// What a weighing costs. Mirrors the Qt weighbridge screen (nexsol-pos, NWeighBridgeMain) and the
// Electron app (electron/charge.js):
//
//   fresh weighing                                      → full rate
//   previous weighing picked, still open (round_trip 0) → 0 (the paid first weighing's free return)
//   previous weighing picked, already closed (1)        → full rate
//   saved tare weight used                              → full rate
//
// The amount is never typed by the operator.

#[derive(Debug, Clone, PartialEq)]
pub struct Rate {
    pub id: String,
    pub wheel_type: String,
    pub wheel_rate: f64,
    pub voucher_date: String,
}

/// A wheel type for comparing: "10 Wheel", "10WHEEL" and "10 WHEEL " are the same type. Old
/// (Qt) weighings and the web admin don't always spell it the way the rates do.
pub fn wheel_key(wheel_type: &str) -> String {
    wheel_type.to_uppercase().chars().filter(|c| c.is_alphanumeric()).collect()
}

/// Newest positive rate for a wheel type.
pub fn rate_for(rates: &[Rate], wheel_type: &str) -> f64 {
    let key = wheel_key(wheel_type);
    if key.is_empty() {
        return 0.0;
    }
    let mut best: Option<&Rate> = None;
    for r in rates {
        if wheel_key(&r.wheel_type) != key || !(r.wheel_rate > 0.0) {
            continue;
        }
        if best.is_none_or(|b| r.voucher_date > b.voucher_date) {
            best = Some(r);
        }
    }
    best.map(|r| r.wheel_rate).unwrap_or(0.0)
}

/// Newest rate per wheel type, for the wheel type picker, sorted by wheel type.
pub fn current_rates(rates: &[Rate]) -> Vec<(String, f64)> {
    let mut types: Vec<String> = Vec::new();
    for r in rates {
        if !r.wheel_type.is_empty() && !types.contains(&r.wheel_type) {
            types.push(r.wheel_type.clone());
        }
    }
    let mut out: Vec<(String, f64)> = types.into_iter().map(|t| { let rate = rate_for(rates, &t); (t, rate) }).filter(|(_, r)| *r > 0.0).collect();
    out.sort_by(|a, b| a.0.cmp(&b.0));
    out
}

#[derive(Debug, Clone, PartialEq)]
pub enum Source {
    None,
    Previous { round_trip: i64 },
    Tare,
}

pub struct Quote {
    pub amount: f64,
    pub reason: &'static str,
}

pub fn quote(rate: f64, source: &Source) -> Quote {
    match source {
        Source::Previous { round_trip } if *round_trip != 1 => Quote { amount: 0.0, reason: "Return weighing of a paid first weighing" },
        Source::Previous { .. } => Quote { amount: rate, reason: "That weighing was already used for a return" },
        Source::Tare => Quote { amount: rate, reason: "Saved tare weight" },
        Source::None => Quote { amount: rate, reason: "New weighing" },
    }
}

/// round_trip stored on the new row: 1 when it pairs with a first weight (previous or tare).
pub fn round_trip_for(source: &Source) -> i64 {
    match source {
        Source::None => 0,
        _ => 1,
    }
}

pub fn net_weight(weight: f64, first_weight: f64) -> f64 {
    if first_weight == 0.0 { 0.0 } else { (weight - first_weight).abs() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decision_table() {
        assert_eq!(quote(100.0, &Source::None).amount, 100.0);
        assert_eq!(quote(100.0, &Source::Previous { round_trip: 0 }).amount, 0.0);
        assert_eq!(quote(100.0, &Source::Previous { round_trip: 1 }).amount, 100.0);
        assert_eq!(quote(100.0, &Source::Tare).amount, 100.0);
        assert_eq!(round_trip_for(&Source::Tare), 1);
        assert_eq!(net_weight(17000.0, 5000.0), 12000.0);
        assert_eq!(net_weight(17000.0, 0.0), 0.0);
    }
}
