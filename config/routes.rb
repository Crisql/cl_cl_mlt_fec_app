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

    # Companies
    get 'companies',          to: 'companies#index', as: :companies
    get 'companies/new',      to: 'companies#new',   as: :new_company
    get 'companies/:id/edit', to: 'companies#edit',  as: :edit_company

    # Connections
    get 'connections',          to: 'connections#index', as: :connections
    get 'connections/new',      to: 'connections#new',   as: :new_connection
    get 'connections/:id/edit', to: 'connections#edit',  as: :edit_connection
  end

  root to: 'sessions#new'
end
