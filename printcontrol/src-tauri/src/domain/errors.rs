// src-tauri/src/domain/errors.rs
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Serialize, Deserialize)]
#[serde(tag = "code", content = "message")]
pub enum AppError {
    #[error("Recurso não encontrado: {0}")]
    NotFound(String),

    #[error("Erro no banco de dados: {0}")]
    DatabaseError(String),

    #[error("Permissão negada: {0}")]
    PermissionDenied(String),

    #[error("Erro de validação: {0}")]
    ValidationError(String),

    #[error("Erro desconhecido: {0}")]
    Unknown(String),
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::DatabaseError(e.to_string())
    }
}

impl From<AppError> for String {
    fn from(e: AppError) -> Self {
        serde_json::to_string(&e).unwrap_or_else(|_| e.to_string())
    }
}
