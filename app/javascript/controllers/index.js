// Registro de Stimulus controllers
// Convencion: archivo login_controller.js -> data-controller="login"

import { application } from 'controllers/application'

import LoginController           from 'controllers/login_controller'
import AuthGuardController       from 'controllers/auth_guard_controller'
import HomeController            from 'controllers/home_controller'
import MenuController            from 'controllers/menu_controller'
import CompanySelectorController from 'controllers/company_selector_controller'
import PermissionsController     from 'controllers/permissions_controller'
import UserProfileController     from 'controllers/user_profile_controller'
import RolesController          from 'controllers/roles_controller'
import GeneralConfigsController  from 'controllers/general_configs_controller'

application.register('login',            LoginController)
application.register('auth-guard',       AuthGuardController)
application.register('home',             HomeController)
application.register('menu',             MenuController)
application.register('company-selector', CompanySelectorController)
application.register('permissions',      PermissionsController)
application.register('user-profile',     UserProfileController)
application.register('roles',            RolesController)
application.register('general-configs',  GeneralConfigsController)
