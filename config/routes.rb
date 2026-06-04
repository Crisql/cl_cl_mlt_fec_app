# frozen_string_literal: true

Rails.application.routes.draw do
  match '/api/*path', to: 'proxy#forward', via: :all

  get  '/login',   to: 'sessions#new',  as: :login
  get  '/sign-in', to: redirect('/login')
  get  '/home',    to: 'home#index',    as: :home

  namespace :configurations do
    get 'permissions',         to: 'permissions#index', as: :permissions
    get 'permissions/by-role', to: 'permissions#index', as: :permissions_by_role
    get 'permissions/global',  to: 'permissions#index', as: :permissions_global
  end

  root to: 'sessions#new'
end
