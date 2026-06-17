export default [
  {
    key: 'home',
    label: 'Inicio',
    icon: 'house',
    route: '/home',
    visible: true,
    nodes: []
  },
  {
    key: 'documents',
    label: 'Documentos',
    icon: 'folder_open',
    route: null,
    visible: false,
    requiredPermission: 'M_Documents',
    nodes: [
      { key: 'issued_documents',    label: 'Documentos Emitidos',         route: '/documents/issued',           requiredPermission: 'Documents_Issued_ViewDocuments' },
      { key: 'accept_documents',    label: 'Aceptación Documentos',       route: '/documents/receptions',       requiredPermission: 'Documents_Reception_ViewDocuments' },
      { key: 'accept_documents_gt', label: 'Aceptación Documentos GT',    route: '/documents/gt/receptions',    requiredPermission: 'S_AcceptDocsGT' },
      { key: 'reception_documents', label: 'Recepción Documentos',        route: '/reception_documents',        requiredPermission: 'S_ReceptDocs' },
      { key: 'mailParser',          label: 'Logs de Correo de Recepción', route: '/documents/receptions/logs', requiredPermission: 'S_MailParserLogs' },
      { key: 'email_report',        label: 'Reporte de correos',          route: '/documents/emails',               requiredPermission: 'S_EmailReport' },
      { key: 'createFE',            label: 'Creación FE',                 route: '/documents/01/create',        requiredPermission: 'S_CreateDocsFE' },
      { key: 'createND',            label: 'Creación ND',                 route: '/documents/02/create',        requiredPermission: 'S_CreateDocsND' },
      { key: 'createNC',            label: 'Creación NC',                 route: '/documents/03/create',        requiredPermission: 'S_CreateDocsNC' },
      { key: 'createFEC',           label: 'Creación FEC',                route: '/documents/08/create',        requiredPermission: 'S_CreateDocsFEC' },
      { key: 'createREP',           label: 'Creación REP',                route: '/documents/10/create',        requiredPermission: 'S_CreateDocsREP' }
    ]
  },
  {
    key: 'reports',
    label: 'Reportes',
    icon: 'print',
    route: '/documents-reports',
    visible: false,
    requiredPermission: ['S_DocumentReport', 'S_DocumentReceptionReport'],
    nodes: []
  },
  {
    key: 'settings',
    label: 'Configuración',
    icon: 'settings_suggest',
    route: null,
    visible: false,
    requiredPermission: 'M_Config',
    nodes: [
      { key: 'user-profile',     label: 'Perfil de Usuario',              route: '/configurations/user-profile',   requiredPermission: 'S_UpdateUserInfo' },
      { key: 'company',          label: 'Compañías',                      route: '/configurations/companies',      requiredPermission: 'S_Company' },
      { key: 'connections',      label: 'Conexiones',                     route: '/configurations/connections',    requiredPermission: 'Configurations_Connections_Access' },
      { key: 'udfs',             label: 'Campos definidos por usuario',   route: '/configurations/udfs',           requiredPermission: 'S_Udfs' },
      { key: 'users',            label: 'Usuarios',                       route: '/configurations/users',          requiredPermission: 'Configurations_Users_Access' },
      { key: 'groups',           label: 'Grupos',                         route: '/configurations/group',          requiredPermission: 'S_Groups' },
      { key: 'numbering',        label: 'Numeración',                     route: '/configurations/numbering',      requiredPermission: 'S_Numbering' },
      { key: 'permissions',      label: 'Permisos',                       route: '/configurations/permissions',    requiredPermission: 'Configurations_Permissions_Access' },
      { key: 'Rol',              label: 'Roles',                          route: '/configurations/roles',          requiredPermission: 'S_Rols' },
      { key: 'rolUserCompany',   label: 'Roles por usuario',              route: '/configurations/roles-by-users', requiredPermission: 'S_RolByUser' },
      { key: 'sucursal',         label: 'Sucursal',                       route: '/configurations/branches',       requiredPermission: 'S_Sucursal' },
      { key: 'wizardSetup',      label: 'Asistente de Configuración',     route: '/wizard-setup',                  requiredPermission: 'Configurations_WizardSetup_Access' },
      { key: 'mailParserConfig', label: 'Procesador de Correos',          route: '/configurations/mail-parser',    requiredPermission: ['Configurations_MailParser_ViewConfigurations', 'Configurations_MailParser_ViewAllConfigurationsInApplication'] },
      { key: 'emailInbox',       label: 'Asignación de bandejas',         route: '/configurations/email-senders',  requiredPermission: 'Maintenance_EmailInbox_Access' },
      { key: 'userHelp',         label: 'Enlaces de documentación',       route: '/user-help',                     requiredPermission: 'Configurations_UserHelp_Access' },
      { key: 'generalConfigs',   label: 'Generales',                      route: '/configurations/general',        requiredPermission: 'Configurations_General_Access' }
    ]
  },
  {
    key: 'textFilesLogs',
    label: 'Logs',
    icon: 'terminal',
    route: '/logs',
    visible: false,
    requiredPermission: 'Logs_Access',
    nodes: []
  },
  {
    key: 'logout',
    label: 'Cerrar sesión',
    icon: 'logout',
    route: '/login',
    visible: true,
    nodes: []
  }
]
