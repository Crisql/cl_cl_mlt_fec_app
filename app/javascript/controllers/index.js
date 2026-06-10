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
import CompaniesController        from 'controllers/companies_controller'
import CompanyFormController      from 'controllers/company_form_controller'
import ConnectionsController      from 'controllers/connections_controller'
import ConnectionFormController   from 'controllers/connection_form_controller'
import NumberingController        from 'controllers/numbering_controller'
import RolesByUsersController     from 'controllers/roles_by_users_controller'
import GroupController            from 'controllers/group_controller'
import BranchesController         from 'controllers/branches_controller'
import DocumentsIssuedController   from 'controllers/documents_issued_controller'
import DocumentsReportsController    from 'controllers/documents_reports_controller'
import DocumentsReceptionController  from 'controllers/documents_reception_controller'
import DocumentsReceptionsController      from 'controllers/documents_receptions_controller'
import DocumentsReceptionCreateController from 'controllers/documents_reception_create_controller'
import DocumentsCreateController          from 'controllers/documents_create_controller'
import MailParserController               from 'controllers/mail_parser_controller'
import EmailSendersController             from 'controllers/email_senders_controller'

application.register('login',             LoginController)
application.register('auth-guard',        AuthGuardController)
application.register('home',              HomeController)
application.register('menu',              MenuController)
application.register('company-selector',  CompanySelectorController)
application.register('permissions',       PermissionsController)
application.register('user-profile',      UserProfileController)
application.register('roles',             RolesController)
application.register('general-configs',   GeneralConfigsController)
application.register('companies',         CompaniesController)
application.register('company-form',      CompanyFormController)
application.register('connections',       ConnectionsController)
application.register('connection-form',   ConnectionFormController)
application.register('numbering',         NumberingController)
application.register('roles-by-users',    RolesByUsersController)
application.register('group',             GroupController)
application.register('branches',          BranchesController)
application.register('documents-issued',  DocumentsIssuedController)
application.register('documents-reports',    DocumentsReportsController)
application.register('documents-reception',  DocumentsReceptionController)
application.register('documents-receptions',       DocumentsReceptionsController)
application.register('documents-reception-create', DocumentsReceptionCreateController)
application.register('documents-create',           DocumentsCreateController)
application.register('mail-parser',     MailParserController)
application.register('email-senders',   EmailSendersController)
