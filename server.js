const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcrypt');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;

/* ================= Middleware ================= */

/* ================= Middleware ================= */

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin === 'null') return callback(null, true);

    const allowedOrigins = [
      'http://localhost',
      'http://localhost:3000',
      'http://127.0.0.1',
      'capacitor://localhost',
      'https://quinieladeportivadb.onrender.com'
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('No permitido por CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use(bodyParser.json({ limit: '10kb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'quiniela_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
}));

function requireAdmin(req, res, next) {
  if (req.session && req.session.authenticated === true) {
    return next();
  }

  return res.redirect('/login.html');
}

const paginasAdmin = [
  '/jugadores.html',
  '/jornadas.html',
  '/importar_partidos.html',
  '/resultados.html',
  '/agregar-resultados-oficiales.html',
  '/generar_reporte.html',
  '/enviarresultados.html',
  '/copiarresultadojugador.html'
];

app.use((req, res, next) => {
  if (paginasAdmin.includes(req.path)) {
    return requireAdmin(req, res, next);
  }

  next();
});

/* ================= Auto Sync Global ================= */

let ultimaSyncGlobal = 0;
let syncEnProceso = false;

app.use((req, res, next) => {
  const ahora = Date.now();
  const CINCO_MINUTOS = 1 * 60 * 1000;

  const esArchivoEstatico =
    req.path.startsWith('/js/') ||
    req.path.startsWith('/css/') ||
    req.path.includes('.png') ||
    req.path.includes('.jpg') ||
    req.path.includes('.jpeg') ||
    req.path.includes('.svg') ||
    req.path.includes('.ico');

  if (esArchivoEstatico) {
    return next();
  }

  if (!syncEnProceso && ahora - ultimaSyncGlobal > CINCO_MINUTOS) {
    syncEnProceso = true;
    ultimaSyncGlobal = ahora;

    sincronizarTodasLasJornadasDesdeApi()
      .catch(err => {
        console.error('Error auto-sync:', err.message);
      })
      .finally(() => {
        syncEnProceso = false;
      });
  }

  next();
});

/* ================= Auth ================= */

app.post('/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/check-auth', (req, res) => {
  res.json({ authenticated: req.session.authenticated || false });
});

/* ================= Static Files ================= */

app.use(express.static(path.join(__dirname, 'public')));

app.get('/js/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'private', 'js', req.params.filename);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  res.status(404).send('Archivo JS no encontrado');
});

app.get('/css/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'private', 'css', req.params.filename);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  res.status(404).send('Archivo CSS no encontrado');
});





/* ================= MongoDB ================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Error al conectar a MongoDB:', err.message);
    process.exit(1);
  });

/* ================= API-Football ================= */

/*
const footballApi = axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  headers: {
    'x-apisports-key': process.env.API_FOOTBALL_KEY
  }
});
*/

const apiFootballCom = axios.create({
  baseURL: 'https://apiv3.apifootball.com/'
});


/* ================= Schemas ================= */

const JugadorSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  password: { type: String }
});

const JornadaSchema = new mongoose.Schema({
  nombre: String,
  partidos: [{
    equipo1: String,
    equipo2: String,
    logoEquipo1: String,
    logoEquipo2: String,
    comodin: { type: Boolean, default: false },

    apiFixtureId: String,
    apiLeagueId: String,
    apiDate: String,
    apiStatus: String
  }],
  fechaCierre: { type: Date, required: false }
});

const ResultadoSchema = new mongoose.Schema({
  jugador: String,
  jornada: String,
  pronosticos: [{
    equipo1: String,
    equipo2: String,
    marcador1: Number,
    marcador2: Number
  }]
});


const ResultadoOficialSchema = new mongoose.Schema({
  jornada: String,
  resultados: [{
    equipo1: String,
    logoEquipo1: String,
    marcador1: Number,
    equipo2: String,
    logoEquipo2: String,
    marcador2: Number,
    comodin: { type: Boolean, default: false },

    estado: String,
    minuto: mongoose.Schema.Types.Mixed,
    fecha: String
  }]
});



const EquipoSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true }
});

const Equipo = mongoose.model('Equipo', EquipoSchema);
const Jugador = mongoose.model('Jugador', JugadorSchema);
const Jornada = mongoose.model('Jornada', JornadaSchema);
const Resultado = mongoose.model('Resultado', ResultadoSchema);
const ResultadoOficial = mongoose.model('ResultadoOficial', ResultadoOficialSchema);

/* ================= HTML Routes ================= */

[
  '/',
  '/jugadores',
  '/jornada',
  '/ver-jugadores',
  '/resultados',
  '/ver-resultados',
  '/ver-jornadas',
  '/adminmode.html',
  '/ver_resultados_totales_de_jugadores',
  '/agregar-resultados-oficiales',
  '/generar_reporte',
  '/llenar_jornada',
  '/resultados-totales',
  '/ver-resultados-oficiales',
  '/verResultados',
  '/verResultados_puntos',
  '/importar_partidos'
].forEach(route => {
  app.get(route, (req, res) => {
    let nombreArchivo = route === '/' ? 'index.html' : route.replace('/', '');

    if (!nombreArchivo.endsWith('.html')) {
      nombreArchivo += '.html';
    }

    const filePath = path.join(__dirname, 'public', nombreArchivo);
    res.sendFile(filePath);
  });
});

/* ================= API: Jugadores ================= */

app.get('/api/jugadores', async (req, res) => {
  const jugadores = await Jugador.find({}).sort({ nombre: 1 });
  res.json(jugadores.map(j => j.nombre));
});

app.post('/api/jugadores', requireAdmin, async (req, res) => {
  const { nombre, password } = req.body;

  if (!nombre || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña obligatorios' });
  }

  const existe = await Jugador.findOne({ nombre });
  if (existe) return res.status(400).json({ error: 'Jugador ya existe' });

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const nuevo = new Jugador({ nombre, password: hashedPassword });
  await nuevo.save();

  const jugadores = await Jugador.find({});
  res.json(jugadores.map(j => ({ nombre: j.nombre })));
});

app.delete('/api/jugadores/:nombre', requireAdmin, async (req, res) => {
  try {
    await Jugador.deleteOne({ nombre: req.params.nombre });
    res.json({ message: 'Jugador eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar jugador' });
  }
});

app.get('/api/jugador/:nombre', async (req, res) => {
  const jugador = await Jugador.findOne({ nombre: req.params.nombre });
  if (!jugador) return res.status(404).json({ error: 'Jugador no encontrado' });

  res.json({
    nombre: jugador.nombre,
    password: jugador.password ? true : false
  });
});

app.post('/api/jugadores/:nombre/verificar-password', async (req, res) => {
  const { password } = req.body;
  const jugador = await Jugador.findOne({ nombre: req.params.nombre });

  if (!jugador) return res.status(404).json({ error: 'Jugador no encontrado' });
  if (!jugador.password) return res.status(400).json({ error: 'Jugador no tiene contraseña' });

  const match = await bcrypt.compare(password, jugador.password);

  if (match) {
    return res.json({ success: true });
  }

  res.status(401).json({ error: 'Contraseña incorrecta' });
});

app.post('/api/jugadores/:nombre/cambiar-password', async (req, res) => {
  const { nombre } = req.params;
  const { currentPassword, newPassword } = req.body;

  const jugador = await Jugador.findOne({ nombre });
  if (!jugador) return res.status(404).json({ error: 'Jugador no encontrado' });

  if (jugador.password) {
    const match = await bcrypt.compare(currentPassword, jugador.password);
    if (!match) return res.status(400).json({ message: 'Contraseña actual incorrecta' });
  }

  jugador.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await jugador.save();

  res.json({ message: 'Contraseña cambiada correctamente' });
});

/* ================= API: Jornadas ================= */

app.get('/api/jornadas', async (req, res) => {
  const jornadas = await Jornada.find({});
  res.json(jornadas.map(j => ({
    nombre: j.nombre,
    partidos: j.partidos,
    fechaCierre: j.fechaCierre || null
  })));
});

app.get('/api/jornadas/:nombre', async (req, res) => {
  const jornada = await Jornada.findOne({ nombre: req.params.nombre });
  if (!jornada) return res.status(404).json({ error: 'Jornada no encontrada.' });

  res.json({
    nombre: jornada.nombre,
    partidos: jornada.partidos,
    fechaCierre: jornada.fechaCierre || null
  });
});

app.post('/api/jornadas', requireAdmin, async (req, res) => {
  const { nombre, partidos, fechaCierre } = req.body;

  await Jornada.findOneAndUpdate(
    { nombre },
    {
      nombre,
      partidos,
      ...(fechaCierre && { fechaCierre })
    },
    { upsert: true }
  );

  const jornadas = await Jornada.find({});
  res.json(jornadas.map(j => [j.nombre, j.partidos]));
});

app.post('/api/jornadas/importar-api', requireAdmin, async (req, res) => {
  try {
    const { nombre, fechaCierre, partidos } = req.body;

    if (!nombre || !Array.isArray(partidos) || partidos.length === 0) {
      return res.status(400).json({
        error: 'Nombre y partidos son obligatorios'
      });
    }

    const partidosFormateados = partidos.map(p => ({
      equipo1: p.equipo1,
      equipo2: p.equipo2,
       logoEquipo1: p.logoEquipo1 || '',
       logoEquipo2: p.logoEquipo2 || '',
      comodin: !!p.comodin,
      apiFixtureId: p.apiFixtureId ? String(p.apiFixtureId) : '',
      apiLeagueId: p.apiLeagueId ? String(p.apiLeagueId) : '',
      apiDate: p.fecha || '',
      apiStatus: p.estado || ''
    }));

    await Jornada.findOneAndUpdate(
      { nombre },
      {
        nombre,
        partidos: partidosFormateados,
        ...(fechaCierre && { fechaCierre })
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Jornada importada correctamente'
    });
  } catch (error) {
    console.error('Error importando jornada:', error);
    res.status(500).json({ error: 'Error al importar jornada' });
  }
});

app.post('/api/jornadas/agregar-partido', requireAdmin, async (req, res) => {
  const { jornada, partido } = req.body;
  const doc = await Jornada.findOne({ nombre: jornada });

  if (!doc) return res.status(404).json({ error: 'Jornada no encontrada.' });

  doc.partidos.push(partido);
  await doc.save();

  res.json({ success: true });
});

app.post('/api/jornadas/eliminar-partidos',requireAdmin, async (req, res) => {
  const { jornada, indices } = req.body;
  const doc = await Jornada.findOne({ nombre: jornada });

  if (!doc) return res.status(404).json({ error: 'Jornada no encontrada.' });

  indices.sort((a, b) => b - a).forEach(i => doc.partidos.splice(i, 1));
  await doc.save();

  res.json({ success: true });
});

app.post('/api/jornadas/comodin',requireAdmin, async (req, res) => {
  const { jornada, partidos } = req.body;
  const doc = await Jornada.findOne({ nombre: jornada });

  if (!doc) return res.status(404).send('Jornada no encontrada');

  doc.partidos = partidos;
  await doc.save();

  res.send('Estado de comodín actualizado');
});

/* ================= API-Football ================= */

app.get('/api/football/fixtures', async (req, res) => {
  try {
    const { date, from, to, league } = req.query;

    if (!process.env.APIFOOTBALL_COM_KEY) {
      return res.status(500).json({
        error: 'Falta configurar APIFOOTBALL_COM_KEY en el .env'
      });
    }

    const fechaInicio = from || date;
    const fechaFin = to || date;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        error: 'Debe enviar date=YYYY-MM-DD o from/to'
      });
    }

    const params = {
      action: 'get_events',
      from: fechaInicio,
      to: fechaFin,
      APIkey: process.env.APIFOOTBALL_COM_KEY,
      timezone: 'America/Costa_Rica'
    };

    if (league) {
      params.league_id = league;
    }

    const response = await apiFootballCom.get('', { params });

    if (!Array.isArray(response.data)) {
      console.log('Respuesta APIfootball.com:', response.data);
      return res.json([]);
    }

    const partidos = response.data.map(item => ({
      apiFixtureId: Number(item.match_id),
      fecha: `${item.match_date} ${item.match_time}`,
      estado: item.match_status || 'NS',
      minuto: null,
      liga: item.league_name || '',
      pais: item.country_name || '',
      temporada: '',
      apiLeagueId: Number(item.league_id),
      equipo1: item.match_hometeam_name,
      equipo2: item.match_awayteam_name,
      logoEquipo1: item.team_home_badge || '',
      logoEquipo2: item.team_away_badge || '',      
      marcador1: item.match_hometeam_score !== '' ? Number(item.match_hometeam_score) : null,
      marcador2: item.match_awayteam_score !== '' ? Number(item.match_awayteam_score) : null
    }));

    res.json(partidos);

  } catch (error) {
    console.error('Error consultando APIfootball.com:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error al consultar partidos externos' });
  }
});

app.get('/api/football/leagues', async (req, res) => {
  try {
    const response = await apiFootballCom.get('', {
      params: {
        action: 'get_leagues',
        APIkey: process.env.APIFOOTBALL_COM_KEY
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Error consultando ligas' });
  }
});

app.get('/api/football/leagues-test', async (req, res) => {
  try {
    const response = await apiFootballCom.get('', {
      params: {
        action: 'get_leagues',
        APIkey: process.env.APIFOOTBALL_COM_KEY
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json(error.response?.data || { error: error.message });
  }
});


function obtenerNumeroSeguro(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = Number(valor);
  return Number.isNaN(numero) ? '' : numero;
}

function obtenerMarcador90Minutos(fixture) {
  const posiblesLocal = [
    fixture.match_hometeam_ft_score,
    fixture.match_hometeam_fulltime_score,
    fixture.match_hometeam_score_ft,
    fixture.match_hometeam_score
  ];

  const posiblesVisitante = [
    fixture.match_awayteam_ft_score,
    fixture.match_awayteam_fulltime_score,
    fixture.match_awayteam_score_ft,
    fixture.match_awayteam_score
  ];

  return {
    marcador1: obtenerNumeroSeguro(posiblesLocal.find(v => v !== undefined && v !== null && v !== '')),
    marcador2: obtenerNumeroSeguro(posiblesVisitante.find(v => v !== undefined && v !== null && v !== ''))
  };
}

function normalizarEquipo(nombre) {
  return (nombre || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extraerFechaApi(apiDate) {
  if (!apiDate) return '';
  return String(apiDate).split(' ')[0].split('T')[0];
}

async function buscarEventoPorId(matchId) {
  if (!matchId) return null;

  const response = await apiFootballCom.get('', {
    params: {
      action: 'get_events',
      match_id: String(matchId),
      APIkey: process.env.APIFOOTBALL_COM_KEY
    }
  });

  return Array.isArray(response.data) ? response.data[0] : null;
}

async function buscarEventoPorFallback(partido) {
  const fecha = extraerFechaApi(partido.apiDate);
  if (!fecha) return null;

  const params = {
    action: 'get_events',
    from: fecha,
    to: fecha,
    APIkey: process.env.APIFOOTBALL_COM_KEY
  };

  if (partido.apiLeagueId) {
    params.league_id = partido.apiLeagueId;
  }

  const response = await apiFootballCom.get('', { params });
  const eventos = Array.isArray(response.data) ? response.data : [];

  const equipo1 = normalizarEquipo(partido.equipo1);
  const equipo2 = normalizarEquipo(partido.equipo2);

  return eventos.find(evento => {
    const local = normalizarEquipo(evento.match_hometeam_name);
    const visita = normalizarEquipo(evento.match_awayteam_name);

    return local === equipo1 && visita === equipo2;
  }) || null;
}


async function sincronizarTodasLasJornadasDesdeApi() {
  const jornadas = await Jornada.find({
    'partidos.apiFixtureId': { $exists: true, $ne: '' }
  });

  for (const jornada of jornadas) {
    try {
      await axios.post(
        `http://localhost:${PORT}/api/sync-resultados-oficiales/${encodeURIComponent(jornada.nombre)}`
      );
    } catch (err) {
      console.error(`Error sincronizando ${jornada.nombre}:`, err.message);
    }
  }
}


/*function obtenerMinutoPartido(fixture) {
  const estado = String(fixture?.match_status || '');

  if (fixture?.match_live === '1' && /^\d+$/.test(estado)) {
    return Number(estado);
  }

  return null;
}

function obtenerEstadoVisual(fixture, partido) {
  const estado = String(fixture?.match_status || partido?.apiStatus || '');

  const estadosFinalizados = [
    'Finished',
    'After Pen.',
    'After ET',
    'Awarded'
  ];

  if (estadosFinalizados.includes(estado)) {
    return 'TC';
  }

  if (fixture?.match_live === '1' && /^\d+$/.test(estado)) {
    return 'LIVE';
  }

  return 'PROGRAMADO';
}
*/

function obtenerEstadoPartido(fixture, partido) {
  const estadoRaw = String(fixture?.match_status || partido?.apiStatus || '').trim();
  const matchLive = String(fixture?.match_live || '');

  const estadoLower = estadoRaw.toLowerCase();

  const estadosFinalizados = [
    'finished',
    'ft',
    'after pen.',
    'after et',
    'awarded',
    'penalties'
  ];

  if (estadosFinalizados.includes(estadoLower)) {
    return {
      estado: 'TC',
      minuto: null
    };
  }

  if (
    estadoLower === 'half time' ||
    estadoLower === 'halftime' ||
    estadoLower === 'ht'
  ) {
    return {
      estado: 'MT',
      minuto: null
    };
  }

  if (/^45\+/.test(estadoRaw)) {
    return {
      estado: 'LIVE',
      minuto: '45+'
    };
  }

  if (/^90\+/.test(estadoRaw)) {
    return {
      estado: 'LIVE',
      minuto: '90+'
    };
  }

  if (matchLive === '1' && /^\d+$/.test(estadoRaw)) {
    const minuto = Number(estadoRaw);

    if (minuto >= 90) {
      return {
        estado: 'LIVE',
        minuto: '90+'
      };
    }

    if (minuto >= 45 && minuto < 46) {
      return {
        estado: 'LIVE',
        minuto: '45+'
      };
    }

    return {
      estado: 'LIVE',
      minuto
    };
  }

  return {
    estado: 'PROGRAMADO',
    minuto: null
  };
}


app.post('/api/sync-resultados-oficiales/:jornada', async (req, res) => {
  try {
    const { jornada } = req.params;

    if (!process.env.APIFOOTBALL_COM_KEY) {
      return res.status(500).json({
        error: 'Falta configurar APIFOOTBALL_COM_KEY en el .env'
      });
    }

    const jornadaDoc = await Jornada.findOne({ nombre: jornada });

    if (!jornadaDoc) {
      return res.status(404).json({ error: 'Jornada no encontrada' });
    }

    const resultadosActualizados = [];

    for (const partido of jornadaDoc.partidos) {
      let fixture = null;

      if (partido.apiFixtureId) {
        fixture = await buscarEventoPorId(partido.apiFixtureId);
      }

      if (!fixture) {
        fixture = await buscarEventoPorFallback(partido);
      }

      if (!fixture) {
        resultadosActualizados.push({
          equipo1: partido.equipo1,
          logoEquipo1: partido.logoEquipo1 || '',
          marcador1: null,
          equipo2: partido.equipo2,
          logoEquipo2: partido.logoEquipo2 || '',
          marcador2: null,
          comodin: partido.comodin,

          estado: 'PROGRAMADO',
          minuto: null,
          fecha: partido.apiDate || ''          
        });
        continue;
      }

      const marcador90 = obtenerMarcador90Minutos(fixture);

      const home = normalizarEquipo(fixture.match_hometeam_name);
      const away = normalizarEquipo(fixture.match_awayteam_name);
      const eq1 = normalizarEquipo(partido.equipo1);
      const eq2 = normalizarEquipo(partido.equipo2);

      const vieneInvertido = home === eq2 && away === eq1;
      const estadoPartido = obtenerEstadoPartido(fixture, partido);

      resultadosActualizados.push({
        equipo1: partido.equipo1,
        logoEquipo1: partido.logoEquipo1 || '',
        marcador1: vieneInvertido ? marcador90.marcador2 : marcador90.marcador1,
        equipo2: partido.equipo2,
        logoEquipo2: partido.logoEquipo2 || '',
        marcador2: vieneInvertido ? marcador90.marcador1 : marcador90.marcador2,
        comodin: partido.comodin,

        estado: estadoPartido.estado,
        minuto: estadoPartido.minuto,
        fecha: partido.apiDate || ''        
      });
    }

    await ResultadoOficial.findOneAndUpdate(
      { jornada },
      {
        jornada,
        resultados: resultadosActualizados
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      jornada,
      resultados: resultadosActualizados
    });

  } catch (error) {
    console.error('Error sincronizando resultados oficiales:', error.response?.data || error.message);
    res.status(500).json({ error: 'Error sincronizando resultados oficiales' });
  }
});

/* ================= API: Resultados ================= */

app.get('/api/resultados', async (req, res) => {
  const r = await Resultado.find({});
  const resultMap = new Map();

  r.forEach(r => resultMap.set(`${r.jugador}_${r.jornada}`, r.pronosticos));

  res.json(Array.from(resultMap.entries()));
});

app.post('/api/resultados', async (req, res) => {
  const { jugador, jornada, pronosticos } = req.body;

  await Resultado.findOneAndUpdate(
    { jugador, jornada },
    { jugador, jornada, pronosticos },
    { upsert: true }
  );

  const all = await Resultado.find({});
  const resultMap = new Map();

  all.forEach(r => resultMap.set(`${r.jugador}_${r.jornada}`, r.pronosticos));

  res.json(Array.from(resultMap.entries()));
});

app.get('/api/resultados/:jugador/:jornada', async (req, res) => {
  const { jugador, jornada } = req.params;
  const r = await Resultado.findOne({ jugador, jornada });

  res.json(r ? r.pronosticos : []);
});

/* ================= API: Resultados Oficiales ================= */

app.get('/api/resultados-oficiales', async (req, res) => {
  const all = await ResultadoOficial.find({});
  const resultados = all.map(r => ({
    nombre: r.jornada,
    partidos: r.resultados
  }));

  res.json(resultados);
});

app.post('/api/resultados-oficiales', requireAdmin, async (req, res) => {
  const { jornada, resultados } = req.body;

  const jornadaDoc = await Jornada.findOne({ nombre: jornada });

  const resultadosConLogos = resultados.map((r, index) => {
    const partidoJornada = jornadaDoc?.partidos?.[index];

    return {
      equipo1: r.equipo1,
      logoEquipo1: r.logoEquipo1 || partidoJornada?.logoEquipo1 || '',
      marcador1: r.marcador1,
      equipo2: r.equipo2,
      logoEquipo2: r.logoEquipo2 || partidoJornada?.logoEquipo2 || '',
      marcador2: r.marcador2,
      comodin: r.comodin,

      estado: r.estado || partidoJornada?.apiStatus || 'PROGRAMADO',
      minuto: r.minuto ?? null,
      fecha: r.fecha || partidoJornada?.apiDate || ''

    };
  });

  await ResultadoOficial.findOneAndUpdate(
    { jornada },
    { jornada, resultados: resultadosConLogos },
    { upsert: true }
  );

  const all = await ResultadoOficial.find({});
  const resultadosArray = all.map(r => ({
    nombre: r.jornada,
    partidos: r.resultados
  }));

  res.json(resultadosArray);
});


app.get('/api/resultados-oficiales/:jornada', async (req, res) => {
  try {
    const jornadaNombre = req.params.jornada;
    const jornadaDoc = await Jornada.findOne({ nombre: jornadaNombre });

    if (!jornadaDoc) {
      return res.status(404).json({ error: 'Jornada no encontrada' });
    }

    const oficial = await ResultadoOficial.findOne({ jornada: jornadaNombre });
    const resultadosExistentes = oficial ? oficial.resultados : [];

    const partidosConResultados = jornadaDoc.partidos.map(p => {
    let invertido = false;

    let r = resultadosExistentes.find(r =>
        r.equipo1 === p.equipo1 && r.equipo2 === p.equipo2
      );

      if (!r) {
        r = resultadosExistentes.find(r =>
          r.equipo1 === p.equipo2 && r.equipo2 === p.equipo1
        );
        invertido = !!r;
      }

      return {
        equipo1: p.equipo1,
        equipo2: p.equipo2,
        marcador1: r ? (invertido ? r.marcador2 : r.marcador1) : '',
        marcador2: r ? (invertido ? r.marcador1 : r.marcador2) : '',
        comodin: p.comodin
      };
    });


    res.json({
      nombre: jornadaNombre,
      partidos: partidosConResultados
    });
  } catch (error) {
    console.error('Error al obtener resultados oficiales de la jornada:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ================= API: Equipos ================= */

app.get('/api/equipos', async (req, res) => {
  try {
    const equipos = await Equipo.find({}, { _id: 0, __v: 0 }).lean();
    const nombresEquipos = equipos.map(e => e.nombre);
    res.json(nombresEquipos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener equipos' });
  }
});

app.post('/actualizar-equipos', async (req, res) => {
  try {
    const { equipos } = req.body;

    if (!Array.isArray(equipos)) {
      return res.status(400).json({ error: 'Equipos inválidos' });
    }

    await Equipo.deleteMany({ nombre: { $nin: equipos } });

    for (const nombreEquipo of equipos) {
      await Equipo.updateOne(
        { nombre: nombreEquipo },
        { nombre: nombreEquipo },
        { upsert: true }
      );
    }

    res.json({ message: 'Equipos actualizados' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar equipos' });
  }
});

/* ================= Resultados con equipos ================= */

app.get('/api/resultados-con-equipos/:jugador/:jornada', async (req, res) => {
  const { jugador, jornada } = req.params;

  const resultado = await Resultado.findOne({ jugador, jornada });
  const jornadaDoc = await Jornada.findOne({ nombre: jornada });

  if (!resultado || !jornadaDoc) {
    return res.status(404).json({ error: 'Datos no encontrados' });
  }

  const pronosticos = resultado.pronosticos;
  const partidos = jornadaDoc.partidos;

  const resultadosConEquipos = partidos.map((p, i) => ({
    equipo1: p.equipo1,
    equipo2: p.equipo2,
    marcador1: pronosticos[i]?.marcador1 ?? '',
    marcador2: pronosticos[i]?.marcador2 ?? ''
  }));

  res.json(resultadosConEquipos);
});

app.post('/api/resultados-seguros/:jugador/:jornada', async (req, res) => {
  try {
    const { jugador, jornada } = req.params;
    const { password } = req.body || {};

    const jornadaDoc = await Jornada.findOne({ nombre: jornada });
    if (!jornadaDoc) return res.status(404).json({ error: 'Jornada no encontrada' });

    const resultado = await Resultado.findOne({ jugador, jornada });
    if (!resultado) return res.status(404).json({ error: 'Resultados no encontrados' });

    const jugadorDoc = await Jugador.findOne({ nombre: jugador });
    if (!jugadorDoc) return res.status(404).json({ error: 'Jugador no encontrado' });

    const ahora = new Date();
    const jornadaCerrada = jornadaDoc.fechaCierre && new Date(jornadaDoc.fechaCierre) <= ahora;
    const jornadaSinFecha = !jornadaDoc.fechaCierre;

    if (!jornadaCerrada && !jornadaSinFecha) {
      if (jugadorDoc.password) {
        if (!password) {
          return res.json({ success: false, error: 'Contraseña requerida' });
        }

        const match = await bcrypt.compare(password, jugadorDoc.password);

        if (!match) {
          return res.status(401).json({
            success: false,
            error: 'Contraseña incorrecta'
          });
        }
      }
    }

    const partidos = jornadaDoc.partidos.map((p, i) => ({
      equipo1: p.equipo1,
      equipo2: p.equipo2,
      logoEquipo1: p.logoEquipo1 || '',
      logoEquipo2: p.logoEquipo2 || '',      
      marcador1: resultado.pronosticos[i]?.marcador1 ?? '',
      marcador2: resultado.pronosticos[i]?.marcador2 ?? ''
    }));

    res.json({ success: true, partidos });
  } catch (error) {
    console.error('Error en /api/resultados-seguros:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/* ================= API: Resultados Totales ================= */
app.delete('/api/jornadas/:nombre', requireAdmin, async (req, res) => {
  try {
    const nombreJornada = req.params.nombre;

    const jornadaEliminada = await Jornada.findOneAndDelete({
      nombre: nombreJornada
    });

    if (!jornadaEliminada) {
      return res.status(404).json({ error: 'Jornada no encontrada' });
    }

    await Resultado.deleteMany({ jornada: nombreJornada });
    await ResultadoOficial.deleteMany({ jornada: nombreJornada });

    res.json({
      success: true,
      message: 'Jornada, pronósticos y resultados oficiales eliminados'
    });

  } catch (error) {
    console.error('Error eliminando jornada:', error);
    res.status(500).json({ error: 'Error eliminando jornada' });
  }
});

app.get('/api/resultados-totales', async (req, res) => {
  const jugadores = await Jugador.find({});
  const jornadas = await Jornada.find({});
  const resultados = await Resultado.find({});
  const oficiales = await ResultadoOficial.find({});

  const mapRes = new Map();
  resultados.forEach(r => mapRes.set(`${r.jugador}_${r.jornada}`, r.pronosticos));

  const mapOficial = new Map();
  oficiales.forEach(r => mapOficial.set(r.jornada, r.resultados));

  const resultadosTotales = {};

  const resultado = (m1, m2) => {
    if (m1 > m2) return 'gano';
    if (m1 < m2) return 'perdio';
    return 'empato';
  };

  for (let j of jugadores) {
    let totalPuntos = 0;
    resultadosTotales[j.nombre] = {};

    for (let jornada of jornadas) {
      const key = `${j.nombre}_${jornada.nombre}`;
      const pronosticos = mapRes.get(key) || [];
      const oficialesJornada = mapOficial.get(jornada.nombre) || [];

      let puntosJornada = 0;

      jornada.partidos.forEach((partido, index) => {
        const p = pronosticos[index];
        const o = oficialesJornada[index];

        if (!p || !o) return;

        const valores = [o.marcador1, o.marcador2, p.marcador1, p.marcador2];
        const sonNumerosValidos = valores.every(val =>
          typeof val === 'number' && !isNaN(val)
        );

        if (!sonNumerosValidos) return;

        const esComodin = o.comodin;

        if (o.marcador1 === p.marcador1 && o.marcador2 === p.marcador2) {
          puntosJornada += esComodin ? 7 : 5;
        } else {
          const rOf = resultado(o.marcador1, o.marcador2);
          const rPr = resultado(p.marcador1, p.marcador2);

          if (rOf === rPr) {
            puntosJornada += esComodin ? 4 : 3;
          }
        }
      });

      resultadosTotales[j.nombre][jornada.nombre] = puntosJornada;
      totalPuntos += puntosJornada;
    }

    resultadosTotales[j.nombre].total = totalPuntos;
  }

  res.json(resultadosTotales);
});

app.get('/generar_reporte', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'generar_reporte.html'));
});

/* ================= Start Server ================= */

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});