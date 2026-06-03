// Registro de Stimulus controllers
// Convención: archivo login_controller.js → data-controller="login"

import { application } from 'controllers/application'

import LoginController    from 'controllers/login_controller'
import AuthGuardController from 'controllers/auth_guard_controller'

application.register('login',      LoginController)
application.register('auth-guard', AuthGuardController)
