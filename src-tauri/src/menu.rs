// Native macOS menu configuration for LumenX Studio

use tauri::menu::{Menu, MenuItem, Submenu, PredefinedMenuItem};

/// Build the full native macOS menu bar
pub fn build_menu(app: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let menu = Menu::new(app)?;

    // ─── App Menu ───
    let app_menu = Submenu::with_items(
        app,
        "影伴 Studio",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("关于 影伴 Studio"), Default::default())?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "preferences", "偏好设置...", true, Some("CmdOrCtrl+,"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    // ─── File Menu ───
    let file_menu = Submenu::with_items(
        app,
        "文件",
        true,
        &[
            &MenuItem::with_id(app, "new_project", "新建工程", true, Some("CmdOrCtrl+N"))?,
            &MenuItem::with_id(app, "open_project", "打开工程...", true, Some("CmdOrCtrl+O"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    // ─── Edit Menu ───
    let edit_menu = Submenu::with_items(
        app,
        "编辑",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    // ─── View Menu ───
    let view_menu = Submenu::with_items(
        app,
        "视图",
        true,
        &[
            &MenuItem::with_id(app, "zoom_in", "放大", true, Some("CmdOrCtrl+="))?,
            &MenuItem::with_id(app, "zoom_out", "缩小", true, Some("CmdOrCtrl+-"))?,
            &MenuItem::with_id(app, "zoom_reset", "实际大小 (100%)", true, Some("CmdOrCtrl+0"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;

    // ─── Window Menu ───
    let window_menu = Submenu::with_items(
        app,
        "窗口",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    // ─── Help Menu ───
    let help_menu = Submenu::with_items(
        app,
        "帮助",
        true,
        &[
            &MenuItem::with_id(app, "docs", "使用文档与教程", true, None::<&str>)?,
            &MenuItem::with_id(app, "release_notes", "更新发布日志", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "report_issue", "反馈问题与建议...", true, None::<&str>)?,
        ],
    )?;

    menu.append(&app_menu)?;
    menu.append(&file_menu)?;
    menu.append(&edit_menu)?;
    menu.append(&view_menu)?;
    menu.append(&window_menu)?;
    menu.append(&help_menu)?;

    Ok(menu)
}
