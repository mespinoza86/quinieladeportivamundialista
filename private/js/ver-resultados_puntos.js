document.addEventListener('DOMContentLoaded', () => {
    const jugadorSelect = document.getElementById('jugadorSelect');
    const jornadaSelect = document.getElementById('jornadaSelect');
    const searchResultadosButtonpuntos = document.getElementById('searchResultadosButtonpuntos');
    const resultadosContainer = document.getElementById('resultadosContainer');
    const puntosContainer = document.getElementById('puntosContainer');
    const totalPuntosContainer = document.getElementById('totalPuntosContainer');

    function isValidScore(v) {
        if (v === null || v === undefined) return false;
        if (typeof v === 'string' && v.trim() === '') return false;
        const n = Number(v);
        return Number.isFinite(n);
    }

    function logoHTML(url, nombre) {
        if (!url) return '';
        return `<img src="${url}" class="team-logo" alt="${nombre || 'Equipo'}">`;
    }

    function formatearFecha(fecha) {
        if (!fecha) return '';

        const d = new Date(fecha);

        if (Number.isNaN(d.getTime())) {
            return fecha;
        }

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

    return `<span class="status-pill status-scheduled">${formatearFecha(partido.fecha)}</span>`;
}


    function calcularPuntos(pronostico, resultadoOficial) {
        if (!pronostico || !resultadoOficial) return 0;

        const m1p = pronostico.marcador1;
        const m2p = pronostico.marcador2;
        const m1o = resultadoOficial.marcador1;
        const m2o = resultadoOficial.marcador2;
        const comodin = Boolean(resultadoOficial.comodin);

        if (!isValidScore(m1p) || !isValidScore(m2p) || !isValidScore(m1o) || !isValidScore(m2o)) {
            return 0;
        }

        const n1p = Number(m1p);
        const n2p = Number(m2p);
        const n1o = Number(m1o);
        const n2o = Number(m2o);

        let puntos = 0;

        const ganadorPron = n1p > n2p ? 1 : n1p < n2p ? -1 : 0;
        const ganadorOfi = n1o > n2o ? 1 : n1o < n2o ? -1 : 0;

        if (ganadorPron === ganadorOfi) {
            puntos += comodin ? 4 : 3;
        }

        if (n1p === n1o && n2p === n2o) {
            puntos += comodin ? 3 : 2;
        }

        return puntos;
    }

    function pedirPassword() {
        return new Promise((resolve) => {
            const modal = document.getElementById("passwordModal");
            const input = document.getElementById("passwordInput");
            const okBtn = document.getElementById("passwordOk");
            const cancelBtn = document.getElementById("passwordCancel");

            modal.style.display = "flex";
            input.value = "";
            input.focus();

            function cerrar(valor) {
                modal.style.display = "none";
                okBtn.removeEventListener("click", aceptar);
                cancelBtn.removeEventListener("click", cancelar);
                resolve(valor);
            }

            function aceptar() {
                cerrar(input.value);
            }

            function cancelar() {
                cerrar(null);
            }

            okBtn.addEventListener("click", aceptar);
            cancelBtn.addEventListener("click", cancelar);
        });
    }

    async function loadJugadores() {
        const response = await fetch('/api/jugadores');
        const jugadores = await response.json();

        jugadorSelect.innerHTML = '<option value="">Selecciona un jugador</option>';

        if (Array.isArray(jugadores)) {
            jugadores.forEach(jugador => {
                const option = document.createElement('option');
                option.value = jugador;
                option.textContent = jugador;
                jugadorSelect.appendChild(option);
            });
        }
    }

    async function loadJornadas() {
        const response = await fetch('/api/jornadas');
        const jornadas = await response.json();

        jornadaSelect.innerHTML = '<option value="">Selecciona una jornada</option>';

        if (Array.isArray(jornadas)) {
            jornadas.forEach(jornada => {
                const option = document.createElement('option');
                option.value = jornada.nombre;
                option.textContent = jornada.nombre;
                jornadaSelect.appendChild(option);
            });

            if (jornadas.length > 0) {
                const ultimaJornada = jornadas[jornadas.length - 1].nombre;
                jornadaSelect.value = ultimaJornada;
            }
        }
    }

    async function buscarResultados() {
        const jugador = jugadorSelect.value;
        const jornada = jornadaSelect.value;

        if (!jugador || !jornada) {
            resultadosContainer.textContent = 'Por favor, seleccione un jugador y una jornada.';
            return;
        }

        resultadosContainer.innerHTML = 'Cargando resultados...';
        puntosContainer.innerHTML = '';
        totalPuntosContainer.innerHTML = '';

        function fetchResultados(password = "") {
            return fetch(`/api/resultados-seguros/${encodeURIComponent(jugador)}/${encodeURIComponent(jornada)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password })
            }).then(r => r.json());
        }

        try {
            let data = await fetchResultados();

            if (!data.success && data.error === "Contraseña requerida") {
                const password = await pedirPassword();

                if (!password) {
                    resultadosContainer.textContent = "No se ingresó contraseña.";
                    return;
                }

                data = await fetchResultados(password);
            }

            if (!data || !data.success) {
                resultadosContainer.textContent = data?.error || "Error al obtener resultados.";
                return;
            }

            const partidos = data.partidos;

            if (!Array.isArray(partidos) || partidos.length === 0) {
                resultadosContainer.textContent = 'El jugador no ha pronosticado esta jornada.';
                return;
            }

            const oficialesResponse = await fetch('/api/resultados-oficiales');
            const resultadosOficiales = await oficialesResponse.json();

            const resultadoOficial = Array.isArray(resultadosOficiales)
                ? resultadosOficiales.find(j => j.nombre === jornada)
                : null;

            const partidosOficiales = resultadoOficial ? resultadoOficial.partidos : [];

            resultadosContainer.innerHTML = '';

            let totalPuntos = 0;

            partidos.forEach(partidoPronosticado => {
                const resultadoOficialCorrespondiente = partidosOficiales.find(partido =>
                    partido.equipo1 === partidoPronosticado.equipo1 &&
                    partido.equipo2 === partidoPronosticado.equipo2
                );

                const puntos = calcularPuntos(partidoPronosticado, resultadoOficialCorrespondiente);
                totalPuntos += puntos;

                const oficialTexto = resultadoOficialCorrespondiente &&
                    isValidScore(resultadoOficialCorrespondiente.marcador1) &&
                    isValidScore(resultadoOficialCorrespondiente.marcador2)
                    ? `${resultadoOficialCorrespondiente.marcador1}-${resultadoOficialCorrespondiente.marcador2}`
                    : 'N/A';

                const partidoDiv = document.createElement('div');
                partidoDiv.classList.add('match-card', 'resultado');

                partidoDiv.innerHTML = `
                    <div class="match-teams">
                        <div class="team-side">
                            ${logoHTML(partidoPronosticado.logoEquipo1, partidoPronosticado.equipo1)}
                            <strong>${partidoPronosticado.equipo1}</strong>
                        </div>

                        <span class="match-score">
                            ${partidoPronosticado.marcador1} - ${partidoPronosticado.marcador2}
                        </span>

                        <div class="team-side">
                            ${logoHTML(partidoPronosticado.logoEquipo2, partidoPronosticado.equipo2)}
                            <strong>${partidoPronosticado.equipo2}</strong>
                        </div>
                    </div>

                    <div class="match-meta">
                        <span>Oficial: ${oficialTexto}</span>
                        ${estadoPartidoHTML(resultadoOficialCorrespondiente)}
                        <span>Puntos: ${puntos}</span>
                        ${resultadoOficialCorrespondiente?.comodin ? '<span>Comodín</span>' : ''}
                    </div>
                `;

                resultadosContainer.appendChild(partidoDiv);
            });

            totalPuntosContainer.innerHTML = `<h3>Total de Puntos Obtenidos: ${totalPuntos}</h3>`;

        } catch (error) {
            console.error('Error al buscar resultados:', error);
            resultadosContainer.textContent = 'Error al obtener resultados.';
        }
    }

    searchResultadosButtonpuntos.addEventListener('click', buscarResultados);

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

    async function iniciar() {
        await loadJugadores();
        await loadJornadas();
    }

    iniciar();
});