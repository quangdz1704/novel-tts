#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;

use tokio::io::{AsyncBufReadExt, BufReader};

struct ProcessMap(Mutex<HashMap<String, tokio::process::Child>>);

#[tauri::command]
fn run_node_crawler(url: String, ty: String) -> Result<Value, String> {
    // kept for compatibility: run once and return result synchronously
    let script = "./src/tauri-node/crawler.js";
    let output = std::process::Command::new("node")
        .arg(script)
        .arg("--url")
        .arg(&url)
        .arg("--type")
        .arg(&ty)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(stderr);
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    serde_json::from_str(&stdout).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_node_crawler(app: tauri::AppHandle, job_id: String, url: String, ty: String) -> Result<(), String> {
    let script = "./src/tauri-node/crawler.js";

    // spawn the node process asynchronously with piped stdout
    let mut cmd = tokio::process::Command::new("node");
    cmd
        .arg(script)
        .arg("--url")
        .arg(&url)
        .arg("--type")
        .arg(&ty)
        .arg("--stream")
        .stdout(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;

    let mut stdout = child.stdout.take().ok_or("failed to capture stdout")?;

    // move app handle into the task
    let app_handle = app.clone();
    let jid = job_id.clone();

    tauri::async_runtime::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            // Try parse JSON lines emitted by the node script
            let parsed = serde_json::from_str::<Value>(&line).unwrap_or(Value::String(line.clone()));
            let payload = serde_json::json!({ "jobId": jid, "data": parsed });
            let _ = app_handle.emit_all("crawler-event", payload);
        }

        // when finished, emit a finished event
        let payload = serde_json::json!({ "jobId": jid, "data": {"event": "exited"} });
        let _ = app_handle.emit_all("crawler-event", payload);
    });

    // store child handle so it can be killed later
    let state = app.state::<ProcessMap>();
    if let Ok(mut map) = state.0.lock() {
        map.insert(job_id, child);
    }

    Ok(())
}

#[tauri::command]
fn stop_node_crawler(app: tauri::AppHandle, job_id: String) -> Result<(), String> {
    let state = app.state::<ProcessMap>();
    if let Ok(mut map) = state.0.lock() {
        if let Some(mut child) = map.remove(&job_id) {
            // attempt to kill
            let _ = child.kill();
        }
    }
    Ok(())
}

fn main() {
    let process_map: ProcessMap = ProcessMap(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .manage(process_map)
        .invoke_handler(tauri::generate_handler![run_node_crawler, start_node_crawler, stop_node_crawler])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
