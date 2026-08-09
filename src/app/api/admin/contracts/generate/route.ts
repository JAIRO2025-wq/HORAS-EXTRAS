import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const templatesDir = path.join(process.cwd(), 'public', 'plantillas');

/**
 * Mapea los datos del contrato a los placeholders de la plantilla de CONTRATO LABORAL (55 campos)
 */
function mapContratoData(contractData: Record<string, any>): Record<string, string> {
  const dependientes = contractData.dependientes || [];
  const data: Record<string, string> = {
    RAZON_SOCIAL_EMPRESA: contractData.razonSocialEmpresa || '',
    ABREVIATURA_EMPRESA: contractData.abreviaturaEmpresa || '',
    NOMBRE_EMPLEADOR: contractData.nombreEmpleador || '',
    DUI_EMPLEADOR: contractData.duiEmpleador || '',
    NIT_EMPLEADOR: contractData.nitEmpleador || '',
    EDAD_EMPLEADOR: contractData.edadEmpleador || '',
    SEXO_EMPLEADOR: contractData.sexoEmpleador || '',
    NACIONALIDAD_EMPLEADOR: contractData.nacionalidadEmpleador || '',
    ESTADO_FAMILIAR_EMPLEADOR: contractData.estadoFamiliarEmpleador || '',
    PROFESION_EMPLEADOR: contractData.profesionEmpleador || '',
    DOMICILIO_EMPLEADOR: contractData.domicilioEmpleador || '',
    LUGAR_EXPEDICION_DUI_EMPLEADOR: contractData.lugarExpedicionDuiEmpleador || '',
    FECHA_EXPEDICION_DUI_EMPLEADOR: contractData.fechaExpedicionDuiEmpleador || '',
    NOMBRE_EMPLEADO: contractData.nombreEmpleado || '',
    DUI_EMPLEADO: contractData.duiEmpleado || '',
    NIT_EMPLEADO: contractData.nitEmpleado || '',
    EDAD_EMPLEADO: contractData.edadEmpleado || '',
    SEXO_EMPLEADO: contractData.sexoEmpleado || '',
    NACIONALIDAD_EMPLEADO: contractData.nacionalidadEmpleado || '',
    ESTADO_FAMILIAR_EMPLEADO: contractData.estadoFamiliarEmpleado || '',
    PROFESION_EMPLEADO: contractData.profesionEmpleado || '',
    DOMICILIO_EMPLEADO: contractData.domicilioEmpleado || '',
    RESIDENCIA_EMPLEADO: contractData.residenciaEmpleado || '',
    LUGAR_EXPEDICION_DUI_EMPLEADO: contractData.lugarExpedicionDuiEmpleado || '',
    FECHA_EXPEDICION_DUI_EMPLEADO: contractData.fechaExpedicionDuiEmpleado || '',
    CARGO_PUESTO: contractData.cargoPuesto || '',
    REPRESENTANTE_LEGAL_EMPRESA: contractData.representanteLegalEmpresa || contractData.nombreEmpleador || '',
    TIPO_DURACION_CONTRATO: contractData.tipoDuracionContrato || '',
    PERIODO_CONTRATO: contractData.periodoContrato || '',
    FECHA_INICIO_SERVICIO: contractData.fechaInicioServicio || contractData.startDate || '',
    LUGAR_PRESTACION_SERVICIOS: contractData.lugarPrestacionServicios || '',
    DIRECCION_PRESTACION_SERVICIOS: contractData.direccionPrestacionServicios || '',
    HORAS_SEMANA_LABORAL: contractData.horasSemanaLaboral || '',
    HORARIO_DE_TRABAJO: contractData.horarioDeTrabajo || '',
    SALARIO_EN_NUMEROS: contractData.salarioEnNumeros || '',
    SALARIO_EN_LETRAS: contractData.salarioEnLetras || '',
    FORMA_Y_PERIODO_PAGO: contractData.formaYPeriodoPago || '',
    NOMBRE_EMPRESA_PAGO: contractData.nombreEmpresaPago || contractData.razonSocialEmpresa || '',
    DIRECCION_LUGAR_PAGO: contractData.direccionLugarPago || '',
    OBLIGACIONES_Y_FUNCIONES_CARGO: contractData.obligacionesYFuncionesCargo || '',
    LISTA_HERRAMIENTAS_Y_MATERIALES: contractData.listaHerramientasYMateriales || '',
    INCENTIVOS_ADICIONALES: contractData.incentivosAdicionales || '',
    DISTRITO_FIRMA: contractData.distritoFirma || '',
    FECHA_FIRMA_EN_LETRAS: contractData.fechaFirmaEnLetras || '',
  };

  for (let i = 1; i <= 2; i++) {
    const dep = dependientes[i - 1];
    data[`NOMBRE_DEPENDIENTE_${i}`] = dep?.nombre || '';
    data[`APELLIDO_DEPENDIENTE_${i}`] = dep?.apellido || '';
    data[`EDAD_DEPENDIENTE_${i}`] = dep?.edad || '';
    data[`PARENTESCO_DEPENDIENTE_${i}`] = dep?.parentesco || '';
    data[`DIRECCION_DEPENDIENTE_${i}`] = dep?.direccion || '';
  }

  return data;
}

/**
 * Mapea los datos a los placeholders de la plantilla de CONFIDENCIALIDAD (9 campos)
 */
function mapConfidencialidadData(contractData: Record<string, any>): Record<string, string> {
  return {
    RAZON_SOCIAL_EMPRESA: contractData.razonSocialEmpresa || '',
    NOMBRE_REPRESENTANTE_LEGAL: contractData.nombreEmpleador || contractData.representanteLegalEmpresa || '',
    NOMBRE_EMPLEADO: contractData.nombreEmpleado || '',
    CARGO_PUESTO: contractData.cargoPuesto || '',
    DUI_EMPLEADO: contractData.duiEmpleado || '',
    DIRECCION_INSTALACIONES_EMPRESA: contractData.direccionInstalacionesEmpresa || contractData.direccionPrestacionServicios || '',
    DISTRITO_FIRMA: contractData.distritoFirma || '',
    FECHA_FIRMA_EN_LETRAS: contractData.fechaFirmaEnLetras || '',
    CIUDAD_JURISDICCION_TRIBUNALES: contractData.ciudadJurisdiccionTribunales || '',
  };
}

/**
 * Mapea los datos a los placeholders de la plantilla de CONSTANCIA DE SALARIO (21 campos)
 */
function mapConstanciaData(contractData: Record<string, any>): Record<string, string> {
  return {
    RAZON_SOCIAL_EMPRESA: contractData.razonSocialEmpresa || '',
    NOMBRE_EMPLEADO: contractData.nombreEmpleado || '',
    DUI_EMPLEADO: contractData.duiEmpleado || '',
    CARGO_PUESTO: contractData.cargoPuesto || '',
    FECHA_INGRESO: contractData.fechaIngreso || contractData.fechaInicioServicio || contractData.startDate || '',
    SALARIO_EN_NUMEROS: contractData.salarioEnNumeros || '',
    SALARIO_EN_LETRAS: contractData.salarioEnLetras || '',
    SUELDO_BASE: contractData.sueldoBase || contractData.salarioEnNumeros || '',
    DEDUCCION_ISSS: contractData.deduccionIsss || '',
    DEDUCCION_AFP: contractData.deduccionAfp || '',
    DEDUCCION_ISR: contractData.deduccionIsr || '',
    DEDUCCION_OTROS: contractData.deduccionOtros || '',
    TOTAL_DEDUCCIONES: contractData.totalDeducciones || '',
    OTROS_INGRESOS: contractData.otrosIngresos || '',
    TOTAL_INGRESOS: contractData.totalIngresos || '',
    LIQUIDO_A_PAGAR: contractData.liquidoAPagar || '',
    NOMBRE_REPRESENTANTE_RRHH: contractData.nombreRepresentanteRrhh || '',
    CARGO_REPRESENTANTE_RRHH: contractData.cargoRepresentanteRrhh || '',
    DESTINATARIO_INSTITUCION_O_PERSONA: contractData.destinatarioInstitucionOPersona || '',
    CIUDAD_EMISION: contractData.ciudadEmision || contractData.distritoFirma || '',
    FECHA_EMISION_EN_LETRAS: contractData.fechaEmisionEnLetras || '',
  };
}

type TemplateMapper = (data: Record<string, any>) => Record<string, string>;
type TemplateConfig = { templateName: string; mapper: TemplateMapper; updateField: string };

const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {
  contrato: {
    templateName: 'plantilla contrato.docx',
    mapper: mapContratoData,
    updateField: 'contractGeneratedUrl',
  },
  confidencialidad: {
    templateName: 'confidencialidad.docx',
    mapper: mapConfidencialidadData,
    updateField: 'confidentialityGeneratedUrl',
  },
  salario: {
    templateName: 'constancias.docx',
    mapper: mapConstanciaData,
    updateField: 'salaryCertificateUrl',
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { templateName, contractData } = body;

    if (!templateName || !contractData) {
      return NextResponse.json({ error: 'Faltan templateName y contractData' }, { status: 400 });
    }

    const config = TEMPLATE_CONFIGS[templateName];
    if (!config) {
      return NextResponse.json({ error: `Tipo de plantilla "${templateName}" no reconocido. Usar: contrato, confidencialidad, salario` }, { status: 400 });
    }

    const templatePath = path.join(templatesDir, config.templateName);

    try {
      await fs.access(templatePath);
    } catch {
      return NextResponse.json({ error: `Plantilla "${config.templateName}" no encontrada en public/plantillas/` }, { status: 404 });
    }

    const data = config.mapper(contractData);

    const templateBuffer = await fs.readFile(templatePath);
    const zip = new PizZip(templateBuffer);

    const doc = new Docxtemplater(zip, {
      delimiters: { start: '[', end: ']' },
      paragraphLoop: true,
      linebreaks: true,
    });

    await doc.renderAsync(data);

    const outputBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'contratos');
    await fs.mkdir(outputDir, { recursive: true });

    const employeeName = (contractData.nombreEmpleado || 'empleado')
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    const tipoLabel =
      templateName === 'contrato' ? 'Contrato'
      : templateName === 'confidencialidad' ? 'Carta_Confidencialidad'
      : 'Constancia_Salario';
    const fileName = `${tipoLabel}_${employeeName}_${Date.now()}.docx`;
    const outputPath = path.join(outputDir, fileName);
    await fs.writeFile(outputPath, outputBuffer as Buffer);

    const publicUrl = `/uploads/contratos/${fileName}`;

    return NextResponse.json({ url: publicUrl, fileName });
  } catch (error) {
    console.error('Error generando documento:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
