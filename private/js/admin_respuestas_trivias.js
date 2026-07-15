document.addEventListener('DOMContentLoaded', () => {
  const jornadaSelect = document.getElementById('jornadaSelect');
  const jugadorSelect = document.getElementById('jugadorSelect');
  const respuestasContainer = document.getElementById('respuestasContainer');
  const guardarBtn = document.getElementById('guardarBtn');
  const mensaje = document.getElementById('mensaje');

  let triviasActuales = [];

  async function solicitar(url, opciones) {
    const res = await fetch(url, opciones);
    if (res.redirected) {
      window.location.href = res.url;
      throw new Error('Sesión administrativa requerida.');
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        res.status === 404
          ? 'La ruta solicitada no existe en el servidor. Reinicie o actualice el backend.'
          : `El servidor devolvió una respuesta no válida (${res.status}).`
      );
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo completar la operación.');
    return data;
  }

  async function cargarSelectores() {
    try {
      const [jornadas, jugadores] = await Promise.all([
        solicitar('/api/trivias-jornadas'),
        solicitar('/api/jugadores')
      ]);

      jornadas.forEach(item => {
        const option = document.createElement('option');
        option.value = item.jornadaNombre;
        option.textContent = item.jornadaNombre;
        jornadaSelect.appendChild(option);
      });

      jugadores.forEach(nombre => {
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        jugadorSelect.appendChild(option);
      });
    } catch (error) {
      mensaje.textContent = error.message;
    }
  }

  function pintarTrivias() {
    respuestasContainer.innerHTML = '';

    if (!triviasActuales.length) {
      respuestasContainer.innerHTML = '<div class="resultados-mensaje">Esta jornada no tiene trivias activas.</div>';
      guardarBtn.disabled = true;
      return;
    }

    triviasActuales.forEach(trivia => {
      const card = document.createElement('div');
      card.className = 'trivia-question-card';

      const titulo = document.createElement('h3');
      titulo.textContent = `${trivia.equipo1} vs ${trivia.equipo2}`;
      card.appendChild(titulo);

      const pregunta = document.createElement('p');
      pregunta.textContent = trivia.pregunta;
      card.appendChild(pregunta);

      const estado = document.createElement('p');
      estado.className = 'helper-text';
      estado.textContent = trivia.resuelta
        ? `Resuelta: ${trivia.respuestaCorrecta} | Puntos actuales: ${trivia.puntosJugador}`
        : (trivia.cerrada ? 'Cerrada, pendiente de resolver' : 'Abierta');
      card.appendChild(estado);

      const select = document.createElement('select');
      select.dataset.triviaId = trivia._id;
      select.appendChild(new Option('Sin respuesta', ''));
      trivia.opciones.forEach(opcion => select.appendChild(new Option(opcion, opcion)));
      select.value = trivia.respuesta;
      card.appendChild(select);

      respuestasContainer.appendChild(card);
    });

    guardarBtn.disabled = false;
  }

  async function cargarRespuestas() {
    mensaje.textContent = '';
    guardarBtn.disabled = true;

    if (!jornadaSelect.value || !jugadorSelect.value) {
      respuestasContainer.innerHTML = '<div class="resultados-mensaje">Seleccione una jornada y un jugador.</div>';
      return;
    }

    respuestasContainer.innerHTML = '<div class="resultados-mensaje">Cargando respuestas...</div>';

    try {
      const data = await solicitar(
        `/api/admin/respuestas-trivias/${encodeURIComponent(jornadaSelect.value)}/${encodeURIComponent(jugadorSelect.value)}`
      );
      triviasActuales = data.trivias;
      pintarTrivias();
    } catch (error) {
      respuestasContainer.innerHTML = '';
      mensaje.textContent = error.message;
    }
  }

  jornadaSelect.addEventListener('change', () => {
    jugadorSelect.disabled = !jornadaSelect.value;
    jugadorSelect.value = '';
    triviasActuales = [];
    guardarBtn.disabled = true;
    respuestasContainer.innerHTML = '<div class="resultados-mensaje">Seleccione un jugador.</div>';
    mensaje.textContent = '';
  });

  jugadorSelect.addEventListener('change', cargarRespuestas);

  guardarBtn.addEventListener('click', async () => {
    const respuestas = [...respuestasContainer.querySelectorAll('select[data-trivia-id]')].map(select => ({
      triviaId: select.dataset.triviaId,
      respuesta: select.value
    }));

    guardarBtn.disabled = true;
    mensaje.textContent = 'Guardando...';

    try {
      const data = await solicitar(
        `/api/admin/respuestas-trivias/${encodeURIComponent(jornadaSelect.value)}/${encodeURIComponent(jugadorSelect.value)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ respuestas })
        }
      );
      mensaje.textContent = data.mensaje;
      await cargarRespuestas();
      mensaje.textContent = data.mensaje;
    } catch (error) {
      mensaje.textContent = error.message;
      guardarBtn.disabled = false;
    }
  });

  cargarSelectores();
});
