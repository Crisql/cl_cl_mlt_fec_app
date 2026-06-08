# Be sure to restart your server when you modify this file.

# Version of your assets, change this if you want to expire all your assets.
Rails.application.config.assets.version = "1.0"

# Incluir app/javascript en el asset load path para que asset_path() resuelva
# archivos del vendor (e.g. tabulator.css). Igual que EMA.
Rails.application.config.assets.paths << Rails.root.join("app/javascript")
