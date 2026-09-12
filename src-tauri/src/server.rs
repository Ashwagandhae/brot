use actix_cors::Cors;
use actix_files::{Files, NamedFile};
use actix_web::{App, HttpResponse, HttpServer, Responder, Result, web};
use tauri::{AppHandle, Manager};

use crate::{
    message::{ClientMessage, handle_message_and_errors},
    state::AppState,
};

async fn message(body: web::Json<ClientMessage>, handle: web::Data<AppHandle>) -> impl Responder {
    HttpResponse::Ok().json(handle_message_and_errors(body.0, &handle.state::<AppState>()).await)
}

pub async fn run_server(handle: AppHandle) -> std::io::Result<()> {
    let handle = web::Data::new(handle);
    HttpServer::new(move || {
        App::new()
            .wrap(configure_cors())
            .app_data(handle.clone())
            .route("/message", web::post().to(message))
            .service(
                Files::new("/", handle.state::<AppState>().build_path.clone())
                    .index_file("index.html"),
            )
            .default_service(web::get().to(fallback_to_index))
    })
    .bind("127.0.0.1:4242")?
    .run()
    .await
}

async fn fallback_to_index(handle: web::Data<AppHandle>) -> Result<NamedFile> {
    Ok(NamedFile::open(
        handle.state::<AppState>().build_path.join("index.html"),
    )?)
}

fn configure_cors() -> Cors {
    Cors::permissive() // allow any origin in dev
}
