// Ties the Slint window (ui/*.slint) to the app (app.rs). The window only shows the WB global's
// properties and forwards clicks; everything here runs on the UI thread, and anything slow
// (network, printer, database work that may wait) runs on a worker thread and comes back with
// slint::invoke_from_event_loop.

use crate::app::{Core, SaveForm, UiEvent};
use crate::camera::CameraSettings;
use crate::indicator::parser::Reading;
use crate::indicator::profiles::{preset_by_id, presets, Profile};
use crate::settings::{PrintSettings, WeighingSettings};
use crate::store::{normalize_vehicle, HistoryWeighing, Pick, Tare};
use crate::voucher::{fmt_date, fmt_num};
use crate::{dialogs, paths};
use serde_json::{json, Value};
use slint::{ComponentHandle, Model, ModelRc, SharedString, VecModel};
use std::cell::RefCell;
use std::collections::VecDeque;
use std::rc::Rc;
use std::sync::Arc;
use std::time::{Duration, Instant};

slint::include_modules!();

/// What the screens show that only the UI thread needs.
#[derive(Default)]
struct View {
    reading: Option<Reading>,
    reading_seen: Option<Instant>,
    signal: bool,
    ind_state: String,
    ind_message: String,
    last_quote_weight: f64,
    history: Vec<HistoryWeighing>,
    hist_tares: Vec<Tare>,
    source_id: String,
    kind: String,
    lookup_gen: u64,
    tare_gen: u64,
    tares: Vec<Tare>,
    report_ids: Vec<String>,
    monitor: VecDeque<String>,
    saved_camera: Option<CameraSettings>,
    toasts: Option<Rc<VecModel<Toast>>>,
}

struct App {
    win: slint::Weak<AppWindow>,
    core: Arc<Core>,
    view: View,
    lookup_timer: slint::Timer,
    tare_timer: slint::Timer,
}

thread_local! {
    static APP: RefCell<Option<App>> = const { RefCell::new(None) };
    // apart from APP, so work can be started from inside `with`
    static CORE: RefCell<Option<Arc<Core>>> = const { RefCell::new(None) };
}

/// Runs `f` with the app on the UI thread. Never call it from inside another `with`.
fn with<R>(f: impl FnOnce(&mut App, &AppWindow) -> R) -> Option<R> {
    APP.with(|a| {
        let mut b = a.borrow_mut();
        let app = b.as_mut()?;
        let w = app.win.upgrade()?;
        Some(f(app, &w))
    })
}

fn core() -> Option<Arc<Core>> {
    CORE.with(|c| c.borrow().clone())
}

/// Work off the UI thread, then `done` back on it.
fn bg<T: Send + 'static>(work: impl FnOnce(&Core) -> T + Send + 'static, done: impl FnOnce(&mut App, &AppWindow, T) + Send + 'static) {
    let Some(c) = core() else { return };
    std::thread::spawn(move || {
        let out = work(&c);
        let _ = slint::invoke_from_event_loop(move || {
            with(|a, w| done(a, w, out));
        });
    });
}

fn ss(s: impl AsRef<str>) -> SharedString {
    SharedString::from(s.as_ref())
}

fn strings(v: impl IntoIterator<Item = String>) -> ModelRc<SharedString> {
    ModelRc::new(VecModel::from(v.into_iter().map(SharedString::from).collect::<Vec<_>>()))
}

fn rows(v: Vec<TableRow>) -> ModelRc<TableRow> {
    ModelRc::new(VecModel::from(v))
}

fn row(id: &str, cells: Vec<String>, tag: &str, tag_kind: &str, highlight: bool, selected: bool) -> TableRow {
    TableRow { id: ss(id), cells: strings(cells), tag: ss(tag), tag_kind: ss(tag_kind), highlight, selected }
}

fn kg(v: f64) -> String {
    format!("{} kg", fmt_num(v))
}

fn rupees(v: f64) -> String {
    format!("₹ {v:.2}")
}

/// Numbers as the Electron settings screen showed them: 9600, not 9600.0.
fn num(v: Option<f64>) -> String {
    v.map(|n| if n.fract() == 0.0 { format!("{}", n as i64) } else { n.to_string() }).unwrap_or_default()
}

fn parse(s: &str) -> Option<f64> {
    s.trim().replace(',', ".").parse().ok()
}

fn toast(w: &AppWindow, a: &mut App, kind: &str, text: impl Into<String>) {
    let text = text.into();
    let model = a.view.toasts.get_or_insert_with(|| Rc::new(VecModel::default())).clone();
    w.global::<WB>().set_toasts(ModelRc::from(model.clone()));
    if model.row_count() >= 4 {
        model.remove(0);
    }
    model.push(Toast { text: ss(&text), kind: ss(kind) });
    let m = Rc::downgrade(&model);
    slint::Timer::single_shot(Duration::from_millis(if kind == "error" || kind == "warning" { 7000 } else { 4000 }), move || {
        if let Some(m) = m.upgrade() {
            if m.row_count() > 0 {
                m.remove(0);
            }
        }
    });
}

fn ask(w: &AppWindow, kind: &str, title: &str, text: &str, ok: &str) {
    let g = w.global::<WB>();
    g.set_ask_title(ss(title));
    g.set_ask_text(ss(text));
    g.set_ask_ok(ss(ok));
    g.set_ask_kind(ss(kind));
}

// ── screens ──────────────────────────────────────────────────────────────────
fn show_screen(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let server = a.core.server.state();
    let auth = a.core.auth();
    let screen = if !server.confirmed {
        "server"
    } else if !auth.signed_in() {
        "login"
    } else if auth.branch_code.is_empty() {
        "branch"
    } else {
        "main"
    };
    g.set_screen(ss(screen));
    g.set_server_address(ss(&server.api_server));
    g.set_login_subtitle(ss(if auth.branch_code.is_empty() { server.api_server.clone() } else { format!("Branch {}  ·  {}", auth.branch_code, server.api_server) }));
    g.set_branch(ss(&auth.branch_code));
    g.set_user(ss(&auth.username));
    g.set_is_admin(auth.is_admin());
    match screen {
        "branch" => load_branches(),
        "main" => {
            load_rates(a, w);
            let cam = a.core.camera_settings();
            g.set_camera_on(cam.source != "none");
            a.core.set_preview(cam.source != "none");
            refresh_lock(a, w);
            refresh_sync(a, w);
            if g.get_tab() == "settings" {
                load_settings(a, w);
            }
            w.invoke_focus_vehicle();
        }
        _ => {}
    }
}

fn load_branches() {
    bg(
        |c| c.branches(),
        |a, w, r| {
            let g = w.global::<WB>();
            match r {
                Ok(list) => {
                    g.set_branch_names(strings(list.iter().map(|b| if b.name.is_empty() || b.name == b.code { b.code.clone() } else { format!("{}  ·  {}", b.code, b.name) })));
                    g.set_branch_codes(strings(list.iter().map(|b| b.code.clone())));
                    if list.len() == 1 {
                        g.set_branch_code(ss(&list[0].code));
                    }
                    if list.is_empty() {
                        g.set_branch_error(ss("No branches found for this sign-in"));
                    }
                }
                Err(e) => g.set_branch_error(ss(e.to_string())),
            }
            let _ = a;
        },
    );
}

// ── header ───────────────────────────────────────────────────────────────────
fn refresh_sync(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let s = a.core.sync.state();
    let pending = s.pending.weights + s.pending.tares;
    let (text, kind) = if s.needs_login {
        ("Sign in again to sync", "warning")
    } else if s.online == Some(false) {
        ("Offline", "error")
    } else if pending > 0 {
        ("Syncing", "warning")
    } else {
        ("Synced", "success")
    };
    g.set_sync_text(ss(text));
    g.set_sync_kind(ss(kind));
    g.set_pending(pending as i32);
    let mut tip = format!("{pending} waiting to upload");
    if let Some(t) = &s.last_sync_at {
        tip.push_str(&format!(" · last sync {}", fmt_date(t)));
    }
    if !s.last_error.is_empty() {
        tip.push_str(&format!(" · {}", s.last_error));
    }
    g.set_sync_tip(ss(&tip));
    let mut waiting = format!("{} weighings, {} tare weights, {} bridge events", s.pending.weights, s.pending.tares, s.pending.engage);
    if s.pending.photos > 0 {
        waiting.push_str(&format!(", {} camera photos", s.pending.photos));
    }
    g.set_data_waiting(ss(waiting));
    let mut last = s.last_sync_at.as_deref().map(fmt_date).unwrap_or_else(|| "never".into());
    if !s.last_error.is_empty() {
        last.push_str(&format!(" · {}", s.last_error));
    }
    g.set_data_last_sync(ss(last));
}

fn refresh_update(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let u = a.core.updater.state();
    g.set_update_ready(u.status == "ready");
    g.set_update_version(ss(&u.version));
    g.set_update_busy(u.status == "checking" || u.status == "downloading");
    let mut v = a.core.version.clone();
    if u.status == "ready" {
        v.push_str(&format!(" · version {} downloaded, restart to update", u.version));
    } else if u.status == "downloading" {
        v.push_str(&format!(" · downloading version {}…", u.version));
    }
    g.set_data_version(ss(v));
}

fn refresh_lock(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let l = a.core.lock_state();
    g.set_settings_locked(l.locked);
    if l.locked && g.get_tab() == "settings" {
        g.set_tab(ss("weigh"));
    }
    let banner = if l.server_supports && (l.locks_on_restart || !l.setup_done || l.unlocked) {
        if l.locks_on_restart {
            "Settings lock when the app is next started. To change them after that, an admin allows it in the web admin (Weighbridge PCs).".to_string()
        } else if l.unlocked {
            format!(
                "Settings were opened from the web admin{}. They lock again after you save and restart the app.",
                if l.unlocked_by.is_empty() { String::new() } else { format!(" by {}", l.unlocked_by) }
            )
        } else {
            "Settings lock after the first save, from the next start. After that, only the web admin (Weighbridge PCs) can open them.".to_string()
        }
    } else {
        String::new()
    };
    g.set_lock_banner(ss(banner));
    let admin = a.core.is_admin();
    g.set_rates_can_edit(a.core.lock.rates_allowed(admin));
    g.set_rates_note(ss(if l.rates_managed {
        "Rates are set in the web admin (Weighbridge Rates). This PC can only view them. An admin can allow rate changes here from Weighbridge PCs."
    } else {
        "Only an admin can change rates."
    }));
}

// ── weight ───────────────────────────────────────────────────────────────────
fn fresh(v: &View) -> bool {
    v.signal && v.reading.is_some() && v.reading_seen.is_some_and(|t| t.elapsed() < Duration::from_secs(5))
}

fn refresh_weight(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let v = &a.view;
    let connected = v.ind_state == "connected";
    let f = fresh(v);
    let r = v.reading.clone();
    g.set_weight_text(ss(match (&r, f) {
        (Some(r), true) => fmt_num(r.weight),
        _ => "------".into(),
    }));
    let state = match (&r, f) {
        (Some(r), true) if r.overload => "overload",
        (Some(r), true) if r.stable => "stable",
        (Some(_), true) => "moving",
        _ => "off",
    };
    g.set_weight_state(ss(state));
    g.set_simulated(r.as_ref().is_some_and(|r| r.simulated) && f);
    let (tag, kind) = if !connected && !(f && r.as_ref().is_some_and(|r| r.simulated)) {
        (if v.ind_message.is_empty() { "Indicator not connected".to_string() } else { v.ind_message.clone() }, "error")
    } else if !f {
        ("No signal from indicator".to_string(), "warning")
    } else {
        match state {
            "overload" => ("OVERLOAD".to_string(), "error"),
            "stable" => ("STABLE".to_string(), "success"),
            _ => ("MOVING".to_string(), "warning"),
        }
    };
    g.set_weight_tag(ss(tag));
    g.set_weight_tag_kind(ss(kind));
    g.set_indicator_message(ss(if connected { v.ind_message.clone() } else { String::new() }));
    g.set_ind_connected(connected);
    g.set_ind_status(ss(if connected {
        format!("Connected · {}", v.ind_message)
    } else if v.ind_message.is_empty() {
        "Not connected".into()
    } else {
        v.ind_message.clone()
    }));
    refresh_can_save(a, w);
}

fn refresh_can_save(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let v = &a.view;
    let f = fresh(v);
    let r = v.reading.clone();
    let weight = if f { r.as_ref().map(|r| r.weight).unwrap_or(0.0) } else { 0.0 };
    let vehicle = g.get_vehicle().to_string();
    let wheel = g.get_wheel().to_string();
    let good = f && r.as_ref().is_some_and(|r| r.stable && !r.overload) && weight > 0.0;
    let picked = v.kind == "none" || !v.source_id.is_empty();
    g.set_can_save(good && !vehicle.is_empty() && !wheel.is_empty() && picked);
    g.set_can_tare(f && r.as_ref().is_some_and(|r| r.stable) && !vehicle.is_empty());
    let hint = if vehicle.is_empty() {
        "Enter the vehicle number."
    } else if wheel.is_empty() {
        "Select the wheel type."
    } else if !picked {
        if v.kind == "tare" { "Pick a saved tare weight." } else { "Pick the previous weighing on the right." }
    } else if !f {
        "Waiting for a reading from the weighbridge."
    } else if r.as_ref().is_some_and(|r| r.overload) {
        "The indicator shows overload."
    } else if !(weight > 0.0) {
        "No weight on the bridge."
    } else if !r.as_ref().is_some_and(|r| r.stable) {
        "Waiting for the weight to settle."
    } else {
        ""
    };
    g.set_hint(ss(hint));
    // tare screen
    let tv = g.get_tare_vehicle().to_string();
    let tw = g.get_tare_wheel().to_string();
    g.set_tare_can_save(good && !tv.is_empty() && !tw.is_empty());
    // amount and weights follow the live weight
    if (weight - a.view.last_quote_weight).abs() > f64::EPSILON {
        a.view.last_quote_weight = weight;
        refresh_quote(a, w);
    }
}

fn pick(v: &View) -> Pick {
    match v.kind.as_str() {
        "previous" if !v.source_id.is_empty() => Pick::Previous(v.source_id.clone()),
        "tare" if !v.source_id.is_empty() => Pick::Tare(v.source_id.clone()),
        _ => Pick::None,
    }
}

fn refresh_quote(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let weight = if fresh(&a.view) { a.view.reading.as_ref().map(|r| r.weight).unwrap_or(0.0) } else { 0.0 };
    let wheel = g.get_wheel().to_string();
    let q = a.core.quote(&g.get_vehicle(), &wheel, &pick(&a.view), weight);
    g.set_amount_text(ss(rupees(q.amount)));
    g.set_reason_text(ss(if wheel.is_empty() { "Select the wheel type".to_string() } else { q.reason.clone() }));
    g.set_first_text(ss(if q.first_weight != 0.0 { kg(q.first_weight) } else { "—".into() }));
    g.set_first_sub(ss(if q.first_weight_date.is_empty() { String::new() } else { fmt_date(&q.first_weight_date) }));
    g.set_net_text(ss(if q.net_weight != 0.0 { kg(q.net_weight) } else { "—".into() }));
}

// ── weighing form ────────────────────────────────────────────────────────────
fn load_rates(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let rates = a.core.rates();
    g.set_wheel_labels(strings(rates.iter().map(|(t, r)| format!("{t}  ·  ₹{}", fmt_num(*r)))));
    g.set_wheel_values(strings(rates.iter().map(|(t, _)| t.clone())));
    g.set_rate_rows(rows(rates.iter().map(|(t, r)| row(t, vec![t.clone(), rupees(*r)], "", "", false, false)).collect()));
}

fn render_history(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let v = &a.view;
    let open_id = v.history.iter().find(|h| h.round_trip == 0).map(|h| h.id.clone()).unwrap_or_default();
    g.set_history(rows(
        v.history
            .iter()
            .map(|h| {
                let open = h.id == open_id;
                row(
                    &h.id,
                    vec![h.voucher_number.clone(), fmt_date(&h.voucher_date), kg(h.weight), format!("₹{:.0}", h.amount)],
                    if open { "Open · free return" } else { "Closed" },
                    if open { "success" } else { "default" },
                    open,
                    v.kind == "previous" && v.source_id == h.id,
                )
            })
            .collect(),
    ));
    g.set_hist_tares(rows(
        v.hist_tares
            .iter()
            .map(|t| row(&t.id, vec![t.voucher_number.clone(), fmt_date(&t.voucher_date), kg(t.tare_weight)], "", "", false, v.kind == "tare" && v.source_id == t.id))
            .collect(),
    ));
    let vehicle = g.get_vehicle();
    g.set_history_title(ss(if v.kind == "tare" {
        format!("Saved tare weights · {vehicle}")
    } else if vehicle.is_empty() {
        "Previous weighings".into()
    } else {
        format!("Previous weighings · {vehicle}")
    }));
}

/// Vehicle typed (or a save / reopen changed its history): suggestions, its wheel type lock and
/// its history, a moment after the last key.
fn lookup_vehicle(a: &mut App) {
    a.view.lookup_gen += 1;
    let ticket = a.view.lookup_gen;
    a.lookup_timer.start(slint::TimerMode::SingleShot, Duration::from_millis(250), move || {
        let Some(v) = with(|_, w| w.global::<WB>().get_vehicle().to_string()) else { return };
        bg(
            move |c| (c.vehicles(&v), if v.is_empty() { None } else { Some(c.history(&v)) }, v),
            move |a, w, (veh, hist, v)| {
                if a.view.lookup_gen != ticket {
                    return;
                }
                let g = w.global::<WB>();
                g.set_vehicle_suggestions(ModelRc::new(VecModel::from(
                    veh.iter()
                        .filter(|(n, _)| *n != v)
                        .map(|(n, t)| Choice { value: ss(n), label: ss(if t.is_empty() { n.clone() } else { format!("{n}  ·  {t}") }) })
                        .collect::<Vec<_>>(),
                )));
                match hist {
                    Some(h) => {
                        a.view.history = h.weights;
                        a.view.hist_tares = h.tares;
                        g.set_wheel_locked(h.wheel_locked);
                        if h.wheel_locked {
                            g.set_wheel(ss(&h.wheel_type));
                        }
                    }
                    None => {
                        a.view.history.clear();
                        a.view.hist_tares.clear();
                        g.set_wheel_locked(false);
                    }
                }
                render_history(a, w);
                refresh_quote(a, w);
                refresh_can_save(a, w);
            },
        );
    });
}

fn clear_form(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    g.set_vehicle(ss(""));
    g.set_wheel(ss(""));
    g.set_material(ss(""));
    g.set_mobile(ss(""));
    g.set_kind(ss("none"));
    g.set_wheel_locked(false);
    g.set_vehicle_popup(false);
    g.set_material_popup(false);
    a.view.kind = "none".into();
    a.view.source_id.clear();
    a.view.history.clear();
    a.view.hist_tares.clear();
    render_history(a, w);
    refresh_quote(a, w);
    refresh_can_save(a, w);
    lookup_vehicle(a);
}

fn save(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    if !g.get_can_save() || g.get_saving() {
        return;
    }
    g.set_saving(true);
    let form = SaveForm {
        vehicle_number: g.get_vehicle().to_string(),
        wheel_type: g.get_wheel().to_string(),
        material: g.get_material().to_string(),
        mobile_number: g.get_mobile().to_string(),
        source: pick(&a.view),
    };
    bg(
        move |c| c.save(form),
        |a, w, r| {
            let g = w.global::<WB>();
            g.set_saving(false);
            match r {
                Ok(out) => {
                    let row = &out.row;
                    g.set_last(LastVoucher {
                        shown: true,
                        id: ss(&row.id),
                        voucher: ss(&row.voucher_number),
                        vehicle: ss(&row.vehicle_number),
                        weight: ss(kg(row.lcd_number)),
                        net: ss(if row.first_weight != 0.0 { format!("Net {}", kg(row.net_weight())) } else { String::new() }),
                        amount: ss(rupees(row.amount)),
                        printed: out.print.printed,
                        photo: out.photo,
                    });
                    if !out.print.error.is_empty() {
                        toast(w, a, "warning", format!("Saved voucher {}, but printing failed: {}", row.voucher_number, out.print.error));
                    } else {
                        toast(w, a, "success", format!("Saved voucher {}", row.voucher_number));
                    }
                    if !out.photo_error.is_empty() {
                        toast(w, a, "warning", format!("No camera photo for voucher {}: {}", row.voucher_number, out.photo_error));
                    }
                    clear_form(a, w);
                    w.invoke_focus_vehicle();
                }
                Err(e) => toast(w, a, "error", e.to_string()),
            }
        },
    );
}

// ── tare weights ─────────────────────────────────────────────────────────────
fn load_tares(a: &mut App, w: &AppWindow) {
    a.view.tares = a.core.tares();
    render_tares(a, w);
}

fn render_tares(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let filter = normalize_vehicle(&g.get_tare_filter());
    g.set_tare_rows(rows(
        a.view
            .tares
            .iter()
            .filter(|t| filter.is_empty() || t.vehicle_number.contains(&filter))
            .take(500)
            .map(|t| {
                row(
                    &t.id,
                    vec![t.voucher_number.clone(), fmt_date(&t.voucher_date), t.vehicle_number.clone(), t.wheel_type.clone(), kg(t.tare_weight)],
                    if t.synced != 0 { "Uploaded" } else { "Waiting" },
                    if t.synced != 0 { "success" } else { "warning" },
                    false,
                    false,
                )
            })
            .collect(),
    ));
}

fn lookup_tare_vehicle(a: &mut App) {
    a.view.tare_gen += 1;
    let ticket = a.view.tare_gen;
    a.tare_timer.start(slint::TimerMode::SingleShot, Duration::from_millis(250), move || {
        let Some(v) = with(|_, w| w.global::<WB>().get_tare_vehicle().to_string()) else { return };
        if v.is_empty() {
            with(|_, w| w.global::<WB>().set_tare_wheel_locked(false));
            return;
        }
        bg(
            move |c| c.history(&v),
            move |a, w, h| {
                if a.view.tare_gen != ticket {
                    return;
                }
                let g = w.global::<WB>();
                g.set_tare_wheel_locked(h.wheel_locked);
                if h.wheel_locked {
                    g.set_tare_wheel(ss(&h.wheel_type));
                }
                refresh_can_save(a, w);
            },
        );
    });
}

fn save_tare(w: &AppWindow, vehicle: String, wheel: String, from_weighing: bool) {
    w.global::<WB>().set_tare_saving(true);
    bg(
        move |c| c.save_tare(&vehicle, &wheel),
        move |a, w, r| {
            let g = w.global::<WB>();
            g.set_tare_saving(false);
            match r {
                Ok(t) => {
                    toast(w, a, "success", format!("Tare weight {} saved ({})", kg(t.tare_weight), t.voucher_number));
                    if from_weighing {
                        lookup_vehicle(a);
                    } else {
                        g.set_tare_vehicle(ss(""));
                        g.set_tare_wheel(ss(""));
                        g.set_tare_wheel_locked(false);
                    }
                    load_tares(a, w);
                }
                Err(e) => toast(w, a, "error", e.to_string()),
            }
        },
    );
}

// ── report ───────────────────────────────────────────────────────────────────
fn day_range(offset: i64) -> (String, String) {
    let d = chrono::Local::now().date_naive() + chrono::Duration::days(offset);
    (format!("{} 00:00", d.format("%d/%m/%Y")), format!("{} 23:59", d.format("%d/%m/%Y")))
}

/// "dd/mm/yyyy[ hh:mm]" → "yyyy-mm-dd hh:mm:ss"
fn parse_when(s: &str, end: bool) -> Option<String> {
    let s = s.trim();
    let (d, t) = s.split_once(' ').map(|(d, t)| (d, Some(t.trim()))).unwrap_or((s, None));
    let date = chrono::NaiveDate::parse_from_str(d, "%d/%m/%Y").or_else(|_| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")).ok()?;
    let time = match t {
        Some(t) if !t.is_empty() => chrono::NaiveTime::parse_from_str(t, "%H:%M").ok()?,
        _ => if end { chrono::NaiveTime::from_hms_opt(23, 59, 0)? } else { chrono::NaiveTime::from_hms_opt(0, 0, 0)? },
    };
    let mut at = date.and_time(time);
    if end {
        at += chrono::Duration::minutes(1); // the whole last minute
    }
    Some(at.format("%Y-%m-%d %H:%M:%S").to_string())
}

fn report_range(w: &AppWindow) -> Result<(String, String), String> {
    let g = w.global::<WB>();
    let from = parse_when(&g.get_report_from(), false).ok_or("Enter the From date as dd/mm/yyyy hh:mm")?;
    let to = parse_when(&g.get_report_to(), true).ok_or("Enter the To date as dd/mm/yyyy hh:mm")?;
    Ok((from, to))
}

fn load_report(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let (from, to) = match report_range(w) {
        Ok(r) => r,
        Err(e) => {
            g.set_report_error(ss(e));
            return;
        }
    };
    g.set_report_error(ss(""));
    let r = a.core.report(&from, &to);
    a.view.report_ids = r.rows.iter().map(|x| x.id.clone()).collect();
    g.set_report_count(ss(r.count.to_string()));
    g.set_report_total(ss(rupees(r.total)));
    g.set_report_last(ss(if r.last_voucher.is_empty() { "—".into() } else { r.last_voucher.clone() }));
    g.set_report_rows(rows(
        r.rows
            .iter()
            .map(|x| {
                row(
                    &x.id,
                    vec![
                        x.voucher_number.clone(),
                        fmt_date(&x.voucher_date),
                        x.vehicle_number.clone(),
                        x.wheel_type.clone(),
                        x.material.clone(),
                        fmt_num(x.lcd_number),
                        if x.first_weight != 0.0 { fmt_num(x.first_weight) } else { String::new() },
                        if x.first_weight != 0.0 { fmt_num(x.net_weight()) } else { String::new() },
                        format!("{:.2}", x.amount),
                    ],
                    if x.synced != 0 { "Uploaded" } else { "Waiting" },
                    if x.synced != 0 { "success" } else { "warning" },
                    false,
                    false,
                )
            })
            .collect(),
    ));
}

fn reprint(id: String) {
    bg(
        move |c| c.reprint(&id),
        |a, w, r| match r {
            Ok(p) if p.error.is_empty() => toast(w, a, "success", "Sent to printer"),
            Ok(p) => toast(w, a, "error", p.error),
            Err(e) => toast(w, a, "error", e.to_string()),
        },
    );
}

// ── settings ─────────────────────────────────────────────────────────────────
fn load_settings(a: &mut App, w: &AppWindow) {
    load_indicator_form(a, w);
    load_print_form(a, w);
    let g = w.global::<WB>();
    let ws = a.core.weighing_settings();
    g.set_require_stable(ws.require_stable);
    g.set_simulator(ws.simulator);
    load_camera_form(a, w);
    let auth = a.core.auth();
    g.set_data_server(ss(a.core.server.state().api_server));
    g.set_data_company(ss(&auth.tenant_id));
    refresh_update(a, w);
    refresh_sync(a, w);
    load_server_copy();
}

fn load_server_copy() {
    bg(
        |c| (c.server_copy(), c.lock_state(), c.is_admin()),
        |_, w, (r, lock, admin)| {
            let g = w.global::<WB>();
            let Ok(copy) = r else {
                g.set_server_copy_shown(false);
                return;
            };
            g.set_server_copy_shown(copy.supported);
            let text = if copy.found {
                let from = if copy.this_pc { "this PC".to_string() } else if copy.machine_name.is_empty() { "another PC at this branch".into() } else { copy.machine_name.clone() };
                let mut t = format!("Copy on the server: saved {}from {from}", if copy.saved_at.is_empty() { String::new() } else { format!("{} ", show_iso(&copy.saved_at)) });
                if !copy.saved_by.is_empty() {
                    t.push_str(&format!(" by {}", copy.saved_by));
                }
                t.push('.');
                if lock.backup_pending {
                    t.push_str(" Latest changes not sent yet.");
                }
                t
            } else {
                "No copy of these settings on the server yet. One is sent when settings are saved.".into()
            };
            g.set_server_copy_text(ss(text));
            g.set_can_fetch_copy(copy.found && admin && !lock.locked);
        },
    );
}

/// A server time (ISO, UTC or local) as "dd/mm/yyyy hh:mm" local.
fn show_iso(s: &str) -> String {
    crate::store::from_server_date(s).map(|d| fmt_date(&d)).unwrap_or_else(|| s.to_string())
}

fn ind_form(preset_id: &str, p: &Profile) -> IndForm {
    let t = &p.transport;
    let d = &p.decode;
    IndForm {
        preset: ss(preset_id),
        conn: ss(if t.kind == "tcp" { "tcp" } else { "serial" }),
        path: ss(&t.path),
        baud: ss(num(t.baud_rate)),
        data_bits: ss(num(t.data_bits)),
        parity: ss(if t.parity.is_empty() { "none" } else { &t.parity }),
        stop_bits: ss(num(t.stop_bits)),
        flow: ss(if t.flow_control.is_empty() { "none" } else { &t.flow_control }),
        dtr: t.dtr != Some(false),
        rts: t.rts != Some(false),
        host: ss(&t.host),
        port: ss(num(t.port)),
        mode: ss(if p.mode.is_empty() { "continuous" } else { &p.mode }),
        poll_command: ss(&p.poll.command),
        poll_interval: ss(num(p.poll.interval_ms)),
        frame_type: ss(if p.frame.kind.is_empty() { "delimited" } else { &p.frame.kind }),
        frame_start: ss(&p.frame.start),
        frame_end: ss(&p.frame.end),
        frame_length: ss(num(p.frame.length)),
        decode_type: ss(if d.kind.is_empty() { "regex" } else { &d.kind }),
        pattern: ss(&d.pattern),
        reverse: d.reverse.unwrap_or(false),
        stable_pattern: ss(&d.stable_pattern),
        motion_pattern: ss(&d.motion_pattern),
        weight_at: ss(num(d.weight_at)),
        weight_length: ss(num(d.weight_length)),
        sign_at: ss(num(d.sign_at)),
        decimals_at: ss(num(d.decimals_at)),
        unit_from_status: d.unit_from_status.unwrap_or(false),
        unit: ss(if p.unit.is_empty() { "kg" } else { &p.unit }),
        implied_decimals: ss(num(p.implied_decimals)),
        decimal_comma: p.decimal_comma.unwrap_or(false),
        multiplier: ss(num(p.multiplier)),
        resolution: ss(num(p.resolution)),
        no_signal_ms: ss(num(p.no_signal_ms)),
        stable_count: ss(num(p.stable_count)),
        stable_tol: ss(num(p.stable_tolerance_kg)),
        zero_band: ss(num(p.zero_band_kg)),
        engage: ss(num(p.engage_threshold_kg)),
    }
}

/// The edited form as the profile overrides the Electron screen saved.
fn form_overrides(f: &IndForm, base: &Profile) -> Value {
    let mut p = base.clone();
    let t = &mut p.transport;
    t.kind = f.conn.to_string();
    t.path = f.path.to_string();
    t.baud_rate = parse(&f.baud);
    t.data_bits = parse(&f.data_bits);
    t.parity = f.parity.to_string();
    t.stop_bits = parse(&f.stop_bits);
    t.flow_control = f.flow.to_string();
    t.dtr = Some(f.dtr);
    t.rts = Some(f.rts);
    t.host = f.host.trim().to_string();
    t.port = parse(&f.port);
    p.mode = f.mode.to_string();
    p.poll.command = f.poll_command.to_string();
    p.poll.interval_ms = parse(&f.poll_interval);
    p.frame.kind = f.frame_type.to_string();
    p.frame.start = f.frame_start.to_string();
    p.frame.end = f.frame_end.to_string();
    p.frame.length = parse(&f.frame_length);
    let d = &mut p.decode;
    d.kind = f.decode_type.to_string();
    d.pattern = f.pattern.to_string();
    d.reverse = Some(f.reverse);
    d.stable_pattern = f.stable_pattern.to_string();
    d.motion_pattern = f.motion_pattern.to_string();
    d.weight_at = parse(&f.weight_at);
    d.weight_length = parse(&f.weight_length);
    d.sign_at = parse(&f.sign_at);
    d.decimals_at = parse(&f.decimals_at);
    d.unit_from_status = Some(f.unit_from_status);
    p.unit = f.unit.to_string();
    p.implied_decimals = parse(&f.implied_decimals);
    p.decimal_comma = Some(f.decimal_comma);
    p.multiplier = parse(&f.multiplier);
    p.resolution = parse(&f.resolution);
    p.no_signal_ms = parse(&f.no_signal_ms);
    p.stable_count = parse(&f.stable_count);
    p.stable_tolerance_kg = parse(&f.stable_tol);
    p.zero_band_kg = parse(&f.zero_band);
    p.engage_threshold_kg = parse(&f.engage);
    p.overrides()
}

fn load_indicator_form(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let cfg = a.core.indicator_config();
    let p = a.core.profile();
    let all = presets();
    g.set_preset_names(strings(all.iter().map(|x| x["name"].as_str().unwrap_or("").to_string())));
    g.set_preset_ids(strings(all.iter().map(|x| x["id"].as_str().unwrap_or("").to_string())));
    g.set_ind(ind_form(&p.preset_id, &p));
    let _ = cfg;
    g.set_preset_help(ss(preset_by_id(&p.preset_id)["makes"].as_str().unwrap_or("")));
    load_ports(w);
}

fn load_ports(w: &AppWindow) {
    let current = w.global::<WB>().get_ind().path.to_string();
    let wk = w.as_weak();
    std::thread::spawn(move || {
        let ports = crate::indicator::transport::list_ports();
        let _ = wk.upgrade_in_event_loop(move |w| {
            let mut values: Vec<String> = ports.iter().map(|p| p.path.clone()).collect();
            let mut labels: Vec<String> = ports.iter().map(|p| if p.manufacturer.is_empty() { p.path.clone() } else { format!("{}  ·  {}", p.path, p.manufacturer) }).collect();
            if !current.is_empty() && !values.contains(&current) {
                labels.push(format!("{current} (not found)"));
                values.push(current);
            }
            let g = w.global::<WB>();
            g.set_ports(strings(values));
            g.set_port_labels(strings(labels));
        });
    });
}

/// Switching preset loads its defaults but keeps the port the cable is on.
fn preset_picked(a: &mut App, w: &AppWindow, id: &str) {
    let g = w.global::<WB>();
    let cur = g.get_ind();
    let base = a.core.profile();
    let mut current: Value = serde_json::from_value::<Value>(form_overrides(&cur, &base)).unwrap_or(json!({}));
    let preset = preset_by_id(id);
    let full = a.core.profile_value(id, &json!({}));
    for k in ["mode", "poll", "frame", "decode", "name"] {
        current[k] = full[k].clone();
    }
    if let (Some(t), Some(pt)) = (current.get_mut("transport").and_then(|t| t.as_object_mut()), preset["transport"].as_object()) {
        for (k, v) in pt {
            t.insert(k.clone(), v.clone());
        }
    }
    let p = crate::indicator::profiles::build_profile(id, &current);
    g.set_ind(ind_form(id, &p));
    g.set_preset_help(ss(preset["makes"].as_str().unwrap_or("")));
}

fn load_print_form(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let ps = a.core.print_settings();
    let mut names = vec!["Windows default printer".to_string()];
    let mut values = vec![String::new()];
    for p in a.core.printers() {
        names.push(p.clone());
        values.push(p);
    }
    if !ps.printer.is_empty() && !values.contains(&ps.printer) {
        names.push(format!("{} (not found)", ps.printer));
        values.push(ps.printer.clone());
    }
    g.set_printer_names(strings(names));
    g.set_printer_values(strings(values));
    g.set_print(PrintForm {
        printer: ss(&ps.printer),
        layout: ss(&ps.layout),
        copies: ss(ps.copies.to_string()),
        auto_print: ps.auto_print,
        keep_pdf: ps.keep_pdf,
        pdf_folder: ss(&ps.pdf_folder),
        header: ss(ps.header.join("\n")),
        footer: ss(&ps.footer),
        text_width: ss(ps.text_width.to_string()),
        form_feed: ps.form_feed,
    });
    g.set_pdf_folder_shown(ss(a.core.pdf_folder().to_string_lossy()));
}

fn print_from_form(a: &App, f: &PrintForm) -> PrintSettings {
    let mut header: Vec<String> = f.header.lines().map(|l| l.trim_end().to_string()).collect();
    while header.last().is_some_and(|l| l.is_empty()) {
        header.pop();
    }
    PrintSettings {
        printer: f.printer.to_string(),
        layout: f.layout.to_string(),
        copies: f.copies.parse().unwrap_or(1),
        auto_print: f.auto_print,
        keep_pdf: f.keep_pdf,
        pdf_folder: f.pdf_folder.to_string(),
        header,
        footer: f.footer.to_string(),
        text_width: f.text_width.trim().parse().unwrap_or(40).clamp(24, 136),
        form_feed: f.form_feed,
        ..a.core.print_settings()
    }
}

fn load_camera_form(a: &mut App, w: &AppWindow) {
    let g = w.global::<WB>();
    let c = a.core.camera_settings();
    g.set_cam(CamForm { source: ss(&c.source), device: ss(&c.device_label), url: ss(&c.url), upload: c.upload, print_photo: c.print_photo });
    a.view.saved_camera = Some(c);
    g.set_cam_dirty(false);
    load_webcams();
}

fn load_webcams() {
    bg(
        |c| c.webcams(),
        |a, w, mut names| {
            let g = w.global::<WB>();
            let cur = a.view.saved_camera.as_ref().map(|c| c.device_label.clone()).unwrap_or_default();
            if !cur.is_empty() && !names.contains(&cur) {
                names.push(cur);
            }
            g.set_webcam_names(strings(names));
        },
    );
}

fn camera_from_form(a: &App, f: &CamForm) -> CameraSettings {
    let saved = a.view.saved_camera.clone().unwrap_or_default();
    let same = saved.device_label == f.device.as_str();
    CameraSettings {
        source: f.source.to_string(),
        device_id: if same { saved.device_id.clone() } else { String::new() },
        device_label: f.device.to_string(),
        url: f.url.trim().to_string(),
        upload: f.upload,
        print_photo: f.print_photo,
    }
}

fn show_frame(w: &AppWindow, img: &image::RgbImage) {
    // the live view needs no more than ~640 px
    let step = (img.width() / 640).max(1);
    let (wd, ht) = (img.width() / step, img.height() / step);
    let mut buf = slint::SharedPixelBuffer::<slint::Rgb8Pixel>::new(wd, ht);
    let out = buf.make_mut_slice();
    for y in 0..ht {
        for x in 0..wd {
            let p = img.get_pixel(x * step, y * step);
            out[(y * wd + x) as usize] = slint::Rgb8Pixel { r: p[0], g: p[1], b: p[2] };
        }
    }
    let g = w.global::<WB>();
    g.set_camera_image(slint::Image::from_rgb8(buf));
    g.set_camera_has_image(true);
    g.set_camera_error(ss(""));
}

// ── events from the app ──────────────────────────────────────────────────────
fn on_event(a: &mut App, w: &AppWindow, ev: UiEvent) {
    let g = w.global::<WB>();
    match ev {
        UiEvent::Reading(r) => {
            a.view.reading = Some(r);
            a.view.reading_seen = Some(Instant::now());
            a.view.signal = true;
            refresh_weight(a, w);
        }
        UiEvent::Signal(s) => {
            a.view.signal = s;
            refresh_weight(a, w);
        }
        UiEvent::IndicatorStatus { state, message } => {
            a.view.ind_state = state;
            a.view.ind_message = message;
            refresh_weight(a, w);
        }
        UiEvent::Monitor(line) => {
            if g.get_monitor_on() {
                a.view.monitor.push_back(line);
                while a.view.monitor.len() > 200 {
                    a.view.monitor.pop_front();
                }
                g.set_monitor_text(ss(a.view.monitor.iter().cloned().collect::<Vec<_>>().join("\n")));
            }
        }
        UiEvent::Sync(_) => {
            refresh_sync(a, w);
            load_rates(a, w);
        }
        UiEvent::Update(_) => refresh_update(a, w),
        UiEvent::Lock(_) => {
            refresh_lock(a, w);
            if g.get_tab() == "settings" {
                load_server_copy();
            }
        }
        UiEvent::Reopened(_) => {
            if !g.get_vehicle().is_empty() {
                lookup_vehicle(a);
            }
        }
        UiEvent::Frame(img) => show_frame(w, &img),
        UiEvent::CameraError(m) => {
            g.set_camera_error(ss(m));
        }
    }
}

// ── wiring ───────────────────────────────────────────────────────────────────
fn wire(w: &AppWindow) {
    let g = w.global::<WB>();

    g.on_connect(|| {
        let Some(addr) = with(|_, w| {
            let g = w.global::<WB>();
            g.set_server_busy(true);
            g.set_server_error(ss(""));
            g.get_server_address().to_string()
        }) else { return };
        bg(
            move |c| c.check_server(&addr).and_then(|(api, name)| c.save_server(&api, &name)),
            |a, w, r| {
                let g = w.global::<WB>();
                g.set_server_busy(false);
                match r {
                    Ok(_) => show_screen(a, w),
                    Err(e) => g.set_server_error(ss(e)),
                }
            },
        );
    });

    g.on_login(|| {
        let Some((u, p)) = with(|_, w| {
            let g = w.global::<WB>();
            (g.get_username().to_string(), g.get_password().to_string())
        }) else { return };
        if u.is_empty() || p.is_empty() {
            return;
        }
        with(|_, w| {
            let g = w.global::<WB>();
            g.set_login_busy(true);
            g.set_login_error(ss(""));
        });
        bg(
            move |c| c.login(&u, &p),
            |a, w, r| {
                let g = w.global::<WB>();
                g.set_login_busy(false);
                match r {
                    Ok(_) => {
                        g.set_password(ss(""));
                        show_screen(a, w);
                    }
                    Err(e) => g.set_login_error(ss(e.to_string())),
                }
            },
        );
    });

    g.on_choose_branch(|| {
        let Some(code) = with(|_, w| {
            let g = w.global::<WB>();
            g.set_branch_busy(true);
            g.set_branch_error(ss(""));
            g.get_branch_code().to_string()
        }) else { return };
        bg(
            move |c| c.set_branch(&code),
            |a, w, r| {
                let g = w.global::<WB>();
                g.set_branch_busy(false);
                match r {
                    Ok(seeded) => {
                        if seeded.is_none() {
                            toast(w, a, "warning", "Branch set. History from the server could not be copied yet; it is copied on the next sync.");
                        }
                        show_screen(a, w);
                    }
                    Err(e) => g.set_branch_error(ss(e.to_string())),
                }
            },
        );
    });

    g.on_sign_out(|| {
        with(|a, w| {
            let _ = a.core.logout();
            clear_form(a, w);
            w.global::<WB>().set_tab(ss("weigh"));
            show_screen(a, w);
        });
    });

    g.on_sync_now(|| {
        bg(
            |c| c.sync.run(true),
            |a, w, s| {
                refresh_sync(a, w);
                load_rates(a, w);
                if s.last_error.is_empty() {
                    if w.global::<WB>().get_tab() == "settings" {
                        toast(w, a, "success", "Sync done");
                    }
                } else {
                    toast(w, a, "error", s.last_error);
                }
            },
        );
    });

    g.on_check_update(|| {
        with(|_, w| w.global::<WB>().set_version_busy(true));
        bg(
            |c| c.check_update(),
            |a, w, st| {
                w.global::<WB>().set_version_busy(false);
                refresh_update(a, w);
                match st.status.as_str() {
                    "ready" => toast(w, a, "success", format!("Version {} is ready to install", st.version)),
                    "error" => toast(w, a, "error", format!("Update check failed: {}", st.error)),
                    _ => toast(w, a, "info", "This is the newest version"),
                }
            },
        );
    });

    g.on_install_update(|| {
        with(|a, w| {
            if a.core.updater.run_installer(true) {
                a.core.stop_indicator();
                let _ = slint::quit_event_loop();
                std::process::exit(0);
            } else {
                toast(w, a, "error", "No update is ready to install");
            }
        });
    });

    g.on_answered(|kind, yes| {
        with(|a, w| {
            let g = w.global::<WB>();
            g.set_ask_kind(ss(""));
            if !yes {
                return;
            }
            match kind.as_str() {
                "tare" => {
                    let (v, wt) = (g.get_vehicle().to_string(), g.get_wheel().to_string());
                    save_tare(w, v, wt, true);
                }
                "fetch" => {
                    g.set_copy_busy(true);
                    bg(
                        |c| c.fetch_server_settings(),
                        |a, w, r| {
                            w.global::<WB>().set_copy_busy(false);
                            match r {
                                Ok(_) => {
                                    toast(w, a, "success", "Settings fetched from the server");
                                    load_settings(a, w);
                                    let cam = a.core.camera_settings();
                                    w.global::<WB>().set_camera_on(cam.source != "none");
                                    a.core.set_preview(cam.source != "none");
                                }
                                Err(e) => toast(w, a, "error", e.to_string()),
                            }
                        },
                    );
                }
                "branch" => {
                    bg(
                        |c| c.set_branch(""),
                        |a, w, r| match r {
                            Ok(_) => show_screen(a, w),
                            Err(e) => toast(w, a, "error", e.to_string()),
                        },
                    );
                }
                _ => {}
            }
            let _ = a;
        });
    });

    g.on_tab_shown(|tab| {
        with(|a, w| match tab.as_str() {
            "weigh" => {
                load_rates(a, w);
                w.invoke_focus_vehicle();
            }
            "tares" => {
                load_rates(a, w);
                load_tares(a, w);
            }
            "report" => {
                let g = w.global::<WB>();
                if g.get_report_from().is_empty() {
                    let (f, t) = day_range(0);
                    g.set_report_from(ss(f));
                    g.set_report_to(ss(t));
                }
                load_report(a, w);
            }
            "rates" => {
                load_rates(a, w);
                refresh_lock(a, w);
            }
            "settings" => load_settings(a, w),
            _ => {}
        });
    });

    g.on_settings_shown(|tab| {
        with(|a, w| match tab.as_str() {
            "camera" => load_camera_form(a, w),
            "data" => {
                refresh_sync(a, w);
                refresh_update(a, w);
            }
            "printing" => load_print_form(a, w),
            _ => {}
        });
    });

    // weighing form
    g.on_vehicle_edited(|t| {
        with(|a, w| {
            let g = w.global::<WB>();
            let v = normalize_vehicle(&t);
            if v != t.as_str() {
                g.set_vehicle(ss(&v));
            }
            g.set_wheel(ss(""));
            g.set_wheel_locked(false);
            g.set_kind(ss("none"));
            g.set_vehicle_popup(!v.is_empty());
            a.view.kind = "none".into();
            a.view.source_id.clear();
            refresh_quote(a, w);
            refresh_can_save(a, w);
            lookup_vehicle(a);
        });
    });
    g.on_vehicle_picked(|v| {
        with(|a, w| {
            let g = w.global::<WB>();
            g.set_vehicle(v);
            g.set_wheel(ss(""));
            a.view.kind = "none".into();
            a.view.source_id.clear();
            g.set_kind(ss("none"));
            refresh_can_save(a, w);
            lookup_vehicle(a);
        });
    });
    g.on_wheel_picked(|v| {
        with(|a, w| {
            w.global::<WB>().set_wheel(v);
            refresh_quote(a, w);
            refresh_can_save(a, w);
        });
    });
    g.on_material_edited(|t| {
        with(|a, w| {
            let g = w.global::<WB>();
            let list = a.core.materials(&t);
            g.set_material_suggestions(ModelRc::new(VecModel::from(
                list.into_iter().filter(|m| m.as_str() != t.as_str()).map(|m| Choice { value: ss(&m), label: ss(&m) }).collect::<Vec<_>>(),
            )));
            g.set_material_popup(true);
        });
    });
    g.on_material_picked(|v| {
        with(|_, w| w.global::<WB>().set_material(v));
    });
    g.on_mobile_edited(|t| {
        with(|_, w| {
            let d: String = t.chars().filter(|c| c.is_ascii_digit()).take(15).collect();
            if d != t.as_str() {
                w.global::<WB>().set_mobile(ss(d));
            }
        });
    });
    g.on_kind_picked(|k| {
        with(|a, w| {
            w.global::<WB>().set_kind(k.clone());
            a.view.kind = k.to_string();
            a.view.source_id.clear();
            render_history(a, w);
            refresh_quote(a, w);
            refresh_can_save(a, w);
        });
    });
    g.on_history_clicked(|i| {
        with(|a, w| {
            let Some(h) = a.view.history.get(i as usize) else { return };
            a.view.source_id = h.id.clone();
            a.view.kind = "previous".into();
            w.global::<WB>().set_kind(ss("previous"));
            render_history(a, w);
            refresh_quote(a, w);
            refresh_can_save(a, w);
        });
    });
    g.on_tare_clicked(|i| {
        with(|a, w| {
            let Some(t) = a.view.hist_tares.get(i as usize) else { return };
            a.view.source_id = t.id.clone();
            render_history(a, w);
            refresh_quote(a, w);
            refresh_can_save(a, w);
        });
    });
    g.on_save(|| {
        with(|a, w| save(a, w));
    });
    g.on_clear(|| {
        with(|a, w| clear_form(a, w));
    });
    g.on_tare_from_weighing(|| {
        with(|a, w| {
            let g = w.global::<WB>();
            if g.get_vehicle().is_empty() {
                toast(w, a, "warning", "Enter the vehicle number first");
                return;
            }
            let weight = a.view.reading.as_ref().map(|r| r.weight).unwrap_or(0.0);
            ask(w, "tare", &format!("Save {} as the tare weight of {}?", kg(weight), g.get_vehicle()), "Only do this when the vehicle is empty.", "Save tare weight");
        });
    });
    g.on_reprint(|id| reprint(id.to_string()));

    // tare weights
    g.on_tare_vehicle_edited(|t| {
        with(|a, w| {
            let g = w.global::<WB>();
            let v = normalize_vehicle(&t);
            if v != t.as_str() {
                g.set_tare_vehicle(ss(&v));
            }
            g.set_tare_wheel(ss(""));
            g.set_tare_wheel_locked(false);
            refresh_can_save(a, w);
            lookup_tare_vehicle(a);
        });
    });
    g.on_tare_wheel_picked(|v| {
        with(|a, w| {
            w.global::<WB>().set_tare_wheel(v);
            refresh_can_save(a, w);
        });
    });
    g.on_tare_save(|| {
        let Some((v, wt, ok)) = with(|_, w| {
            let g = w.global::<WB>();
            (g.get_tare_vehicle().to_string(), g.get_tare_wheel().to_string(), g.get_tare_can_save() && !g.get_tare_saving())
        }) else { return };
        if ok {
            with(|_, w| save_tare(w, v, wt, false));
        }
    });
    g.on_tare_filter_edited(|_| {
        with(|a, w| render_tares(a, w));
    });

    // report
    g.on_report_load(|| {
        with(|a, w| load_report(a, w));
    });
    g.on_report_today(|| {
        with(|a, w| {
            let (f, t) = day_range(0);
            let g = w.global::<WB>();
            g.set_report_from(ss(f));
            g.set_report_to(ss(t));
            load_report(a, w);
        });
    });
    g.on_report_day(|off| {
        with(|a, w| {
            let (f, t) = day_range(off as i64);
            let g = w.global::<WB>();
            g.set_report_from(ss(f));
            g.set_report_to(ss(t));
            load_report(a, w);
        });
    });
    g.on_report_csv(|| {
        with(|a, w| {
            let (from, to) = match report_range(w) {
                Ok(r) => r,
                Err(e) => return toast(w, a, "error", e),
            };
            let name = format!("weighbridge-{}.csv", &from[..10]);
            let Some(file) = dialogs::save_file("Save report", &name, "CSV", "csv") else { return };
            match std::fs::write(&file, a.core.report_csv(&from, &to)) {
                Ok(()) => toast(w, a, "success", format!("Saved {}", file.display())),
                Err(e) => toast(w, a, "error", e.to_string()),
            }
        });
    });
    g.on_report_reprint(|i| {
        if let Some(Some(id)) = with(|a, _| a.view.report_ids.get(i as usize).cloned()) {
            reprint(id);
        }
    });

    // rates
    g.on_rate_add(|| {
        let Some((wt, rate)) = with(|_, w| {
            let g = w.global::<WB>();
            (g.get_new_wheel().to_string(), parse(&g.get_new_rate()).unwrap_or(0.0))
        }) else { return };
        with(|_, w| w.global::<WB>().set_rate_busy(true));
        bg(
            move |c| c.add_rate(&wt, rate),
            |a, w, r| {
                let g = w.global::<WB>();
                g.set_rate_busy(false);
                match r {
                    Ok(()) => {
                        g.set_new_wheel(ss(""));
                        g.set_new_rate(ss(""));
                        load_rates(a, w);
                        toast(w, a, "success", "Rate saved");
                    }
                    Err(e) => toast(w, a, "error", e.to_string()),
                }
            },
        );
    });
    g.on_rates_refresh(|| {
        bg(
            |c| c.sync.run(true),
            |a, w, s| {
                load_rates(a, w);
                refresh_sync(a, w);
                if !s.last_error.is_empty() {
                    toast(w, a, "error", s.last_error);
                }
            },
        );
    });

    // settings: lock and server copy
    g.on_check_lock(|| {
        with(|_, w| w.global::<WB>().set_lock_checking(true));
        bg(
            |c| c.refresh_lock(),
            |a, w, l| {
                w.global::<WB>().set_lock_checking(false);
                refresh_lock(a, w);
                if l.locked {
                    toast(w, a, "info", "Settings are still locked");
                }
            },
        );
    });
    g.on_fetch_copy(|| {
        with(|_, w| {
            ask(
                w,
                "fetch",
                "Replace this PC's settings with the copy on the server?",
                "Indicator, printing, weighing and camera settings are replaced. You can change them again afterwards.",
                "Fetch from server",
            )
        });
    });

    // indicator
    g.on_preset_picked(|id| {
        with(|a, w| preset_picked(a, w, &id));
    });
    g.on_refresh_ports(|| {
        with(|_, w| load_ports(w));
    });
    g.on_ind_save(|| {
        let Some((preset, ov)) = with(|a, w| {
            let f = w.global::<WB>().get_ind();
            (f.preset.to_string(), form_overrides(&f, &a.core.profile()))
        }) else { return };
        bg(
            move |c| c.save_indicator(&preset, &ov),
            |a, w, r| match r {
                Ok(p) => {
                    w.global::<WB>().set_ind(ind_form(&p.preset_id, &p));
                    toast(w, a, "success", "Saved. Reconnecting to the indicator.");
                }
                Err(e) => toast(w, a, "error", e.to_string()),
            },
        );
    });
    g.on_ind_export(|| {
        with(|a, w| {
            let f = w.global::<WB>().get_ind();
            let ov = form_overrides(&f, &a.core.profile());
            let Some(file) = dialogs::save_file("Save indicator profile", "indicator-profile.json", "Profile", "json") else { return };
            let body = json!({ "kind": "tradelink247-weighbridge-indicator", "presetId": f.preset.as_str(), "overrides": ov });
            match std::fs::write(&file, serde_json::to_string_pretty(&body).unwrap_or_default()) {
                Ok(()) => toast(w, a, "success", format!("Saved {}", file.display())),
                Err(e) => toast(w, a, "error", e.to_string()),
            }
        });
    });
    g.on_ind_import(|| {
        with(|a, w| {
            if !a.core.is_admin() || a.core.lock.locked() {
                return toast(w, a, "error", if a.core.is_admin() { "Settings are locked" } else { "Only an admin can change this" });
            }
            let Some(file) = dialogs::open_file("Load indicator profile", "Profile", "json") else { return };
            let data: Value = std::fs::read_to_string(&file).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or(Value::Null);
            if data["kind"] != "tradelink247-weighbridge-indicator" {
                return toast(w, a, "error", "That file is not an indicator profile");
            }
            let id = data["presetId"].as_str().unwrap_or("qt-default").to_string();
            let p = crate::indicator::profiles::build_profile(&id, &data["overrides"]);
            w.global::<WB>().set_ind(ind_form(&id, &p));
            toast(w, a, "info", "Loaded. Check it, then Save.");
        });
    });
    g.on_ind_reconnect(|| {
        bg(|c| c.start_indicator(), |_, _, _| {});
    });
    g.on_monitor_toggled(|on| {
        with(|a, w| {
            w.global::<WB>().set_monitor_on(on);
            a.core.set_monitor(on);
        });
    });
    g.on_monitor_clear(|| {
        with(|a, w| {
            a.view.monitor.clear();
            w.global::<WB>().set_monitor_text(ss(""));
        });
    });
    g.on_ind_test(|| {
        with(|a, w| {
            let g = w.global::<WB>();
            let f = g.get_ind();
            let ov = form_overrides(&f, &a.core.profile());
            let results = a.core.test_parse(&f.preset, &ov, &g.get_sample());
            g.set_test_rows(rows(
                results
                    .into_iter()
                    .map(|(frame, r)| {
                        let (wt, st) = match r {
                            Some(d) => (fmt_num(d.weight), d.stable.map(|s| s.to_string()).unwrap_or_else(|| "by repetition".into())),
                            None => ("not read".into(), String::new()),
                        };
                        row("", vec![frame, wt, st], "", "", false, false)
                    })
                    .collect(),
            ));
            g.set_tested(true);
        });
    });

    // printing
    g.on_print_save(|| {
        let Some(p) = with(|a, w| print_from_form(a, &w.global::<WB>().get_print())) else { return };
        bg(
            move |c| c.save_print(&p),
            |a, w, r| match r {
                Ok(_) => {
                    load_print_form(a, w);
                    toast(w, a, "success", "Saved");
                }
                Err(e) => toast(w, a, "error", e.to_string()),
            },
        );
    });
    g.on_print_test(|| {
        bg(
            |c| c.test_print(),
            |a, w, p| {
                if p.error.is_empty() {
                    toast(w, a, "success", "Test voucher sent");
                } else {
                    toast(w, a, "error", p.error);
                }
            },
        );
    });
    g.on_pick_pdf_folder(|| {
        with(|_, w| {
            if let Some(dir) = dialogs::pick_folder() {
                let g = w.global::<WB>();
                let mut f = g.get_print();
                f.pdf_folder = ss(dir.to_string_lossy());
                g.set_print(f);
                g.set_pdf_folder_shown(ss(dir.to_string_lossy()));
            }
        });
    });
    g.on_open_pdf_folder(|| {
        with(|a, _| paths::open_folder(&a.core.pdf_folder()));
    });

    // weighing settings
    g.on_weighing_save(|| {
        let Some(ws) = with(|_, w| {
            let g = w.global::<WB>();
            WeighingSettings { require_stable: g.get_require_stable(), simulator: g.get_simulator() }
        }) else { return };
        bg(
            move |c| c.save_weighing_settings(&ws),
            |a, w, r| {
                let g = w.global::<WB>();
                let saved = a.core.weighing_settings();
                g.set_require_stable(saved.require_stable);
                g.set_simulator(saved.simulator);
                if let Err(e) = r {
                    toast(w, a, "error", e.to_string());
                }
            },
        );
    });
    g.on_simulate(|on| {
        with(|a, w| {
            let weight = if on { parse(&w.global::<WB>().get_sim_weight()) } else { None };
            if let Err(e) = a.core.simulate(weight) {
                toast(w, a, "error", e.to_string());
            }
        });
    });

    // camera
    g.on_cam_changed(|| {
        with(|a, w| {
            let g = w.global::<WB>();
            let now = camera_from_form(a, &g.get_cam());
            g.set_cam_dirty(a.view.saved_camera.as_ref() != Some(&now));
        });
    });
    g.on_cam_save(|| {
        let Some(c) = with(|a, w| camera_from_form(a, &w.global::<WB>().get_cam())) else { return };
        bg(
            move |core| core.save_camera(&c),
            |a, w, r| match r {
                Ok(saved) => {
                    let g = w.global::<WB>();
                    g.set_camera_on(saved.source != "none");
                    g.set_camera_has_image(false);
                    g.set_camera_error(ss(""));
                    a.core.set_preview(saved.source != "none");
                    a.view.saved_camera = Some(saved);
                    g.set_cam_dirty(false);
                    toast(w, a, "success", "Camera saved");
                }
                Err(e) => toast(w, a, "error", e.to_string()),
            },
        );
    });
    g.on_cam_refresh(load_webcams);
    g.on_cam_test(|| {
        let Some(url) = with(|_, w| w.global::<WB>().get_cam().url.to_string()) else { return };
        bg(
            move |c| {
                c.snapshot(&url).and_then(|b| image::load_from_memory_with_format(&b, image::ImageFormat::Jpeg).map(|i| i.to_rgb8()).map_err(|e| e.to_string()))
            },
            |a, w, r| match r {
                Ok(img) => {
                    w.global::<WB>().set_camera_on(true);
                    show_frame(w, &img);
                    toast(w, a, "success", format!("The camera answered ({}×{})", img.width(), img.height()));
                }
                Err(e) => toast(w, a, "error", e),
            },
        );
    });
    g.on_open_photo_folder(|| paths::open_folder(&paths::photos_dir()));

    // branch & data
    g.on_reseed(|| {
        bg(
            |c| c.sync.seed(),
            |a, w, r| match r {
                Ok((wt, t, lwb, _)) => toast(w, a, "success", format!("Copied {wt} weighings and {t} tare weights. Next voucher after {lwb}.")),
                Err(e) => toast(w, a, "error", e.to_string()),
            },
        );
    });
    g.on_open_logs(|| paths::open_folder(&paths::logs_dir()));
    g.on_change_branch(|| {
        with(|_, w| ask(w, "branch", "Change this PC's branch?", "Only do this if the PC has moved to another weighbridge.", "Change branch"));
    });
}

pub fn run(core: Arc<Core>, events: std::sync::mpsc::Receiver<UiEvent>) -> Result<(), slint::PlatformError> {
    let w = AppWindow::new()?;
    let g = w.global::<WB>();
    g.set_version(ss(&core.version));
    let (f, t) = day_range(0);
    g.set_report_from(ss(f));
    g.set_report_to(ss(t));
    CORE.with(|c| *c.borrow_mut() = Some(core.clone()));
    APP.with(|a| {
        *a.borrow_mut() = Some(App { win: w.as_weak(), core: core.clone(), view: View { kind: "none".into(), ..Default::default() }, lookup_timer: Default::default(), tare_timer: Default::default() });
    });
    wire(&w);

    // events from the app's threads
    std::thread::spawn(move || {
        while let Ok(ev) = events.recv() {
            let _ = slint::invoke_from_event_loop(move || {
                with(|a, w| on_event(a, w, ev));
            });
        }
    });

    // freshness of the reading (no-signal, 5 s old) and the data tab
    let timer = slint::Timer::default();
    timer.start(slint::TimerMode::Repeated, Duration::from_millis(500), || {
        with(|a, w| refresh_weight(a, w));
    });

    let (state, message) = core.indicator_status();
    with(|a, w| {
        a.view.ind_state = state;
        a.view.ind_message = message;
        show_screen(a, w);
        refresh_weight(a, w);
        refresh_update(a, w);
    });

    w.window().on_close_requested(|| slint::CloseRequestResponse::HideWindow);
    w.window().set_maximized(true);
    w.run()?;
    APP.with(|a| a.borrow_mut().take());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn report_dates() {
        assert_eq!(parse_when("01/10/2026 06:30", false).unwrap(), "2026-10-01 06:30:00");
        assert_eq!(parse_when("01/10/2026", true).unwrap(), "2026-10-02 00:00:00");
        assert_eq!(parse_when("2026-10-01 23:59", true).unwrap(), "2026-10-02 00:00:00");
        assert!(parse_when("tomorrow", false).is_none());
    }

    #[test]
    fn profile_form_round_trip() {
        let p = crate::indicator::profiles::build_profile("qt-default", &json!({ "transport": { "path": "COM3" } }));
        let f = ind_form("qt-default", &p);
        assert_eq!((f.baud.as_str(), f.path.as_str(), f.parity.as_str()), ("9600", "COM3", "none"));
        let ov = form_overrides(&f, &p);
        let back = crate::indicator::profiles::build_profile("qt-default", &ov);
        assert_eq!(back.transport.path, "COM3");
        assert_eq!(back.transport.baud_rate, Some(9600.0));
        assert_eq!(back.frame, p.frame);
        assert_eq!(back.engage_threshold_kg, p.engage_threshold_kg);
    }
}
