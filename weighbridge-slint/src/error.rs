use std::fmt;

/// Every failure the screens can show. Validation is something the operator must fix; Auth means
/// sign in again; Http is an answer from the server; Network means the server couldn't be reached.
#[derive(Debug, Clone, PartialEq)]
pub enum AppError {
    Validation(String),
    Auth(String),
    Http { status: u16, message: String },
    Network(String),
    Other(String),
}

pub type Res<T> = Result<T, AppError>;

impl AppError {
    pub fn validation(m: impl Into<String>) -> Self {
        AppError::Validation(m.into())
    }
    pub fn other(m: impl Into<String>) -> Self {
        AppError::Other(m.into())
    }
    pub fn status(&self) -> Option<u16> {
        if let AppError::Http { status, .. } = self { Some(*status) } else { None }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Validation(m) | AppError::Auth(m) | AppError::Network(m) | AppError::Other(m) => f.write_str(m),
            AppError::Http { message, .. } => f.write_str(message),
        }
    }
}

impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Other(format!("database: {e}"))
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Other(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Other(e.to_string())
    }
}
