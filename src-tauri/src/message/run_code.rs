use rustpython_stdlib;
use rustpython_vm as vm;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use ts_rs::TS;
use vm::{Interpreter, Settings};

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CodeResult {
    #[serde(rename_all = "camelCase")]
    Ok { text: String },
    #[serde(rename_all = "camelCase")]
    Error { message: String },
}

pub fn run_python(python_code: &str) -> CodeResult {
    let logs = Arc::new(Mutex::new(String::new()));
    let logs_capture = logs.clone();

    let interp = Interpreter::with_init(Settings::default(), |vm| {
        vm.add_native_modules(rustpython_stdlib::get_module_inits());
    });

    interp.enter(move |vm| {
        let scope = vm.new_scope_with_builtins();

        // 1. Setup the Rust-side logger
        let rust_logger = vm.new_function("rust_logger", move |msg: String| {
            if let Ok(mut b) = logs_capture.lock() {
                b.push_str(&msg);
            }
        });
        let _ = scope
            .globals
            .set_item("rust_logger", rust_logger.into(), vm);

        // 2. Harness to redirect sys.stdout
        let harness = r#"
import sys
class Bridge:
    def write(self, s): rust_logger(s)
    def flush(self): pass
sys.stdout = Bridge()
sys.stderr = Bridge()
"#;
        let _ = vm.run_code_string(scope.clone(), harness, "<harness>".into());

        // 3. First attempt: Run the code as-is
        match vm.run_code_string(scope.clone(), python_code, "<input>".into()) {
            Ok(_) => {
                let captured = logs.lock().unwrap().trim().to_string();

                // 4. If no output, try wrapping the last line in print()
                if captured.is_empty() {
                    let lines: Vec<&str> = python_code.lines().collect();
                    if let Some(last_line) = lines.last() {
                        // Skip if the last line is already a print or an assignment
                        if !last_line.trim().is_empty()
                            && !last_line.contains('=')
                            && !last_line.contains("print")
                        {
                            let mut new_code = lines[..lines.len() - 1].join("\n");
                            new_code.push_str(&format!("\nprint({})", last_line));

                            // Clear logs and try again
                            logs.lock().unwrap().clear();
                            if vm
                                .run_code_string(scope.clone(), &new_code, "<retry>".into())
                                .is_ok()
                            {
                                return CodeResult::Ok {
                                    text: logs.lock().unwrap().trim().to_string(),
                                };
                            }
                        }
                    }
                }
                CodeResult::Ok { text: captured }
            }
            Err(exc) => {
                let mut err_msg = String::new();
                let _ = vm.write_exception(&mut err_msg, &exc);
                CodeResult::Error { message: err_msg }
            }
        }
    })
}
