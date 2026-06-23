document.addEventListener("DOMContentLoaded", async function () {
    try {
        const jornadaSelect = document.getElementById('jornada-select');
        const verResultadosBtn = document.getElementById('ver-resultados-btn');
        const resultadosCards = document.getElementById('resultados-cards');

        const resultadosResponse = await fetch('/api/resultados');
        const resultadosData = await resultadosResponse.json();

        const oficialesResponse = await fetch('/api/resultados-oficiales');
        const oficialesData = await oficialesResponse.json();

        const jornadasResponse = await fetch('/api/jornadas');
        const jornadasData = await jornadasResponse.json();

        function jornadaEstaCerrada(jornada) {
            if (!jornada.fechaCierre) return true;
            return new Date(jornada.fechaCierre) <= new Date();
        }

        function mostrarMensaje(mensaje) {
            resultadosCards.innerHTML = `<div class="resultados-mensaje">${mensaje}</div>`;
        }

        jornadaSelect.innerHTML = '';

        jornadasData.forEach(jornada => {
            const option = document.createElement('option');
            option.value = jornada.nombre;
            option.textContent = jornada.nombre;
            option.dataset.cerrada = jornadaEstaCerrada(jornada) ? 'true' : 'false';
            jornadaSelect.appendChild(option);
        });

        const jornadasCerradas = jornadasData.filter(jornadaEstaCerrada);

        if (jornadasCerradas.length > 0) {
            const ultimaJornadaCerrada = jornadasCerradas[jornadasCerradas.length - 1].nombre;
            jornadaSelect.value = ultimaJornadaCerrada;
            mostrarResultados(ultimaJornadaCerrada, resultadosData, oficialesData);
        } else {
            mostrarMensaje('No hay jornadas cerradas todavía. No puedes ver resultados aún.');
        }

        function intentarMostrarJornadaSeleccionada() {
            const selectedOption = jornadaSelect.options[jornadaSelect.selectedIndex];

            if (!selectedOption || selectedOption.dataset.cerrada !== 'true') {
                mostrarMensaje('La jornada aún no ha cerrado, por lo tanto no puedes ver estos resultados aún.');
                return;
            }

            mostrarResultados(jornadaSelect.value, resultadosData, oficialesData);
        }

        verResultadosBtn.addEventListener('click', intentarMostrarJornadaSeleccionada);
        jornadaSelect.addEventListener('change', intentarMostrarJornadaSeleccionada);

        document.getElementById('volver-btn-top').addEventListener('click', function () {
            window.location.href = '/index.html';
        });

        document.getElementById('volver-btn-bottom').addEventListener('click', function () {
            window.location.href = '/index.html';
        });

    } catch (error) {
        console.error("Error al cargar los datos:", error);
    }
});

async function obtenerPartidosJornada(jornada) {
    const response = await fetch(`/api/jornadas/${encodeURIComponent(jornada)}`);

    if (!response.ok) {
        console.error("No se pudo obtener la información de la jornada");
        return { partidos: [] };
    }

    return await response.json();
}

function marcador(valor) {
    return valor !== null && valor !== undefined && valor !== '' ? valor : '-';
}

function formatearFecha(fecha) {
    if (!fecha) return '';

    const d = new Date(fecha);

    if (Number.isNaN(d.getTime())) return fecha;

    return d.toLocaleString('es-CR', {
        timeZone: 'America/Costa_Rica',
        dateStyle: 'short',
        timeStyle: 'short'
    });
}

function estadoPartidoHTML(partido) {
    if (!partido) return '';

    if (partido.estado === 'TC') {
        return `<span class="status-pill status-finished">TC</span>`;
    }

    if (partido.estado === 'MT') {
        return `<span class="status-pill status-live"><span class="live-dot"></span>MT</span>`;
    }

    if (partido.estado === 'LIVE' && partido.minuto) {
        return `<span class="status-pill status-live"><span class="live-dot"></span>${partido.minuto}${String(partido.minuto).includes('+') ? '' : "'"}</span>`;
    }

    return `<span class="status-pill status-scheduled">${formatearFecha(partido.fecha)}</span>`;
}

function buscarOficialPorPartido(resultadosOficiales, partidoBase) {
    return resultadosOficiales.find(p =>
        (p.equipo1 === partidoBase.equipo1 && p.equipo2 === partidoBase.equipo2) ||
        (p.equipo1 === partidoBase.equipo2 && p.equipo2 === partidoBase.equipo1)
    );
}

function normalizarOficial(partidoOficial, partidoBase) {
    if (!partidoOficial) return null;

    const invertido =
        partidoOficial.equipo1 === partidoBase.equipo2 &&
        partidoOficial.equipo2 === partidoBase.equipo1;

    if (!invertido) return partidoOficial;

    return {
        ...partidoOficial,
        equipo1: partidoBase.equipo1,
        equipo2: partidoBase.equipo2,
        marcador1: partidoOficial.marcador2,
        marcador2: partidoOficial.marcador1
    };
}

function mostrarResultados(jornada, resultadosData, oficialesData) {
    const resultadosCards = document.getElementById('resultados-cards');
    resultadosCards.innerHTML = '';

    const resultadosJornada = resultadosData.filter(jugador => {
        const partes = jugador[0].split('_');
        return partes[1] === jornada;
    });

    const resultadoOficialJornada = oficialesData.find(oficial => oficial.nombre === jornada);
    const resultadosOficiales = resultadoOficialJornada ? resultadoOficialJornada.partidos : [];

    obtenerPartidosJornada(jornada).then(jornadaData => {
        const partidosJornada = jornadaData.partidos || [];
        const partidosMap = new Map();

        resultadosJornada.forEach(jugadorResultados => {
            const keyJugadorJornada = jugadorResultados[0];
            const nombreJugador = keyJugadorJornada.split('_')[0];
            const pronosticos = jugadorResultados[1];

            pronosticos.forEach((pronostico, index) => {
                const partidoBase = partidosJornada[index];
                if (!partidoBase) return;

                const partidoClave = `${partidoBase.equipo1} vs ${partidoBase.equipo2}`;

                if (!partidosMap.has(partidoClave)) {
                    const partidoOficialRaw = buscarOficialPorPartido(resultadosOficiales, partidoBase);
                    const partidoOficial = normalizarOficial(partidoOficialRaw, partidoBase);

                    partidosMap.set(partidoClave, {
                        jugadores: [],
                        partido: partidoBase,
                        oficial: partidoOficial
                    });
                }

                partidosMap.get(partidoClave).jugadores.push({
                    nombreJugador,
                    marcador1: pronostico.marcador1,
                    marcador2: pronostico.marcador2
                });
            });
        });

        if (partidosMap.size === 0) {
            resultadosCards.innerHTML = `<div class="resultados-mensaje">No hay resultados para esta jornada.</div>`;
            return;
        }

        let partidoIndex = 0;

        partidosMap.forEach((data) => {
            partidoIndex++;

            const partidoOficial = data.oficial;
            const grupoId = `detalle-partido-${partidoIndex}`;

            const oficialEquipo1 = partidoOficial ? partidoOficial.equipo1 : data.partido.equipo1;
            const oficialEquipo2 = partidoOficial ? partidoOficial.equipo2 : data.partido.equipo2;
            const oficialMarcador1 = partidoOficial ? marcador(partidoOficial.marcador1) : '-';
            const oficialMarcador2 = partidoOficial ? marcador(partidoOficial.marcador2) : '-';

            const card = document.createElement('article');
            card.className = 'match-card';

            card.innerHTML = `
                <div class="match-main">
                    <div class="match-left">
                        <div class="match-title">${data.partido.equipo1} vs ${data.partido.equipo2}</div>
                    </div>

                    <div class="match-score">
                        <span>${oficialEquipo1}</span>
                        <strong>${oficialMarcador1} - ${oficialMarcador2}</strong>
                        <span>${oficialEquipo2}</span>
                    </div>

                    <div class="match-status">
                        ${partidoOficial ? estadoPartidoHTML(partidoOficial) : '<span class="status-pill">N/A</span>'}
                    </div>
                </div>

                <button type="button" class="match-toggle-btn" data-grupo="${grupoId}">
                    <span>Ver resultados</span>
                    <span class="toggle-icon">›</span>
                </button>

                <div class="players-detail" id="${grupoId}">
                    <div class="players-header">
                        <span>Jugador</span>
                        <span>Pronóstico</span>
                        <span>Puntos</span>
                    </div>

                    ${data.jugadores.map(jugador => {
                        const puntosObtenidos = calcularPuntos(
                            { marcador1: jugador.marcador1, marcador2: jugador.marcador2 },
                            partidoOficial
                        );

                        return `
                            <div class="player-row">
                                <span>${jugador.nombreJugador}</span>
                                <span>${data.partido.equipo1} ${jugador.marcador1} - ${jugador.marcador2} ${data.partido.equipo2}</span>
                                <span>${puntosObtenidos}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            resultadosCards.appendChild(card);
        });

        document.querySelectorAll('.match-toggle-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const grupoId = this.dataset.grupo;
                const detalle = document.getElementById(grupoId);
                const abierto = detalle.classList.toggle('open');

                this.querySelector('span:first-child').textContent = abierto ? 'Minimizar' : 'Ver resultados';
                this.querySelector('.toggle-icon').textContent = abierto ? '⌃' : '›';
            });
        });

        document.getElementById('volver-btn-bottom').style.display = 'block';
        document.getElementById('volver-btn-top').style.display = 'block';
    });
}

function calcularPuntos(pronostico, partidoOficial) {
    let puntos = 0;

    if (!partidoOficial) return puntos;

    const marcador1Pronosticado = parseInt(pronostico.marcador1, 10);
    const marcador2Pronosticado = parseInt(pronostico.marcador2, 10);
    const marcador1Oficial = parseInt(partidoOficial.marcador1, 10);
    const marcador2Oficial = parseInt(partidoOficial.marcador2, 10);
    const esComodin = partidoOficial.comodin || false;

    if (
        !isNaN(marcador1Pronosticado) &&
        !isNaN(marcador2Pronosticado) &&
        !isNaN(marcador1Oficial) &&
        !isNaN(marcador2Oficial)
    ) {
        if (
            marcador1Pronosticado === marcador1Oficial &&
            marcador2Pronosticado === marcador2Oficial
        ) {
            puntos += esComodin ? 7 : 5;
        } else {
            const resultadoPronosticado =
                marcador1Pronosticado === marcador2Pronosticado
                    ? 'empate'
                    : marcador1Pronosticado > marcador2Pronosticado
                        ? 'gana1'
                        : 'gana2';

            const resultadoOficial =
                marcador1Oficial === marcador2Oficial
                    ? 'empate'
                    : marcador1Oficial > marcador2Oficial
                        ? 'gana1'
                        : 'gana2';

            if (resultadoPronosticado === resultadoOficial) {
                puntos += esComodin ? 4 : 3;
            }
        }
    }

    return puntos;
}