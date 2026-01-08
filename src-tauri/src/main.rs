// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let payload = info.payload();
        let payload_str = if let Some(s) = payload.downcast_ref::<&str>() {
            format!("PANIC: {}", s)
        } else if let Some(s) = payload.downcast_ref::<String>() {
            format!("PANIC: {}", s)
        } else {
            format!("PANIC: {:?}", payload)
        };

        let location = info
            .location()
            .map(|l| format!(" at {}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_default();
        let msg = format!("{}{}", payload_str, location);

        eprintln!("{}", msg);
        if let Ok(mut f) = std::fs::File::create("/tmp/corngr_panic.log") {
            use std::io::Write;
            let _ = writeln!(f, "{}", msg);
        }
    }));
    corngr_app_lib::run()
}
