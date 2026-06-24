// Constantes de dominio para creación de documentos electrónicos.
// Portado fielmente desde Angular legacy: models/constants.ts y core/enums/enums.ts

// ── DocTypes (enum string) ──────────────────────────────────
export const DOC_TYPE = {
  FE:  '01',
  ND:  '02',
  NC:  '03',
  TE:  '04',
  FEC: '08',
  FEE: '09',
  REP: '10',
}

// Dropdown DocType (solo lectura)
export const DocTypes = [
  { Id: '01', Name: 'FE'  },
  { Id: '02', Name: 'ND'  },
  { Id: '03', Name: 'NC'  },
  { Id: '04', Name: 'TE'  },
  { Id: '08', Name: 'FEC' },
  { Id: '09', Name: 'FEE' },
  { Id: '10', Name: 'REP' },
]

// Descripciones extendidas de los tipos de documento electrónico (Hacienda CR).
// Fuente única de verdad: usar en tablas/paneles que muestran el nombre completo.
export const DOC_TYPE_DESCRIPTIONS = {
  '01': 'Factura electrónica',
  '02': 'Nota de débito electrónica',
  '03': 'Nota de crédito electrónica',
  '04': 'Tiquete electrónico',
  '08': 'Factura electrónica de compra',
  '09': 'Factura electrónica de exportación',
  '10': 'Recibo electrónico de pago',
}

export const docTypeDescription = (code) =>
  DOC_TYPE_DESCRIPTIONS[String(code).padStart(2, '0')] ?? code

// ── Tipos de identificación ─────────────────────────────────
export const IdentificationType = [
  { Id: '01', Name: 'Cédula Fisica'   },
  { Id: '02', Name: 'Cedula Juridica' },
  { Id: '03', Name: 'DIMEX'           },
  { Id: '04', Name: 'NITE'            },
]

export const ForeignNonResidentIdentification = [
  ...IdentificationType,
  { Id: '05', Name: 'Extranjero No Domiciliado' },
]

export const IdentificationTypeFEC = [
  ...IdentificationType,
  { Id: '05', Name: 'Extranjero No Domiciliado' },
  { Id: '06', Name: 'No Contribuyente'          },
]

// min/max length de RcprIdeNumero por tipo de identificación
export const ID_LENGTH = {
  '01': { min: 9,  max: 9  }, // Cédula Física
  '02': { min: 10, max: 10 }, // Cédula Jurídica
  '03': { min: 11, max: 12 }, // DIMEX
  '04': { min: 10, max: 10 }, // NITE
  '05': { min: 8,  max: 20 }, // Extranjero No Domiciliado
  '06': { min: 8,  max: 20 }, // No Contribuyente
}

// ── Condiciones de venta ────────────────────────────────────
export const CondicionVentaREP = [
  { Id: '09', Name: 'Pago del servicios prestado al Estado ' },
  { Id: '11', Name: 'Pago de venta a crédito en IVA hasta 90 días ' },
].sort((a, b) => a.Id.localeCompare(b.Id))

export const CondicionVenta = [
  ...CondicionVentaREP,
  { Id: '01', Name: 'Contado' },
  { Id: '02', Name: 'Crédito' },
  { Id: '03', Name: 'Consignación' },
  { Id: '04', Name: 'Apartado' },
  { Id: '05', Name: 'Arrendamiento con opción de compra' },
  { Id: '06', Name: 'Arrendamiento en función financiera' },
  { Id: '07', Name: 'Cobro a favor de un tercero' },
  { Id: '08', Name: 'Servicios prestados al Estado a crédito' },
  { Id: '10', Name: 'Venta a crédito en IVA hasta 90 días' },
  { Id: '14', Name: 'Arrendamiento Operativo' },
  { Id: '15', Name: 'Arrendamiento Financiero' },
  { Id: '99', Name: 'Otros' },
]

export const CondicionVentaFE = [
  ...CondicionVenta,
  { Id: '12', Name: 'Venta de Mercancía No Nacionalizada' },
  { Id: '13', Name: 'Venta Bienes Usados No Contribuyente' },
].sort((a, b) => a.Id.localeCompare(b.Id))

// ── Tipos de documento de referencia ────────────────────────
export const TipoDocRefList = [
  { Id: '01', Value: 'Factura electrónica' },
  { Id: '02', Value: 'Nota de débito electrónica' },
  { Id: '03', Value: 'Nota de crédito electrónica' },
  { Id: '04', Value: 'Tiquete electrónico' },
  { Id: '05', Value: 'Nota de despacho' },
  { Id: '06', Value: 'Contrato' },
  { Id: '07', Value: 'Procedimiento' },
  { Id: '08', Value: 'Comprobante emitido en contingencia' },
  { Id: '10', Value: 'Comprobante electrónico rechazado por el Ministerio de Hacienda' },
  { Id: '11', Value: 'Sustituye factura rechazada por el Receptor del comprobante' },
  { Id: '12', Value: 'Sustituye Factura de exportación' },
  { Id: '13', Value: 'Facturación mes vencido' },
  { Id: '14', Value: 'Comprobante aportado por contribuyente de Régimen Especial.' },
  { Id: '15', Value: 'Sustituye una Factura electrónica de Compra ' },
  { Id: '16', Value: 'Comprobante de Proveedor No Domiciliado. ' },
  { Id: '17', Value: 'Nota de Crédito a Factura Electrónica de Compra.' },
  { Id: '18', Value: 'Nota de Débito a Factura Electrónica de Compra. ' },
  { Id: '99', Value: 'Otros' },
]

export const TipoDocRefREPList = TipoDocRefList.filter(d => ['01','02','03','04','07','08','10'].includes(d.Id))

export const TipoDocRefNotesList = [
  ...TipoDocRefList,
  { Id: '09', Value: 'Devolución mercadería' },
].sort((a, b) => a.Id.localeCompare(b.Id))

export const CodigoRefList = [
  { Id: '01', Value: 'Anula Documento de Referencia' },
  { Id: '02', Value: 'Corrige monto' },
  { Id: '04', Value: 'Referencia a otro documento' },
  { Id: '05', Value: 'Sustituye comprobante provisional por contingencia' },
  { Id: '06', Value: 'Devolución de mercadería' },
  { Id: '07', Value: 'Sustituye Comprobante electrónico' },
  { Id: '08', Value: 'Factura Endosada' },
  { Id: '09', Value: 'Nota de crédito financiera' },
  { Id: '10', Value: 'Nota de débito financiera' },
  { Id: '11', Value: 'Proveedor No Domiciliado' },
  { Id: '12', Value: 'Crédito por exoneración posterior a la facturación' },
  { Id: '99', Value: 'Otros' },
]

// ── Medios de pago ──────────────────────────────────────────
export const PaymentMethod = [
  { Id: '01', Value: 'Efectivo' },
  { Id: '02', Value: 'Tarjeta' },
  { Id: '03', Value: 'Cheque' },
  { Id: '04', Value: 'Transferencia - depósito bancario' },
  { Id: '05', Value: 'Recaudado por terceros' },
  { Id: '06', Value: 'SINPE MOVIL' },
  { Id: '07', Value: 'Plataforma Digital' },
  { Id: '99', Value: 'Otros' },
]

// ── Moneda ATV ──────────────────────────────────────────────
export const CurrencyATV = [
  { Id: 'CRC', Value: 'Colones' },
  { Id: 'USD', Value: 'Dólares' },
  { Id: 'EUR', Value: 'Euros' },
]

export const CURRENCY_SYMBOL = { CRC: '₡', USD: '$', EUR: '€' }

// ── Tipo de producto (add-item) ─────────────────────────────
export const ProductType = [
  { Id: '01', Value: 'Producto' },
  { Id: '02', Value: 'Servicio' },
]

// ── Tipo de documento de exoneración (add-item) ─────────────
export const ExonerationDocType = [
  { Id: '00', Value: '-- Ninguno --' },
  { Id: '01', Value: 'Compras autorizadas por la Dirección General de Tributación' },
  { Id: '02', Value: 'Ventas exentas a diplomáticos' },
  { Id: '03', Value: 'Autorizado por Ley especial' },
  { Id: '04', Value: 'Exenciones Dirección General de Hacienda Autorización Local Genérica' },
  { Id: '05', Value: 'Exenciones Dirección General de Hacienda Transitorio V (servicios de ingeniería, etc.)' },
  { Id: '06', Value: 'Servicios turísticos inscritos ante el ICT' },
  { Id: '07', Value: 'Transitorio XVII (Recolección, Clasificación, almacenamiento de Reciclaje y reutilizable)' },
  { Id: '08', Value: 'Exoneración a Zona Franca' },
  { Id: '09', Value: 'Exoneración de servicios complementarios para la exportación articulo 11 RLIVA' },
  { Id: '10', Value: 'Órgano de las corporaciones municipales' },
  { Id: '11', Value: 'Exenciones Dirección General de Hacienda Autorización de Impuesto Local Concreta' },
  { Id: '99', Value: 'Otros' },
]

// ── Tipo de transacción (add-item) ──────────────────────────
export const TipoTransaccion = [
  { Id: '01', Value: 'Venta Normal de Bienes y Servicios (Transacción General)' },
  { Id: '02', Value: 'Mercancía de Autoconsumo exento' },
  { Id: '03', Value: 'Mercancía de Autoconsumo gravado' },
  { Id: '04', Value: 'Servicio de Autoconsumo exento' },
  { Id: '05', Value: 'Servicio de Autoconsumo gravado' },
  { Id: '06', Value: 'Cuota de afiliación' },
  { Id: '07', Value: 'Cuota de afiliación Exenta' },
  { Id: '08', Value: 'Bienes de Capital para el emisor' },
  { Id: '09', Value: 'Bienes de Capital para el receptor' },
  { Id: '10', Value: 'Bienes de Capital para el emisor y el receptor' },
  { Id: '11', Value: 'Bienes de capital de autoconsumo exento para el emisor' },
  { Id: '12', Value: 'Bienes de capital sin contraprestación a terceros exento para el emisor' },
  { Id: '13', Value: 'Sin contraprestación a terceros' },
]

// ── Código de descuento (add-item) ──────────────────────────
export const CodigoDescuentoList = [
  { Id: '01', Value: 'Descuento por Regalia' },
  { Id: '02', Value: 'Descuento por Regalia IVA Cobrado al Cliente' },
  { Id: '03', Value: 'Descuento por Bonificación' },
  { Id: '04', Value: 'Descuento por volumen' },
  { Id: '05', Value: 'Descuento por Temporada (estacional)' },
  { Id: '06', Value: 'Descuento promocional' },
  { Id: '07', Value: 'Descuento Comercial' },
  { Id: '08', Value: 'Descuento por frecuencia' },
  { Id: '09', Value: 'Descuento sostenido' },
  { Id: '99', Value: 'Otros descuentos' },
]

// ── Código de tarifa IVA (add-item) ─────────────────────────
export const CodigoTarifaList = [
  { Id: '01', Value: 'Tarifa 0% (Artículo 32, num 1, RLIVA)', Rate: 0 },
  { Id: '02', Value: 'Tarifa reducida 1%', Rate: 1 },
  { Id: '03', Value: 'Tarifa reducida 2%', Rate: 2 },
  { Id: '04', Value: 'Tarifa reducida 4%', Rate: 4 },
  { Id: '05', Value: 'Transitorio 0%', Rate: 0 },
  { Id: '06', Value: 'Transitorio 4%', Rate: 4 },
  { Id: '07', Value: 'Transitoria 8%', Rate: 8 },
  { Id: '08', Value: 'Tarifa general 13%', Rate: 13 },
  { Id: '09', Value: 'Tarifa reducida 0.5%', Rate: 0.5 },
  { Id: '10', Value: 'Tarifa Exenta', Rate: 0 },
  { Id: '11', Value: 'Tarifa 0% sin derecho a crédito', Rate: 0 },
]

// ── Instituciones de exoneración (add-item) ─────────────────
export const InstExoList = [
  { Id: '01', Value: 'Ministerio de Hacienda' },
  { Id: '02', Value: 'Ministerio de Relaciones Exteriores y Culto' },
  { Id: '03', Value: 'Ministerio de Agricultura y Ganadería' },
  { Id: '04', Value: 'Ministerio de Economía, Industria y Comercio' },
  { Id: '05', Value: 'Cruz Roja Costarricense' },
  { Id: '06', Value: 'Benemérito Cuerpo de Bomberos de Costa Rica' },
  { Id: '07', Value: 'Asociación Obras del Espíritu Santo' },
  { Id: '08', Value: 'Federación Cruzada Nacional de protección al Anciano (Fecunapa)' },
  { Id: '09', Value: 'Escuela de Agricultura de la Región Húmeda (EARTH)' },
  { Id: '10', Value: 'Instituto Centroamericano de Administración de Empresas (INCAE)' },
  { Id: '11', Value: 'Junta de Protección Social (JPS)' },
  { Id: '12', Value: 'Autoridad Reguladora de los Servicios Públicos (Aresep)' },
  { Id: '99', Value: 'Otros' },
]
