use tauri::{menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder}, Emitter, Manager, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Create the main window with transparent titlebar
      let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("Get Static")
        .inner_size(800.0, 600.0)
        .resizable(true);

      // Set transparent title bar only when building for macOS
      #[cfg(target_os = "macos")]
      let win_builder = win_builder.title_bar_style(TitleBarStyle::Transparent);

      let window = win_builder.build().unwrap();

      // Set background color and window styling only when building for macOS
      #[cfg(target_os = "macos")]
      {
        use cocoa::appkit::{NSColor, NSWindow};
        use cocoa::base::{id, nil};

        let ns_window = window.ns_window().unwrap() as id;
        unsafe {
          // Set a subtle background color that matches modern Mac apps
          let bg_color = NSColor::colorWithRed_green_blue_alpha_(
            nil,
            0.98,  // Very light background
            0.98,
            0.98,
            1.0,
          );
          ns_window.setBackgroundColor_(bg_color);
        }
      }

      // Create custom menu items
      let new_site = MenuItem::with_id(app, "new_site", "&New Site", true, Some("CmdOrControl+N"))?;
      let import_site = MenuItem::with_id(app, "import_site", "&Import Site", true, Some("CmdOrControl+I"))?;
      
      // Create File submenu with custom items
      let file_submenu = SubmenuBuilder::new(app, "&File")
        .item(&new_site)
        .item(&import_site)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, Some("&Close Window"))?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("&Quit"))?)
        .build()?;

      // Create Edit submenu with standard items
      let edit_submenu = SubmenuBuilder::new(app, "&Edit")
        .item(&PredefinedMenuItem::undo(app, Some("&Undo"))?)
        .item(&PredefinedMenuItem::redo(app, Some("&Redo"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("Cu&t"))?)
        .item(&PredefinedMenuItem::copy(app, Some("&Copy"))?)
        .item(&PredefinedMenuItem::paste(app, Some("&Paste"))?)
        .item(&PredefinedMenuItem::select_all(app, Some("Select &All"))?)
        .build()?;

      // Create View submenu
      let view_submenu = SubmenuBuilder::new(app, "&View")
        .item(&PredefinedMenuItem::fullscreen(app, Some("&Fullscreen"))?)
        .build()?;

      // Create Window submenu
      let window_submenu = SubmenuBuilder::new(app, "&Window")
        .item(&PredefinedMenuItem::minimize(app, Some("&Minimize"))?)
        .item(&PredefinedMenuItem::maximize(app, Some("&Maximize"))?)
        .build()?;

      // Create main menu with all submenus
      let menu = MenuBuilder::new(app)
        .item(&file_submenu)
        .item(&edit_submenu)
        .item(&view_submenu)
        .item(&window_submenu)
        .build()?;

      app.set_menu(menu)?;

      // Handle menu events
      app.on_menu_event(move |app, event| {
        match event.id().as_ref() {
          "new_site" => {
            app.emit("menu", serde_json::json!({"id": "new_site"})).unwrap();
          }
          "import_site" => {
            app.emit("menu", serde_json::json!({"id": "import_site"})).unwrap();
          }
          _ => {}
        }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
