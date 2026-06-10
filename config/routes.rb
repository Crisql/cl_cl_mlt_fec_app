# frozen_string_literal: true

Rails.application.routes.draw do
  match '/api/*path', to: 'proxy#forward', via: :all

  get  '/login',   to: 'sessions#new',  as: :login
  get  '/sign-in', to: redirect('/login')
  get  '/home',    to: 'home#index',    as: :home

  namespace :configurations do
    get 'permissions',         to: 'permissions#index',  as: :permissions
    get 'permissions/by-role', to: 'permissions#index',  as: :permissions_by_role
    get 'permissions/global',  to: 'permissions#index',  as: :permissions_global
    get 'user-profile',        to: 'user_profile#index', as: :user_profile
    get 'roles',               to: 'roles#index',        as: :roles
    get 'roles-by-users',      to: 'roles_by_users#index', as: :roles_by_users
    get 'general',             to: 'general#index',      as: :general
    get 'numbering',           to: 'numbering#index',    as: :numbering
    get 'branches',            to: 'branches#index',     as: :branches

    # Companies
    get 'companies',          to: 'companies#index', as: :companies
    get 'companies/new',      to: 'companies#new',   as: :new_company
    get 'companies/:id/edit', to: 'companies#edit',  as: :edit_company

    # Group
    get 'group', to: 'group#index', as: :group

    # Connections
    get 'connections',          to: 'connections#index', as: :connections
    get 'connections/new',      to: 'connections#new',   as: :new_connection
    get 'connections/:id/edit', to: 'connections#edit',  as: :edit_connection

    # Mail Parser (procesadores de correo entrante)
    get 'mail-parser', to: 'mail_parser#index', as: :mail_parser

    # Email Senders (bandejas de envío + asignación a compañías)
    # Reemplaza la ruta Angular /emailInbox
    get 'email-senders', to: 'email_senders#index', as: :email_senders
  end

  namespace :documents do
    get 'issued',                 to: 'issued#index',      as: :issued
    get 'receptions',             to: 'receptions#index',  as: :receptions
    get 'receptions/:id/create',  to: 'receptions#create', as: :create_reception

    # Creacion de documentos electronicos (FE 01, ND 02, NC 03, FEC 08, REP 10)
    # Reemplaza la ruta Angular /createDocument/:docType
    get ':type/create', to: 'create#index', as: :create_document,
        constraints: { type: /01|02|03|08|10/ }
  end

  get 'documents-reports',   to: 'documents/reports#index',              as: :documents_reports
  get 'reception_documents', to: 'documents/reception_documents#index',  as: :reception_documents

  root to: 'sessions#new'
end
