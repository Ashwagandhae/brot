use std::sync::LazyLock;

use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime, Duration};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Feature, Features, Library, LibraryExt, World};
use typst_kit::downloader::{Downloader, SystemDownloader};
use typst_kit::files::{FileLoader, FileStore, FsRoot};
use typst_kit::fonts::{self, FontStore};
use typst_kit::packages::{FsPackages, SystemPackages, UniversePackages};

pub struct SimpleWorld {
    library: LazyHash<Library>,
    fonts: LazyLock<FontStore, Box<dyn Fn() -> FontStore + Send + Sync>>,
    files: FileStore<SimpleFiles>,
    main_source: Source,
}

impl SimpleWorld {
    pub fn new() -> Self {
        let library = Library::builder()
            .with_features(Features::from_iter([Feature::Html]))
            .build();

        let fonts: LazyLock<FontStore, Box<dyn Fn() -> FontStore + Send + Sync>> =
            LazyLock::new(Box::new(|| {
                let mut fonts = FontStore::new();
                fonts.extend(fonts::system());
                fonts.extend(fonts::embedded());
                fonts
            }));
        let files = SimpleFiles::new();

        let main_source = Source::new(files.main, "".to_owned());

        Self {
            library: LazyHash::new(library),
            fonts,
            files: FileStore::new(SimpleFiles::new()),
            main_source,
        }
    }
    pub fn main_source_mut(&mut self) -> &mut Source {
        &mut self.main_source
    }
    pub fn main_source(&self) -> &Source {
        &self.main_source
    }
}

impl World for SimpleWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }

    fn book(&self) -> &LazyHash<FontBook> {
        &self.fonts.book()
    }

    fn main(&self) -> FileId {
        self.files.loader().main
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if self.files.loader().main == id {
            FileResult::Ok(self.main_source.clone())
        } else {
            self.files.source(id)
        }
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.files.file(id)
    }

    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.font(index)
    }

    fn today(&self, _offset: Option<Duration>) -> Option<Datetime> {
        Some(Datetime::from_ymd(2026, 1, 1).unwrap())
    }
}
struct SimpleFiles {
    main: FileId,
    packages: SystemPackages,
}

impl SimpleFiles {
    /// Creates a new loader given the configuration.
    pub fn new() -> SimpleFiles {
        let main = RootedPath::new(
            VirtualRoot::Project,
            VirtualPath::new("main.typ").expect("failed to create virtual path"),
        )
        .intern();

        SimpleFiles {
            main,
            packages: SystemPackages::from_parts(
                FsPackages::system_data(),
                FsPackages::system_cache(),
                UniversePackages::new(downloader()),
            ),
        }
    }

    /// Resolves the root in which the given file ID resides.
    fn root(&self, id: FileId) -> FileResult<FsRoot> {
        match id.root() {
            VirtualRoot::Project => {
                FileResult::Err(FileError::NotFound(id.vpath().get_without_slash().into()))
            }
            VirtualRoot::Package(spec) => Ok(self.packages.obtain(spec)?),
        }
    }
}

impl FileLoader for SimpleFiles {
    fn load(&self, id: FileId) -> FileResult<Bytes> {
        self.root(id)?.load(id.vpath())
    }
}
pub fn downloader() -> impl Downloader {
    let user_agent = format!("typst/{}", typst::utils::version().raw());
    SystemDownloader::new(user_agent)
}
