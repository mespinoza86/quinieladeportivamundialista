document.addEventListener('DOMContentLoaded', () => {
    let ultimaJornada = null;
    let fechaCierreGlobal = null;

    // Cargar jornadas
    fetch('/api/jornadas')
        .then(response => response.json())
        .then(data => {
            if (!data || data.length === 0) {
                console.error("No hay jornadas disponibles");
                return;
            }

            // Seleccionamos la última jornada
            ultimaJornada = data[data.length - 1].nombre;
            fechaCierreGlobal = data[data.length - 1].fechaCierre;
            loadPartidos(ultimaJornada);
        })
        .catch(error => console.error('Error al cargar las jornadas:', error));

    // Cargar jugadores en combo
    fetch('/api/jugadores')
        .then(res => res.json())
        .then(jugadores => {
            const combo = document.getElementById('comboJugadores');
            combo.innerHTML = '<option value="">Seleccione un jugador</option>';
            jugadores.forEach(j => {
                const opt = document.createElement('option');
                opt.value = j;
                opt.textContent = j;
                combo.appendChild(opt);
            });
        });

    // Botones
    document.getElementById('copiarTextoButton').addEventListener('click', copiarResultados);
    document.getElementById('enviarWhatsappButton').addEventListener('click', enviarPorWhatsapp);
    document.getElementById('guardarResultadosButton').addEventListener('click', () => {
        guardarResultados(ultimaJornada, fechaCierreGlobal);
    });
});

function loadPartidos(nombreJornada) {
    fetch('/api/jornadas')
        .then(response => response.json())
        .then(data => {
            const jornada = data.find(j => j.nombre === nombreJornada);
            if (!jornada) {
                console.error("Jornada no encontrada:", nombreJornada);
                return;
            }
            mostrarPartidos(jornada.partidos, jornada.fechaCierre);
        })
        .catch(error => console.error('Error al cargar los partidos:', error));
}

function logoHTML(url, nombre) {
    if (!url) return '';
    return `<img src="${url}" class="team-logo" alt="${nombre || 'Equipo'}">`;
}

function mostrarPartidos(partidos, fechaCierre) {
    const partidosContainer = document.getElementById('partidosContainer');
    partidosContainer.innerHTML = '';

    if (fechaCierre) {
        const fecha = new Date(fechaCierre);
        const infoDiv = document.createElement('div');

        infoDiv.id = "infoCierre";
        infoDiv.style.marginBottom = "20px";
        infoDiv.style.textAlign = "center";

        infoDiv.innerHTML = `
            <div>
                <strong>Cierre de jornada:</strong>
                ${fecha.toLocaleDateString()}
                ${fecha.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute:'2-digit'
                })}
            </div>

            <div>
                <strong>Tiempo restante:</strong>
                <span id="contadorCierre"></span>
            </div>
        `;

        partidosContainer.appendChild(infoDiv);

        setInterval(() => {
            const ahora = new Date();
            const diff = fecha - ahora;

            if (diff > 0) {
                const horas = Math.floor(diff / (1000 * 60 * 60));
                const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const segundos = Math.floor((diff % (1000 * 60)) / 1000);

                document.getElementById("contadorCierre").textContent =
                    `${horas}h ${minutos}m ${segundos}s`;
            } else {
                document.getElementById("contadorCierre").textContent =
                    "Jornada cerrada";
            }
        }, 1000);
    }

    partidos.forEach((partido, i) => {
        const partidoDiv = document.createElement('div');

        partidoDiv.classList.add('partido-container');
        partidoDiv.dataset.equipo1 = partido.equipo1 || '';
        partidoDiv.dataset.equipo2 = partido.equipo2 || '';
        partidoDiv.dataset.comodin = partido.comodin ? 'true' : 'false';


        const estiloNegrita = partido.comodin
            ? 'font-weight: bold;'
            : '';

        partidoDiv.innerHTML = `
            <div class="match-teams">

                <div class="team-side">
                    ${logoHTML(partido.logoEquipo1, partido.equipo1)}

                    <label style="${estiloNegrita}">
                        ${partido.equipo1}
                    </label>
                </div>

                <input
                    type="text"
                    id="resultadoEquipo1_${i}"
                >

                <label style="${estiloNegrita}">
                    vs
                </label>

                <input
                    type="text"
                    id="resultadoEquipo2_${i}"
                >

                <div class="team-side">
                    ${logoHTML(partido.logoEquipo2, partido.equipo2)}

                    <label style="${estiloNegrita}">
                        ${partido.equipo2}
                    </label>
                </div>

                <label style="display:none;">
                    Comodín: ${partido.comodin ? 'Sí' : 'No'}
                </label>

            </div>
        `;

        partidosContainer.appendChild(partidoDiv);
    });
}


function copiarResultados() {
    const nombreJugador = document.getElementById('comboJugadores').value;
    const partidosContainer = document.getElementById('partidosContainer');

    let textoResultado = '';
    let contador = 1;

    textoResultado += `-------------------------------\n`;
    textoResultado += `Nombre: ${nombreJugador || '[Sin nombre]'}\n`;
    textoResultado += `-------------------------------\n`;

    Array.from(partidosContainer.children)
        .filter(div => div.classList.contains('partido-container'))
        .forEach((partidoDiv, index) => {
            const equipo1 = partidoDiv.dataset.equipo1 || '';
            const equipo2 = partidoDiv.dataset.equipo2 || '';

            const resultado1 = document.getElementById(`resultadoEquipo1_${index}`)?.value || '0';
            const resultado2 = document.getElementById(`resultadoEquipo2_${index}`)?.value || '0';

            const comodin = partidoDiv.dataset.comodin === 'true';
            const formato = comodin ? '*' : '';

            if (comodin) textoResultado += "\n*(Comodín)*";

            textoResultado += `\n${contador}. ${formato}${equipo1} ${resultado1}${formato}\n  ${formato}${equipo2} ${resultado2}${formato}\n`;

            contador++;
        });

    navigator.clipboard.writeText(textoResultado)
        .then(() => {
            alert('Texto copiado al portapapeles');
        })
        .catch(error => {
            console.error('Error copiando texto:', error);
            alert('No se pudo copiar el texto.');
        });
}


function enviarPorWhatsapp() {
    const nombreJugador = document.getElementById('comboJugadores').value;
    const partidosContainer = document.getElementById('partidosContainer');

    let textoResultado = '';
    let contador = 1;

    textoResultado += `-------------------------------\n`;
    textoResultado += `Nombre: ${nombreJugador || '[Sin nombre]'}\n`;
    textoResultado += `-------------------------------\n`;

    Array.from(partidosContainer.children)
        .filter(div => div.classList.contains('partido-container'))
        .forEach((partidoDiv, index) => {
            const equipo1 = partidoDiv.dataset.equipo1 || '';
            const equipo2 = partidoDiv.dataset.equipo2 || '';

            const resultado1 = document.getElementById(`resultadoEquipo1_${index}`)?.value || '0';
            const resultado2 = document.getElementById(`resultadoEquipo2_${index}`)?.value || '0';

            const comodin = partidoDiv.dataset.comodin === 'true';
            const formato = comodin ? '*' : '';

            if (comodin) textoResultado += "\n*(Comodín)*";

            textoResultado += `\n${contador}. ${formato}${equipo1} ${resultado1}${formato}\n  ${formato}${equipo2} ${resultado2}${formato}\n`;

            contador++;
        });

    const mensajeWhatsapp = encodeURIComponent(textoResultado);
    window.open(`https://wa.me/?text=${mensajeWhatsapp}`, '_blank');
}



function pedirPasswordModal(jugador) {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('modalPassword');
        const input = document.getElementById('inputPassword');
        const btnOk = document.getElementById('btnPasswordOk');
        const btnCancel = document.getElementById('btnPasswordCancel');

        modal.style.display = 'flex';
        input.value = '';
        input.focus();

        function cerrarModal() {
            modal.style.display = 'none';
            btnOk.removeEventListener('click', okHandler);
            btnCancel.removeEventListener('click', cancelHandler);
        }

        function okHandler() {
            const val = input.value;
            cerrarModal();
            resolve(val);
        }

        function cancelHandler() {
            cerrarModal();
            resolve(null);
        }

        btnOk.addEventListener('click', okHandler);
        btnCancel.addEventListener('click', cancelHandler);
    });
}




async function guardarResultados(jornada, fechaCierre) {
    const combo = document.getElementById('comboJugadores');
    const jugador = combo.value;
    if (!jugador) {
        alert("Seleccione un jugador");
        return;
    }

    // 1. Verificar fecha cierre
    if (fechaCierre) {
        const ahora = new Date();
        if (new Date(fechaCierre) <= ahora) {
            alert("Error, la hora de cierre de la jornada ya ha pasado");
            return;
        }
    }

    // 2. Verificar que el jugador tenga contraseña
    const jugadorData = await fetch(`/api/jugador/${jugador}`).then(r => r.json());
    if (!jugadorData.password) {
        alert("Su jugador no tiene contraseña aun, hable con el administrador");
        return;
    }

    // 3. Pedir contraseña y validarla
    let passwordCorrecta = false;
    while (!passwordCorrecta) {
        const passwordIngresada = await pedirPasswordModal(jugador);
        if (passwordIngresada === null) return; // Cancelado
        const resp = await fetch(`/api/jugadores/${jugador}/verificar-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: passwordIngresada })
        });

/*        
        if (!resp.ok) {
            const text = await resp.text(); // para depurar
            console.error("Error en verificación de contraseña:", text);
            alert("Error al verificar contraseña");
            return;
        }
  */

        const data = await resp.json();

        if (!data.success) {
            alert("Contraseña incorrecta");
        } else {
            passwordCorrecta = true;
        }
    }

    // 4. Preparar pronósticos
    const partidosContainer = document.getElementById('partidosContainer');
    const pronosticos = [];
    let errorDetectado = false;

    Array.from(document.querySelectorAll('.partido-container')).forEach((partidoDiv, index) => {
        const inputs = partidoDiv.querySelectorAll('input');
        const marcador1 = inputs[0].value.trim();
        const marcador2 = inputs[1].value.trim();

        // Validación de espacios en blanco
        if (marcador1 === '' || marcador2 === '') {
            alert(`Error: faltan resultados por agregar en el partido ${index + 1}`);
            errorDetectado = true;
            return;
        }

        // Validación de solo números
        if (isNaN(marcador1) || isNaN(marcador2)) {
            alert(`Error: solo se permiten valores numéricos en el partido ${index + 1}`);
            errorDetectado = true;
            return;
        }

        pronosticos.push({
            marcador1: marcador1,
            marcador2: marcador2
        });
    });

    if (errorDetectado) return; // Salir si hubo error


    // 5. Guardar en backend
    await fetch('/api/resultados', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jugador, jornada, pronosticos })
    });

    alert("Recuerda enviar un mensaje en el grupo escribiendo que sus resultados ya fueron guardados.\n Revise en Resultados Pronosticados por Jugador que sus resultados son los correctos.\n Resultados guardados correctamente");
}
