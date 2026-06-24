document.addEventListener('DOMContentLoaded', async () => {
  const jugadorSelect = document.getElementById('jugadorSelect');
  const guardarBtn = document.getElementById('guardarBtn');
  const triviasContainer = document.getElementById('triviasContainer');
  const mensaje = document.getElementById('mensaje');
  const tituloTrivia = document.getElementById('tituloTrivia');
  const subtituloTrivia = document.getElementById('subtituloTrivia');
  const infoCierreTrivia = document.getElementById('infoCierreTrivia');

  let trivias = [];
  let jornadaTrivia = null;
  let jugadorValidado = null;
  let fechaCierreGlobal = null;
  let intervaloContador = null;

  await cargarJugadores();
  await cargarUltimaTrivia();

  jugadorSelect.addEventListener('change', validarJugadorSeleccionado);
  guardarBtn.addEventListener('click', guardarRespuestas);

  async function cargarJugadores() {
    const res = await fetch('/api/jugadores');
    const jugadores = await res.json();

    jugadorSelect.innerHTML = '<option value="">Seleccione un jugador</option>';

    jugadores.forEach(jugador => {
      const option = document.createElement('option');
      option.value = jugador;
      option.textContent = jugador;
      jugadorSelect.appendChild(option);
    });
  }

  async function cargarUltimaTrivia() {
    mensaje.textContent = '';

    const res = await fetch('/api/trivias/latest');
    const data = await res.json();

    if (!res.ok || !data.trivias || data.trivias.length === 0) {
      triviasContainer.innerHTML = '<div class="resultados-mensaje">No hay trivias disponibles.</div>';
      guardarBtn.style.display = 'none';
      infoCierreTrivia.innerHTML = '';
      return;
    }

    trivias = data.trivias;
    jornadaTrivia = data.jornadaNombre;
    fechaCierreGlobal = data.fechaCierre;

    tituloTrivia.textContent = `Trivia - ${jornadaTrivia}`;
    subtituloTrivia.textContent = 'Las preguntas se muestran siempre. Para guardar, selecciona tu jugador y valida la contraseña.';

    mostrarInfoCierre(fechaCierreGlobal);
    pintarTrivias([]);
  }

  function mostrarInfoCierre(fechaCierre) {
    if (!fechaCierre) {
      infoCierreTrivia.innerHTML = '';
      return;
    }

    const fecha = new Date(fechaCierre);

    infoCierreTrivia.innerHTML = `
      <div>
        <strong>Cierre de trivia:</strong>
        ${fecha.toLocaleDateString()}
        ${fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>

      <div>
        <strong>Tiempo restante:</strong>
        <span id="contadorTrivia"></span>
      </div>
    `;

    if (intervaloContador) clearInterval(intervaloContador);

    intervaloContador = setInterval(() => {
      const contador = document.getElementById('contadorTrivia');
      if (!contador) return;

      const ahora = new Date();
      const diff = fecha - ahora;

      if (diff > 0) {
        const horas = Math.floor(diff / (1000 * 60 * 60));
        const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((diff % (1000 * 60)) / 1000);

        contador.textContent = `${horas}h ${minutos}m ${segundos}s`;
      } else {
        contador.textContent = 'Trivia cerrada';
      }
    }, 1000);
  }

  async function validarJugadorSeleccionado() {
    const jugador = jugadorSelect.value;

    jugadorValidado = null;
    mensaje.textContent = '';
    limpiarRespuestas();

    if (!jugador) return;

    const jugadorData = await fetch(`/api/jugador/${encodeURIComponent(jugador)}`).then(r => r.json());

    if (!jugadorData.password) {
      alert('Su jugador no tiene contraseña aún, hable con el administrador.');
      jugadorSelect.value = '';
      return;
    }

    let passwordCorrecta = false;

    while (!passwordCorrecta) {
      const passwordIngresada = await pedirPasswordModal();

      if (passwordIngresada === null) {
        jugadorSelect.value = '';
        limpiarRespuestas();
        return;
      }

      const resp = await fetch(`/api/jugadores/${encodeURIComponent(jugador)}/verificar-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordIngresada })
      });

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        alert(data.error || 'Contraseña incorrecta');
      } else {
        passwordCorrecta = true;
        jugadorValidado = jugador;
        await cargarRespuestasGuardadas(jugador);
      }
    }
  }

  async function cargarRespuestasGuardadas(jugador) {
    if (!jugador || !jornadaTrivia) return;

    const res = await fetch(
      `/api/respuestas-trivia/${encodeURIComponent(jugador)}/${encodeURIComponent(jornadaTrivia)}`
    );

    const respuestasPrevias = await res.json();
    pintarTrivias(respuestasPrevias);
  }

  function respuestaPrevia(respuestasPrevias, triviaId) {
    const encontrada = respuestasPrevias.find(r => String(r.triviaId) === String(triviaId));
    return encontrada ? encontrada.respuesta : '';
  }

  function pintarTrivias(respuestasPrevias = []) {
    const grupos = {};

    trivias.forEach(trivia => {
      const key = `${trivia.equipo1} vs ${trivia.equipo2}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(trivia);
    });

    triviasContainer.innerHTML = Object.keys(grupos).map(titulo => {
      return `
        <div class="trivia-match-card">
          <h3>${titulo}</h3>

          ${grupos[titulo].map(trivia => {
            const previa = respuestaPrevia(respuestasPrevias, trivia._id);

            return `
              <div class="trivia-question-card">
                <p>${trivia.pregunta}</p>

                <select class="respuesta-trivia" data-trivia-id="${trivia._id}">
                  <option value="">Seleccione respuesta</option>
                  ${trivia.opciones.map(opcion => `
                    <option value="${opcion}" ${previa === opcion ? 'selected' : ''}>
                      ${opcion}
                    </option>
                  `).join('')}
                </select>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }).join('');
  }

  function limpiarRespuestas() {
    document.querySelectorAll('.respuesta-trivia').forEach(select => {
      select.value = '';
    });
  }

  function pedirPasswordModal() {
    return new Promise(resolve => {
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
        input.removeEventListener('keydown', enterHandler);
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

      function enterHandler(e) {
        if (e.key === 'Enter') {
          okHandler();
        }
      }

      btnOk.addEventListener('click', okHandler);
      btnCancel.addEventListener('click', cancelHandler);
      input.addEventListener('keydown', enterHandler);
    });
  }

  async function guardarRespuestas() {
    mensaje.textContent = '';

    if (!trivias || trivias.length === 0) {
      alert('No hay trivias disponibles.');
      return;
    }

    if (fechaCierreGlobal && new Date(fechaCierreGlobal) <= new Date()) {
      alert('Error, la trivia ya está cerrada.');
      return;
    }

    const jugador = jugadorSelect.value;

    if (!jugador) {
      alert('Seleccione un jugador.');
      return;
    }

    if (jugador !== jugadorValidado) {
      alert('Debe seleccionar el jugador y validar la contraseña antes de guardar.');
      return;
    }

    const respuestas = Array.from(document.querySelectorAll('.respuesta-trivia'))
      .map(select => ({
        triviaId: select.dataset.triviaId,
        respuesta: select.value
      }))
      .filter(item => item.respuesta);

    if (respuestas.length === 0) {
      alert('Debe responder al menos una trivia.');
      return;
    }

    const faltantes = document.querySelectorAll('.respuesta-trivia').length - respuestas.length;

    if (faltantes > 0) {
      const continuar = confirm(
        'Faltan trivias por responder.\n\n¿Está seguro que desea guardar?'
      );

      if (!continuar) return;
    }

    const res = await fetch('/api/respuestas-trivia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jugador, respuestas })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error guardando trivias.');
      return;
    }

    alert('Trivias guardadas correctamente.');
    mensaje.textContent = data.mensaje || 'Trivias guardadas correctamente.';
  }
});