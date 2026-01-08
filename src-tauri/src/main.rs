// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("PANIC: {:?}", info);
        eprintln!("{}", msg);
        if let Ok(mut f) = std::fs::File::create("/tmp/corngr_panic.log") {
            use std::io::Write;
            let _ = writeln!(f, "{}", msg);
            if let Ok(bt) = std::env::var("RUST_BACKTRACE") {
                if bt == "1" || bt == "full" {
                    // Can't capture backtrace easily without crate, but at least we get the message
                }
            }
        }
    }));
    corngr_app_lib::run()
}
