# frozen_string_literal: true

# Pin npm packages by running ./bin/importmap

pin 'application'
pin '@hotwired/turbo-rails', to: 'turbo.min.js'
pin '@hotwired/stimulus',    to: 'stimulus.min.js'
pin '@hotwired/stimulus-loading', to: 'stimulus-loading.js'
pin_all_from 'app/javascript/controllers', under: 'controllers'
pin_all_from 'app/javascript/vendor',      under: 'vendor'
pin_all_from 'app/javascript/data',        under: 'data'

# Tabulator - JavaScript data grid library (igual que EMA)
pin 'tabulator-tables', to: 'https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/js/tabulator_esm.min.js'
