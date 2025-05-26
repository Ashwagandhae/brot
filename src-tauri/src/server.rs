use actix_cors::Cors;
use actix_files::{Files, NamedFile};
use actix_web::{web, App, HttpResponse, HttpServer, Responder, Result};

use crate::{
    message::{handle_message_and_errors, ClientMessage},
    state::AppState,
};

async fn message(body: web::Json<ClientMessage>, state: web::Data<AppState>) -> impl Responder {
    HttpResponse::Ok().json(handle_message_and_errors(body.0, &state, None).await)
}

pub async fn run_server(state: AppState) -> std::io::Result<()> {
    let state = web::Data::new(state);
    HttpServer::new(move || {
        App::new()
            .wrap(configure_cors())
            .app_data(state.clone())
            .route("/message", web::post().to(message))
            .service(Files::new("/", state.build_path.clone()).index_file("index.html"))
            .default_service(web::get().to(fallback_to_index))
    })
    .bind("127.0.0.1:4242")?
    .run()
    .await
}

async fn fallback_to_index(state: web::Data<AppState>) -> Result<NamedFile> {
    Ok(NamedFile::open(state.build_path.join("index.html"))?)
}

fn configure_cors() -> Cors {
    Cors::permissive() // allow any origin in dev
}
