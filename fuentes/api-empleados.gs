/**
 * Google Apps Script - API de Empleados
 * 
 * ============================================
 * PASOS PARA DESPLEGAR:
 * ============================================
 * 1. Abre tu hoja de Google Sheets
 * 2. Ve a: Extensiones > Apps Script
 * 3. Pega este código completo
 * 4. Haz clic en "Implementar" > "Nueva implementación"
 * 5. Tipo: "Aplicación web"
 * 6. Ejecutar como: "Yo"
 * 7. Acceso: "Cualquiera" (o "Cualquiera con cuenta de Google")
 * 8. Haz clic en "Implementar" y copia la URL (termina en /exec)
 * 9. Pega esa URL como SHEETS_API_URL en tu .env.local
 * ============================================
 * 
 * ENDPOINTS:
 * GET ?codigo=1   → busca empleado por código (devuelve todos los datos)
 * GET ?todos=1    → lista TODOS los empleados con TODOS sus datos
 * GET (sin params) → lista TODOS los empleados con TODOS sus datos
 */

// Columnas de la hoja "Datos Generales" (índice base 0):
var COL = {
  CODIGO: 0,
  NOMBRE: 1,
  DUI: 2,
  FECHA_NACIMIENTO: 3,
  LUGAR_NACIMIENTO: 4,
  NACIONALIDAD: 5,
  GENERO: 6,
  DOMICILIO: 7,
  MUNICIPIO: 8,
  DEPARTAMENTO: 9,
  BENEFICIARIOS: 10,
  PARENTESCO: 11,
  ESTADO_CIVIL: 12,
  GRADO_ACADEMICO: 13,
  TELEFONO: 14,
  CORREO_PERSONAL: 15,
  CTA_BANCARIA: 16,
  BANCO: 17,
  ISSS: 18,
  AFP: 19,
  COTIZA_EN: 20,
  CORREO_INSTITUCIONAL: 21,
  CARGO: 22,
  FECHA_INGRESO: 23,
  DIRECCION_LABORAL: 24,
  MUNICIPIO_LABORAL: 25,
  DEPARTAMENTO_LABORAL: 26,
  SALARIO: 27
};

/**
 * Convierte un valor de celda a texto limpio.
 * Maneja objetos Date (los convierte a "DD/MM/YYYY").
 */
function valorTexto(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    var d = new Date(valor.getTime());
    var dd = ('0' + d.getDate()).slice(-2);
    var mm = ('0' + (d.getMonth() + 1)).slice(-2);
    var yyyy = d.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
  }
  return String(valor).trim();
}

/**
 * Calcula la edad a partir de una fecha de nacimiento.
 * Acepta objeto Date, texto "16 de noviembre de 1996", o "DD/MM/YYYY".
 */
function calcularEdad(valorFecha) {
  if (!valorFecha) return '';
  var fechaNac = null;
  try {
    if (valorFecha instanceof Date) {
      fechaNac = new Date(valorFecha.getTime());
    } else {
      var texto = String(valorFecha).trim();
      // Formato "16 de noviembre de 1996"
      var matchTexto = texto.match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})$/i);
      if (matchTexto) {
        var meses = {
          'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
          'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
          'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
        };
        fechaNac = new Date(parseInt(matchTexto[3]), meses[matchTexto[2].toLowerCase()], parseInt(matchTexto[1]));
      } else {
        // Intentar parseo directo (DD/MM/YYYY o Date string)
        fechaNac = new Date(texto);
        if (isNaN(fechaNac.getTime())) return '';
      }
    }
    if (isNaN(fechaNac.getTime())) return '';
    
    var hoy = new Date();
    var edad = hoy.getFullYear() - fechaNac.getFullYear();
    var mesDiff = hoy.getMonth() - fechaNac.getMonth();
    if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    return String(edad);
  } catch (e) {
    return '';
  }
}

/**
 * Convierte género M/F a Masculino/Femenino
 */
function normalizarGenero(valor) {
  var g = (valor || '').trim().toUpperCase();
  if (g === 'M' || g === 'MASCULINO') return 'Masculino';
  if (g === 'F' || g === 'FEMENINO') return 'Femenino';
  return valor || '';
}

/**
 * Normaliza estado civil
 */
function normalizarEstadoCivil(valor) {
  var v = (valor || '').trim();
  var mapa = {
    'soltero': 'Soltero', 'soltera': 'Soltera',
    'casado': 'Casado', 'casada': 'Casada',
    'divorciado': 'Divorciado', 'divorciada': 'Divorciada',
    'viudo': 'Viudo', 'viuda': 'Viuda',
    'acompañado': 'Acompañado', 'acompañada': 'Acompañada'
  };
  return mapa[v.toLowerCase()] || v;
}

/**
 * Lee todas las filas de la hoja "Datos Generales",
 * agrupa empleados con sus dependientes (filas de continuación)
 */
function obtenerEmpleados() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Datos Generales');
  if (!hoja) throw new Error('No se encontró la hoja "Datos Generales"');
  var datos = hoja.getDataRange().getValues();
  
  // Omitir cabecera (fila 1)
  var empleados = [];
  var empleadoActual = null;
  
  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    var codigo = String(fila[COL.CODIGO] || '').trim();
    
    if (codigo !== '') {
      // Es un nuevo empleado
      if (empleadoActual) empleados.push(empleadoActual);
      
      empleadoActual = {
        codigo: codigo,
        nombre: String(fila[COL.NOMBRE] || '').trim(),
        dui: valorTexto(fila[COL.DUI]),
        fechaNacimiento: valorTexto(fila[COL.FECHA_NACIMIENTO]),
        lugarNacimiento: valorTexto(fila[COL.LUGAR_NACIMIENTO]),
        nacionalidad: valorTexto(fila[COL.NACIONALIDAD]),
        genero: valorTexto(fila[COL.GENERO]),
        domicilio: valorTexto(fila[COL.DOMICILIO]),
        municipio: valorTexto(fila[COL.MUNICIPIO]),
        departamento: valorTexto(fila[COL.DEPARTAMENTO]),
        beneficiarios: valorTexto(fila[COL.BENEFICIARIOS]),
        parentesco: valorTexto(fila[COL.PARENTESCO]),
        estadoCivil: valorTexto(fila[COL.ESTADO_CIVIL]),
        gradoAcademico: valorTexto(fila[COL.GRADO_ACADEMICO]),
        telefono: valorTexto(fila[COL.TELEFONO]),
        correoPersonal: valorTexto(fila[COL.CORREO_PERSONAL]),
        ctaBancaria: valorTexto(fila[COL.CTA_BANCARIA]),
        banco: valorTexto(fila[COL.BANCO]),
        isss: valorTexto(fila[COL.ISSS]),
        afp: valorTexto(fila[COL.AFP]),
        cotizaEn: valorTexto(fila[COL.COTIZA_EN]),
        correoInstitucional: valorTexto(fila[COL.CORREO_INSTITUCIONAL]),
        cargo: valorTexto(fila[COL.CARGO]),
        fechaIngreso: valorTexto(fila[COL.FECHA_INGRESO]),
        direccionLaboral: valorTexto(fila[COL.DIRECCION_LABORAL]),
        municipioLaboral: valorTexto(fila[COL.MUNICIPIO_LABORAL]),
        departamentoLaboral: valorTexto(fila[COL.DEPARTAMENTO_LABORAL]),
        salario: valorTexto(fila[COL.SALARIO]),
        dependientes: []
      };
      
      // Agregar el primer dependiente de esta fila si existe
      var ben = String(fila[COL.BENEFICIARIOS] || '').trim();
      var par = String(fila[COL.PARENTESCO] || '').trim();
      if (ben !== '') {
        var nombrePartes = ben.split(' ');
        empleadoActual.dependientes.push({
          nombre: nombrePartes.slice(0, -1).join(' ') || ben,
          apellido: nombrePartes.length > 1 ? nombrePartes[nombrePartes.length - 1] : '',
          parentesco: par
        });
      }
    } else {
      // Fila de continuación (dependiente adicional del empleado actual)
      if (empleadoActual) {
        var ben2 = String(fila[COL.BENEFICIARIOS] || '').trim();
        var par2 = String(fila[COL.PARENTESCO] || '').trim();
        if (ben2 !== '') {
          var nombrePartes2 = ben2.split(' ');
          empleadoActual.dependientes.push({
            nombre: nombrePartes2.slice(0, -1).join(' ') || ben2,
            apellido: nombrePartes2.length > 1 ? nombrePartes2[nombrePartes2.length - 1] : '',
            parentesco: par2
          });
        }
      }
    }
  }
  
  // No olvidar el último empleado
  if (empleadoActual) empleados.push(empleadoActual);
  
  return empleados;
}

/**
 * Busca un empleado por código (compara como número, ignora formato 0001 vs 1)
 */
function buscarPorCodigo(empleados, codigo) {
  var codigoInt = parseInt(String(codigo).replace(/^0+/, '') || '0', 10);
  for (var i = 0; i < empleados.length; i++) {
    var empInt = parseInt(String(empleados[i].codigo).replace(/^0+/, '') || '0', 10);
    if (empInt === codigoInt) return empleados[i];
  }
  return null;
}

/**
 * Convierte al formato que espera la app Next.js (campos del contrato)
 */
function formatearParaApp(emp) {
  if (!emp) return null;
  
  return {
    encontrado: true,
    codigo: emp.codigo,
    // Datos del empleado
    nombreEmpleado: emp.nombre,
    duiEmpleado: emp.dui,
    edadEmpleado: calcularEdad(emp.fechaNacimiento),
    sexoEmpleado: normalizarGenero(emp.genero),
    nacionalidadEmpleado: emp.nacionalidad,
    estadoFamiliarEmpleado: normalizarEstadoCivil(emp.estadoCivil),
    profesionEmpleado: emp.gradoAcademico,
    domicilioEmpleado: emp.domicilio,
    residenciaEmpleado: emp.municipio + ', ' + emp.departamento,
    lugarExpedicionDuiEmpleado: '',
    fechaExpedicionDuiEmpleado: '',
    // Datos del contrato
    cargoPuesto: emp.cargo,
    fechaInicioServicio: emp.fechaIngreso,
    direccionPrestacionServicios: emp.direccionLaboral,
    lugarPrestacionServicios: emp.municipioLaboral + ', ' + emp.departamentoLaboral,
    salarioEnNumeros: emp.salario,
    // Metadatos
    branch: emp.departamentoLaboral || emp.municipioLaboral || '',
    employeeName: emp.nombre,
    salary: parseFloat(String(emp.salario || '0').replace(/[^0-9.]/g, '')) || 0,
    // Dependientes (máx 2)
    dependientes: emp.dependientes.slice(0, 2).map(function(d) {
      return {
        nombre: d.nombre,
        apellido: d.apellido,
        edad: '',
        parentesco: d.parentesco,
        direccion: ''
      };
    }),
    // Datos extra (todos los campos originales del CSV)
    _extra: {
      fechaNacimiento: emp.fechaNacimiento,
      lugarNacimiento: emp.lugarNacimiento,
      genero: emp.genero,
      municipio: emp.municipio,
      departamento: emp.departamento,
      telefono: emp.telefono,
      correoPersonal: emp.correoPersonal,
      correoInstitucional: emp.correoInstitucional,
      ctaBancaria: emp.ctaBancaria,
      banco: emp.banco,
      isss: emp.isss,
      afp: emp.afp,
      cotizaEn: emp.cotizaEn,
      beneficiarios: emp.beneficiarios,
      parentesco: emp.parentesco,
      estadoCivil: emp.estadoCivil,
      gradoAcademico: emp.gradoAcademico,
      domicilio: emp.domicilio,
      direccionLaboral: emp.direccionLaboral,
      municipioLaboral: emp.municipioLaboral,
      departamentoLaboral: emp.departamentoLaboral,
      salario: emp.salario,
      fechaIngreso: emp.fechaIngreso,
      nacionalidad: emp.nacionalidad,
      dui: emp.dui
    },
    // Lista completa de dependientes (todos)
    dependientesCompletos: emp.dependientes.map(function(d) {
      return {
        nombre: d.nombre,
        apellido: d.apellido,
        parentesco: d.parentesco
      };
    })
  };
}

/**
 * Endpoint principal de la web app
 */
function doGet(e) {
  var parametros = e.parameter;
  var codigo = parametros.codigo;
  var todos = parametros.todos;
  
  try {
    var empleados = obtenerEmpleados();
    
    // Si piden TODOS los empleados con TODOS los datos
    if (todos === '1' || !codigo) {
      var resultado = empleados.map(function(emp) {
        // Devuelve TODOS los datos del empleado (igual que en el CSV)
        return {
          codigo: emp.codigo,
          nombre: emp.nombre,
          dui: emp.dui,
          fechaNacimiento: emp.fechaNacimiento,
          lugarNacimiento: emp.lugarNacimiento,
          nacionalidad: emp.nacionalidad,
          genero: emp.genero,
          domicilio: emp.domicilio,
          municipio: emp.municipio,
          departamento: emp.departamento,
          beneficiarios: emp.beneficiarios,
          parentesco: emp.parentesco,
          estadoCivil: emp.estadoCivil,
          gradoAcademico: emp.gradoAcademico,
          telefono: emp.telefono,
          correoPersonal: emp.correoPersonal,
          ctaBancaria: emp.ctaBancaria,
          banco: emp.banco,
          isss: emp.isss,
          afp: emp.afp,
          cotizaEn: emp.cotizaEn,
          correoInstitucional: emp.correoInstitucional,
          cargo: emp.cargo,
          fechaIngreso: emp.fechaIngreso,
          direccionLaboral: emp.direccionLaboral,
          municipioLaboral: emp.municipioLaboral,
          departamentoLaboral: emp.departamentoLaboral,
          salario: emp.salario,
          dependientes: emp.dependientes
        };
      });
      
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, total: resultado.length, empleados: resultado }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (codigo) {
      // Buscar uno por código
      var empleado = buscarPorCodigo(empleados, codigo);
      if (empleado) {
        var formateado = formatearParaApp(empleado);
        return ContentService
          .createTextOutput(JSON.stringify({ ok: true, data: formateado }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService
          .createTextOutput(JSON.stringify({ ok: false, error: 'Empleado no encontrado', data: { encontrado: false } }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // Fallback: si no hay código ni todos, devolver todos
    var lista = empleados.map(function(emp) {
      return {
        codigo: emp.codigo,
        nombre: emp.nombre,
        dui: emp.dui,
        fechaNacimiento: emp.fechaNacimiento,
        lugarNacimiento: emp.lugarNacimiento,
        nacionalidad: emp.nacionalidad,
        genero: emp.genero,
        domicilio: emp.domicilio,
        municipio: emp.municipio,
        departamento: emp.departamento,
        beneficiarios: emp.beneficiarios,
        parentesco: emp.parentesco,
        estadoCivil: emp.estadoCivil,
        gradoAcademico: emp.gradoAcademico,
        telefono: emp.telefono,
        correoPersonal: emp.correoPersonal,
        ctaBancaria: emp.ctaBancaria,
        banco: emp.banco,
        isss: emp.isss,
        afp: emp.afp,
        cotizaEn: emp.cotizaEn,
        correoInstitucional: emp.correoInstitucional,
        cargo: emp.cargo,
        fechaIngreso: emp.fechaIngreso,
        direccionLaboral: emp.direccionLaboral,
        municipioLaboral: emp.municipioLaboral,
        departamentoLaboral: emp.departamentoLaboral,
        salario: emp.salario,
        dependientes: emp.dependientes
      };
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, total: lista.length, empleados: lista }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
