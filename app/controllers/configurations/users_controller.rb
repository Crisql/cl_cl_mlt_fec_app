# frozen_string_literal: true

module Configurations
  class UsersController < ApplicationController
    layout 'protected'

    # GET /configurations/users
    def index; end

    # GET /configurations/users/register
    def register; end

    # GET /configurations/users/edit
    def edit; end
  end
end
