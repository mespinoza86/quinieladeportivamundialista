document.addEventListener('DOMContentLoaded', () => {
    const jugadorSelect = document.getElementById('jugadorSelect');
    const jornadaSelect = document.getElementById('jornadaSelect');
    const searchResultadosButton = document.getElementById('searchResultadosButton');
    const resultadosContainer = document.getElementById('resultadosContainer');

    function logoHTML(url, nombre) {
        if (!url) return '';
        return `<img src="${url}" class="team-logo" alt="${nombre || 'Equipo'}">`;
    }

    function formatearFechaPartido(apiDate) {
        if (!apiDate) return 'Fecha no disponible';

        const fecha = new Date(String(apiDate).replace(' ', 'T'));

        if (Number.isNaN(fecha.getTime())) return apiDate;

        return fecha.toLocaleString('es-CR', {
            timeZone: 'America/Costa_Rica',
            dateStyle: 'short',
            timeStyle: 'short'
        });
    }

    function partidoYaCerro(partidoBase, partidoOficial) {
        if (partidoOficial && ['LIVE', 'MT', 'TC'].includes(partidoOficial.estado)) {
            return true;
        }

        if (!partidoBase?.apiDate) return false;

        const fecha = new Date(String(partidoBase.apiDate).replace(' ', 'T'));

        if (Number.isNaN(fecha.getTime())) return false;

        return fecha <= new Date();
    }

    function estadoPartidoHTML(partido) {
        if (!partido) return '<span class="status-pill status-finished">Cerrado</span>';

        if (partido.estado === 'TC') {
            return `<span class="status-pill status-finished">TC</span>`;
        }

        if (partido.estado === 'MT') {
            return `<span class="status-pill status-live">
                <span class="live-dot"></span>
                MT
            </span>`;
        }

        if (partido.estado === 'LIVE' && partido.minuto) {
            return `<span class="status-pill status-live">
                <span class="live-dot"></span>
                ${partido.minuto}${String(partido.minuto).includes('+') ? '' : "'"}
            </span>`;
        }

        return `<span class="status-pill status-scheduled">Programado</span>`;
    }

    function buscarOficialPorPartido(partidosOficiales, partidoBase) {
        return partidosOficiales.find(partido =>
            (partido.equipo1 === partidoBase.equipo1 && partido.equipo2 === partidoBase.equipo2) ||
            (partido.equipo1 === partidoBase.equipo2 && partido.equipo2 === partidoBase.equipo1)
        );
    }

    function loadJugadores() {
        fetch('/api/jugadores')
            .then(res => res.json())
            .then(jugadores => {
                if (Array.isArray(jugadores)) {
                    jugadorSelect.innerHTML = '<option value="">Selecciona un jugador</option>';
                    jugadores.forEach(j => {
                        const option = document.createElement('option');
                        option.value = j;
                        option.textContent = j;
                        jugadorSelect.appendChild(option);
                    });
                }
            })
            .catch(console.error);
    }

    function loadJornadas() {
        fetch('/api/jornadas')
            .then(res => res.json())
            .then(jornadas => {
                if (Array.isArray(jornadas)) {
                    jornadaSelect.innerHTML = '<option value="">Selecciona una jornada</option>';
                    jornadas.forEach(j => {
                        const option = document.createElement('option');
                        option.value = j.nombre;
                        option.textContent = j.nombre;
                        jornadaSelect.appendChild(option);
                    });

                    if (jornadas.length > 0) {
                        jornadaSelect.value = jornadas[jornadas.length - 1].nombre;
                    }
                }
            })
            .catch(console.error);
    }

    function pedirPassword() {
        return new Promise((resolve, reject) => {
            const modal = document.getElementById('passwordModal');
            const input = document.getElementById('passwordInput');
            const aceptar = document.getElementById('passwordAceptar');
            const cancelar = document.getElementById('passwordCancelar');

            modal.style.display = 'flex';
            input.value = '';
            input.focus();

            aceptar.onclick = () => {
                const val = input.value.trim();
                modal.style.display = 'none';

                if (!val) reject('Contraseña requerida');
                else resolve(val);
            };

            cancelar.onclick = () => {
                modal.style.display = 'none';
                reject('Cancelado');
            };
        });
    }

    async function obtenerJornada(jornadaNombre) {
        const res = await fetch(`/api/jornadas/${encodeURIComponent(jornadaNombre)}`);

        if (!res.ok) return null;

        return await res.json();
    }

    async function buscarResultados() {
        const jugador = jugadorSelect.value;
        const jornada = jornadaSelect.value;

        if (!jugador || !jornada) {
            resultadosContainer.textContent = 'Por favor, seleccione un jugador y una jornada.';
            return;
        }

        resultadosContainer.textContent = 'Cargando resultados...';

        let body = {};

        try {
            let data = await fetch(
                `/api/resultados-seguros/${encodeURIComponent(jugador)}/${encodeURIComponent(jornada)}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                }
            ).then(res => res.json());

            if (data && data.success === false && data.error === 'Contraseña requerida') {
                const password = await pedirPassword();

                body.password = password;

                data = await fetch(
                    `/api/resultados-seguros/${encodeURIComponent(jugador)}/${encodeURIComponent(jornada)}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    }
                ).then(res => res.json());
            }

            resultadosContainer.innerHTML = '';

            if (data && data.success === false && data.error === 'Contraseña incorrecta') {
                resultadosContainer.textContent = 'La contraseña es incorrecta.';
                return;
            }

            if (!data || !data.partidos || data.partidos.length === 0) {
                resultadosContainer.textContent = 'El jugador no ha pronosticado resultados para esta jornada.';
                return;
            }

            const jornadaData = await obtenerJornada(jornada);
            const partidosJornada = jornadaData?.partidos || [];

            const oficialesRes = await fetch('/api/resultados-oficiales');
            const oficialesData = await oficialesRes.json();

            const oficialJornada = Array.isArray(oficialesData)
                ? oficialesData.find(o => o.nombre === jornada)
                : null;

            const partidosOficiales = oficialJornada ? oficialJornada.partidos : [];

            let partidosMostrados = 0;

            data.partidos.forEach((p, index) => {
                const partidoBase = partidosJornada[index] || p;
                const partidoOficial = buscarOficialPorPartido(partidosOficiales, partidoBase);

                if (!partidoYaCerro(partidoBase, partidoOficial)) {
                    return;
                }

                partidosMostrados++;

                const div = document.createElement('div');
                div.classList.add('match-card', 'resultado');

                if (partidoBase?.comodin || partidoOficial?.comodin) {
                    div.classList.add('match-card-comodin');
                }

                div.innerHTML = `
                    <div class="match-card-header">
                        ${(partidoBase?.comodin || partidoOficial?.comodin) ? '<span class="match-comodin-badge">⭐ COMODÍN</span>' : ''}

                        <div class="match-main">
                            <div class="match-left">
                                <div class="match-title ${(partidoBase?.comodin || partidoOficial?.comodin) ? 'match-title-comodin' : ''}">
                                    ${p.equipo1} vs ${p.equipo2}
                                </div>

                                <div class="match-meta">
                                    <span>📅 ${formatearFechaPartido(partidoBase.apiDate)}</span>
                                </div>
                            </div>

                            <div class="match-score">
                                <span>Pronóstico</span>
                                <strong>${p.marcador1 ?? '-'} - ${p.marcador2 ?? '-'}</strong>
                            </div>

                            <div class="match-status">
                                ${estadoPartidoHTML(partidoOficial)}
                            </div>
                        </div>
                    </div>

                    <div class="match-teams">
                        <div class="team-side">
                            ${logoHTML(p.logoEquipo1, p.equipo1)}
                            <strong>${p.equipo1}</strong>
                        </div>

                        <span class="match-score">
                            ${p.marcador1 ?? '-'} - ${p.marcador2 ?? '-'}
                        </span>

                        <div class="team-side">
                            ${logoHTML(p.logoEquipo2, p.equipo2)}
                            <strong>${p.equipo2}</strong>
                        </div>
                    </div>
                `;

                resultadosContainer.appendChild(div);
            });

            if (partidosMostrados === 0) {
                resultadosContainer.textContent = 'Todavía no hay partidos cerrados para mostrar en esta jornada.';
            }

        } catch (err) {
            console.error(err);
            resultadosContainer.textContent = 'Error al obtener resultados.';
        }
    }

    searchResultadosButton.addEventListener('click', buscarResultados);

    jugadorSelect.addEventListener('change', () => {
        if (jugadorSelect.value && jornadaSelect.value) {
            buscarResultados();
        }
    });

    jornadaSelect.addEventListener('change', () => {
        if (jugadorSelect.value && jornadaSelect.value) {
            buscarResultados();
        }
    });

    setInterval(() => {
        if (jugadorSelect.value && jornadaSelect.value) {
            buscarResultados();
        }
    }, 30000);

    loadJugadores();
    loadJornadas();
});