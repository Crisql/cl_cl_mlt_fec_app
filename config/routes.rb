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
    get 'general',             to: 'general#index',      as: :general
  end

  root to: 'sessions#new'
end
