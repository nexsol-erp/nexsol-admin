fn main() {
    // Fluent everywhere, so the app looks the same on every Windows PC (and in screenshots).
    let config = slint_build::CompilerConfiguration::new().with_style("fluent-light".into());
    slint_build::compile_with_config("ui/main.slint", config).expect("Slint build failed");
}
