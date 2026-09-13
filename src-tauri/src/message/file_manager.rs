use anyhow::Context;
use anyhow::Result;
use anyhow::anyhow;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_android_fs::AndroidFsExt;
use tauri_plugin_android_fs::Entry;
use tauri_plugin_android_fs::PersistableAccessMode;
use tauri_plugin_android_fs::PrivateDir;
use tokio::sync::MappedMutexGuard;
use tokio::sync::OnceCell;
use tokio::task::JoinSet;

use tauri_plugin_android_fs::FileUri;
use tokio::{fs, sync::Mutex};

use crate::message::file_derived::FileDerived;
use crate::message::file_derived::FileUpdateWatcher;
#[derive(Debug, Clone)]
pub struct LoadedTracker {
    file_derived: FileDerived,
    loaded: bool,
}

pub struct FileManager {
    folder: Folder,
    tracker: Arc<Mutex<LoadedTracker>>,
    handle: AppHandle,
}
#[derive(Debug, Clone)]
pub enum Folder {
    Android { uri: FileUri },
    Normal { dir_path: Option<PathBuf> },
}
#[allow(unused)]
fn downloads_subfolder_uri(app: AppHandle) -> Result<FileUri> {
    let api = app.android_fs();

    let storage_key = format!("subfolder_uri");

    let stored_uri = api
        .private_storage()
        .read_to_string(PrivateDir::Data, &storage_key)
        .ok()
        .and_then(|s| FileUri::from_str(&s).ok());

    if let Some(uri) = stored_uri {
        if api.check_persisted_uri_permission(&uri, PersistableAccessMode::ReadAndWrite)? {
            return Ok(uri);
        }
    }

    let selected_uri = api.show_manage_dir_dialog(None)?;

    let Some(uri) = selected_uri else {
        return Err(anyhow!("User cancelled folder selection"));
    };

    api.take_persistable_uri_permission(&uri)?;

    api.private_storage()
        .write(PrivateDir::Data, &storage_key, uri.to_string()?.as_bytes())?;

    Ok(uri)
}

impl Folder {
    #[allow(unused)]
    pub fn new(app: AppHandle, path: Option<PathBuf>) -> Result<Self> {
        #[cfg(not(target_os = "android"))]
        {
            Ok(Self::Normal { dir_path: path })
        }

        #[cfg(target_os = "android")]
        {
            Ok(Self::Android {
                uri: downloads_subfolder_uri(app)?,
            })
        }
    }
}

impl FileManager {
    pub fn new(handle: AppHandle, path: Option<PathBuf>) -> Result<Self> {
        Ok(Self {
            folder: Folder::new(handle.clone(), path)?,
            tracker: Arc::new(Mutex::new(LoadedTracker {
                loaded: false,
                file_derived: FileDerived::new(),
            })),
            handle: handle.clone(),
        })
    }

    pub async fn reload_files(&self) -> Result<()> {
        let paths: Vec<String> = self
            .read_dir()
            .await?
            .into_iter()
            .filter(|path| path.ends_with(".typ"))
            .collect();

        let mut tracker = self.tracker.lock().await;
        for path in tracker.file_derived.paths().clone() {
            tracker.file_derived.remove_file(&path);
        }

        let mut join_set: JoinSet<
            Result<Option<Box<dyn FnOnce(&mut FileDerived) + Send + 'static>>>,
        > = JoinSet::new();

        for path in paths {
            let file_derived_snapshot = Arc::new(tracker.file_derived.clone());

            let folder = self.folder.clone();
            let handle = self.handle.clone();
            join_set.spawn(async move {
                let contents = LazyFile::new(&path, folder, handle);

                let action = file_derived_snapshot
                    .add_file_action(&path, &contents)
                    .await?;

                let boxed_action = action
                    .map(|f| Box::new(f) as Box<dyn FnOnce(&mut FileDerived) + Send + 'static>);

                Ok(boxed_action)
            });
        }

        while let Some(res) = join_set.join_next().await {
            let action = res??;
            if let Some(action) = action {
                action(&mut tracker.file_derived);
            }
        }

        tracker.loaded = true;
        Ok(())
    }

    pub async fn derived(&'_ self) -> Result<MappedMutexGuard<'_, FileDerived>> {
        let lock = {
            let lock = self.tracker.lock().await;
            if !lock.loaded {
                drop(lock);
                self.reload_files().await?;
                self.tracker.lock().await
            } else {
                lock
            }
        };
        Ok(tokio::sync::MutexGuard::<'_, LoadedTracker>::map(
            lock,
            |x| &mut x.file_derived,
        ))
    }
    pub async fn read(&self, path: &str) -> Result<Option<String>> {
        read(&self.folder, self.handle.clone(), path).await
    }
    pub async fn file_exists(&self, path: &str) -> Result<bool> {
        file_exists(&self.folder, self.handle.clone(), path).await
    }
    pub async fn read_dir(&self) -> Result<Vec<String>> {
        match self.folder {
            Folder::Normal { ref dir_path } => {
                let mut entries = fs::read_dir(resolve(dir_path, "./")?).await?;
                let mut paths = Vec::new();
                while let Some(entry) = entries.next_entry().await? {
                    paths.push(
                        entry
                            .file_name()
                            .into_string()
                            .expect("invalid entry string"),
                    );
                }
                Ok(paths)
            }
            Folder::Android { ref uri } => {
                let uri = uri.clone();
                let handle = self.handle.clone();
                tokio::task::spawn_blocking(move || {
                    let api = handle.android_fs();
                    Ok(api
                        .read_dir(&uri)?
                        .map(|entry| match entry {
                            Entry::File { name, .. } => name,
                            Entry::Dir { name, .. } => name,
                        })
                        .collect())
                })
                .await?
            }
        }
    }
    pub async fn remove_file(&self, path: &str) -> Result<()> {
        let res = match self.folder {
            Folder::Normal { ref dir_path } => {
                let path = resolve(dir_path, path)?;
                fs::remove_file(path).await?;
                Ok(())
            }
            Folder::Android { ref uri } => {
                let uri = uri.clone();
                let path = path.to_owned();
                let app = self.handle.clone();
                tokio::task::spawn_blocking(move || {
                    let api = app.android_fs();
                    let file_uri = api.resolve_uri(&uri, path)?;
                    api.remove_file(&file_uri)?;
                    Ok(())
                })
                .await?
            }
        };
        self.tracker.lock().await.file_derived.remove_file(path);
        res
    }

    pub async fn write(&self, path: &str, contents: String) -> Result<()> {
        let res = match self.folder {
            Folder::Normal { ref dir_path } => {
                let path = resolve(dir_path, path)?;
                fs::write(PathBuf::from(&path), contents.clone()).await?;
                Ok(())
            }
            Folder::Android { ref uri } => {
                if !self.file_exists(path).await? {
                    let uri = uri.clone();
                    let path = path.to_owned();
                    let app = self.handle.clone();
                    tokio::task::spawn_blocking(move || -> Result<()> {
                        let api = app.android_fs();
                        api.create_file(&uri, path, None)?;
                        Ok(())
                    })
                    .await??;
                }
                let uri = uri.clone();
                let path = path.to_owned();
                let app = self.handle.clone();
                let contents = contents.clone();
                tokio::task::spawn_blocking(move || {
                    let api = app.android_fs();
                    let file_uri = api.resolve_uri(&uri, path)?;
                    api.write(&file_uri, contents.as_bytes())?;
                    Ok(())
                })
                .await?
            }
        };
        {
            let mut tracker = self.tracker.lock().await;
            tracker.file_derived.remove_file(path);
            tracker
                .file_derived
                .add_file(
                    path,
                    &LazyFile::new(path, self.folder.clone(), self.handle.clone()),
                )
                .await?;
        }
        res
    }
}
fn resolve(dir_path: &Option<PathBuf>, path: &str) -> Result<PathBuf> {
    dir_path
        .as_ref()
        .map(|p| p.join(path))
        .context("no path specified")
}
pub struct LazyFile {
    path: String,
    contents: OnceCell<Option<String>>,
    folder: Folder,
    handle: AppHandle,
}
impl LazyFile {
    pub fn new(path: &str, folder: Folder, handle: AppHandle) -> LazyFile {
        LazyFile {
            path: path.to_owned(),
            contents: OnceCell::new(),
            folder,
            handle,
        }
    }

    pub async fn get(&self) -> Result<Option<&str>> {
        let content = self
            .contents
            .get_or_try_init(|| async { read(&self.folder, self.handle.clone(), &self.path).await })
            .await?;

        Ok(content.as_deref())
    }
}
async fn read(folder: &Folder, handle: AppHandle, path: &str) -> Result<Option<String>> {
    match folder {
        Folder::Normal { dir_path } => {
            let path = resolve(dir_path, path)?;
            match fs::read_to_string(path).await {
                Ok(contents) => Ok(Some(contents)),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
                Err(e) => Err(e.into()),
            }
        }
        Folder::Android { uri } => {
            if !file_exists(folder, handle.clone(), path).await? {
                return Ok(None);
            }
            let uri = uri.clone();
            let path = path.to_owned();
            let handle = handle.clone();
            tokio::task::spawn_blocking(move || {
                let api = handle.android_fs();
                match api.resolve_uri(&uri, &path) {
                    Ok(file_uri) => Ok(Some(api.read_to_string(&file_uri)?)),
                    Err(tauri_plugin_android_fs::Error::Io(e))
                        if e.kind() == std::io::ErrorKind::NotFound =>
                    {
                        Ok(None)
                    }
                    Err(e) => Err(e.into()),
                }
            })
            .await?
        }
    }
}
async fn file_exists(folder: &Folder, handle: AppHandle, path: &str) -> Result<bool> {
    match folder {
        Folder::Normal { dir_path } => {
            let path = resolve(dir_path, path)?;
            Ok(fs::try_exists(path).await?)
        }
        Folder::Android { uri } => {
            let uri = uri.clone();
            let path = path.to_owned();
            let handle = handle.clone();
            tokio::task::spawn_blocking(move || {
                let api = handle.android_fs();
                match api.resolve_uri(&uri, &path) {
                    Ok(uri) => match api.get_mime_type(&uri) {
                        Ok(Some(_)) => Ok(true),
                        Ok(None) => Ok(false),
                        Err(tauri_plugin_android_fs::Error::Io(e))
                            if e.kind() == std::io::ErrorKind::NotFound =>
                        {
                            Ok(false)
                        }
                        // TODO find better solution for this
                        Err(tauri_plugin_android_fs::Error::PluginInvoke(message))
                            if message.contains("java.io.FileNotFoundException") =>
                        {
                            Ok(false)
                        }

                        Err(err) => Err(err.into()),
                    },
                    Err(err) => Err(err.into()),
                }
            })
            .await?
        }
    }
}
