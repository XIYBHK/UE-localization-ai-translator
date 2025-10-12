use crate::utils::{logging as logging_types, paths};
use crate::{logging, logging_error};
use anyhow::Result;
use flexi_logger::{Cleanup, Criterion, Duplicate, FileSpec, LogSpecBuilder, Logger};

#[cfg(not(debug_assertions))]
use crate::utils::logging_types::NoModuleFilter;

/// 初始化应用程序
/// 步骤：
/// 1. 初始化便携模式标志
/// 2. 创建目录结构
/// 3. 初始化日志系统
pub fn init_app() -> Result<()> {
    // Step 1: 初始化便携模式（检测 .config/PORTABLE 文件）
    paths::init_portable_flag()?;

    // Step 2: 创建必要的目录结构
    paths::init_app_directories()?;

    // Step 3: 初始化日志系统
    init_logger()?;

    logging!(
        info,
        logging_types::Type::Init,
        "🚀 Application initialized successfully"
    );
    logging!(
        info,
        logging_types::Type::Init,
        "Portable mode: {}",
        *paths::PORTABLE_FLAG.get().unwrap_or(&false)
    );
    logging!(
        info,
        logging_types::Type::Init,
        "Home directory: {:?}",
        paths::app_home_dir()?
    );

    Ok(())
}

/// 初始化日志系统（使用 flexi_logger）
/// 配置：
/// - 日志级别：DEBUG（开发）/ INFO（生产）
/// - 日志文件：app_logs_dir/latest.log
/// - 日志轮转：按大小（128KB）或数量（7个文件）
/// - 日志清理：保留最近 7 天的日志
#[cfg(not(debug_assertions))]
fn init_logger() -> Result<()> {
    let log_dir = paths::app_logs_dir()?;
    let spec = LogSpecBuilder::new()
        .default(log::LevelFilter::Info)
        .build();

    // 生产环境：过滤噪音模块
    let logger = Logger::with(spec)
        .log_to_file(FileSpec::default().directory(&log_dir).basename("app"))
        .duplicate_to_stdout(Duplicate::Info)
        .rotate(
            Criterion::Size(128 * 1024), // 128KB
            flexi_logger::Naming::TimestampsCustomFormat {
                current_infix: Some("latest"),
                format: "%Y-%m-%d_%H-%M-%S",
            },
            Cleanup::KeepLogFiles(7),
        )
        .filter(Box::new(NoModuleFilter(&[
            "wry", "tauri", "tokio", "hyper",
        ])));

    logger.start()?;
    Ok(())
}

/// 开发环境：不过滤模块，输出更详细的日志
#[cfg(debug_assertions)]
fn init_logger() -> Result<()> {
    let log_dir = paths::app_logs_dir()?;
    let spec = LogSpecBuilder::new()
        .default(log::LevelFilter::Debug)
        .build();

    let logger = Logger::with(spec)
        .log_to_file(FileSpec::default().directory(&log_dir).basename("app"))
        .duplicate_to_stdout(Duplicate::Debug)
        .rotate(
            Criterion::Size(128 * 1024), // 128KB
            flexi_logger::Naming::TimestampsCustomFormat {
                current_infix: Some("latest"),
                format: "%Y-%m-%d_%H-%M-%S",
            },
            Cleanup::KeepLogFiles(7),
        );

    logger.start()?;
    Ok(())
}

// ========== 日志清理工具 ==========

/// 清理旧日志文件（根据配置的保留天数）
/// 参数：retention_days - 保留天数（None 表示不清理）
pub async fn delete_old_logs(retention_days: Option<u32>) -> Result<()> {
    let Some(days) = retention_days else {
        logging!(
            info,
            logging_types::Type::Init,
            "Log retention disabled, skipping cleanup"
        );
        return Ok(());
    };

    let log_dir = paths::app_logs_dir()?;
    if !log_dir.exists() {
        return Ok(());
    }

    logging!(
        info,
        logging_types::Type::Init,
        "Cleaning logs older than {} days",
        days
    );

    let now = chrono::Local::now();
    let cutoff = now - chrono::Duration::days(days as i64);

    let mut deleted_count = 0;
    let mut entries = tokio::fs::read_dir(&log_dir).await?;

    while let Some(entry) = entries.next_entry().await? {
        if let Ok(metadata) = entry.metadata().await {
            if metadata.is_file() {
                if let Ok(modified) = metadata.modified() {
                    let modified_time: chrono::DateTime<chrono::Local> = modified.into();
                    if modified_time < cutoff {
                        if let Err(e) = tokio::fs::remove_file(entry.path()).await {
                            logging_error!(
                                logging_types::Type::Init,
                                "Failed to delete log file {:?}: {}",
                                entry.path(),
                                e
                            );
                        } else {
                            deleted_count += 1;
                        }
                    }
                }
            }
        }
    }

    if deleted_count > 0 {
        logging!(
            info,
            logging_types::Type::Init,
            "Deleted {} old log files",
            deleted_count
        );
    }

    Ok(())
}

// ========== 测试 ==========

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_app() {
        let result = init_app();
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_delete_old_logs() {
        let result = delete_old_logs(Some(7)).await;
        assert!(result.is_ok());
    }
}
