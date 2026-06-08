document.addEventListener('DOMContentLoaded', () => {
    const jugadorSelect = document.getElementById('jugadorSelect');
    const jornadaSelect = document.getElementById('jornadaSelect');
    const searchResultadosButton = document.getElementById('searchResultadosButton');
    const resultadosContainer = document.getElementById('resultadosContainer');

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
            }).catch(console.error);
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
                }
            }).catch(console.error);
    }

    // Función que muestra modal para contraseña y devuelve la contraseña escrita
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
    let data = await fetch(`/api/resultados-seguros/${jugador}/${jornada}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).then(res => res.json());

    // Si requiere contraseña
    if (data && data.success === false && data.error === 'Contraseña requerida') {
        const password = await pedirPassword();
        body.password = password;
        data = await fetch(`/api/resultados-seguros/${jugador}/${jornada}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(res => res.json());
    }

    resultadosContainer.innerHTML = '';

    // Verificamos errores específicos
    if (data && data.success === false && data.error === 'Contraseña incorrecta') {
        resultadosContainer.textContent = 'La contraseña es incorrecta.';
        return;
    }

    if (!data || !data.partidos || data.partidos.length === 0) {
        resultadosContainer.textContent = 'El jugador no ha pronosticado resultados para esta jornada.';
        return;
    }

    // Mostrar resultados si todo está correcto
    // Mostrar resultados si todo está correcto
data.partidos.forEach(p => {
    const div = document.createElement('div');
    div.classList.add('match-card', 'resultado');

    div.innerHTML = `
        <div class="match-teams">
            <div class="team-side">
                ${p.logoEquipo1 ? `<img src="${p.logoEquipo1}" class="team-logo" alt="${p.equipo1}">` : ''}
                <strong>${p.equipo1}</strong>
            </div>

            <span class="match-score">
                ${p.marcador1 ?? '-'} - ${p.marcador2 ?? '-'}
            </span>

            <div class="team-side">
                ${p.logoEquipo2 ? `<img src="${p.logoEquipo2}" class="team-logo" alt="${p.equipo2}">` : ''}
                <strong>${p.equipo2}</strong>
            </div>
        </div>
    `;

    resultadosContainer.appendChild(div);
});


} catch (err) {
    console.error(err);
    resultadosContainer.textContent = 'Error al obtener resultados.';
}



    }

    searchResultadosButton.addEventListener('click', buscarResultados);

    loadJugadores();
    loadJornadas();
});
