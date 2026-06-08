document.addEventListener('DOMContentLoaded', () => {
    const calcularButton = document.querySelector('#calcularResultados');

    calcularButton.addEventListener('click', () => {
        console.log("Calculando resultados...");
        fetch('/api/resultados-totales')
            .then(response => response.json())
            .then(resultados => {
                const tableBody = document.querySelector('#resultadosTotalesTable tbody');
                const tableHead = document.querySelector('#resultadosTotalesTable thead tr');

                // Limpiar tabla
                tableBody.innerHTML = '';
                tableHead.innerHTML = '<th>Jugador</th>'; // Reiniciar encabezado

                // Obtener las jornadas de los resultados
                const ejemploJugador = Object.keys(resultados)[0]; // Tomamos el primer jugador como referencia
                const jornadas = Object.keys(resultados[ejemploJugador]).filter(key => key !== 'total');

                // Crear encabezados dinámicamente
                jornadas.forEach(jornadaId => {
                    const th = document.createElement('th');
                    th.textContent = `${jornadaId}`;
                    tableHead.appendChild(th);
                });

                // Añadir columna de puntuación total
                const thTotal = document.createElement('th');
                thTotal.textContent = 'Total';
                tableHead.appendChild(thTotal);

                // Convertir los resultados a un array y ordenarlos por puntos totales
                const jugadoresArray = Object.keys(resultados).map(jugador => ({
                    nombre: jugador,
                    resultados: resultados[jugador]
                }));

                jugadoresArray.sort((a, b) => b.resultados.total - a.resultados.total);

                // Añadir filas para cada jugador
                jugadoresArray.forEach(jugadorData => {
                    const jugador = jugadorData.nombre;
                    const row = document.createElement('tr');
                    const nombreCell = document.createElement('td');
                    nombreCell.textContent = jugador;
                    row.appendChild(nombreCell);

                    // Añadir celdas de las jornadas y la puntuación total
                    jornadas.forEach(jornadaId => {
                        const cell = document.createElement('td');
                        cell.textContent = resultados[jugador][jornadaId];
                        row.appendChild(cell);
                    });

                    // Añadir la puntuación total
                    const cellTotal = document.createElement('td');
                    cellTotal.textContent = resultados[jugador].total;
                    row.appendChild(cellTotal);

                    tableBody.appendChild(row);
                });
            })
            .catch(error => console.error('Error al obtener resultados:', error));
    });
});


/*
document.addEventListener('DOMContentLoaded', () => {    
        const calcularButton = document.querySelector('#calcularResultados');
    
        calcularButton.addEventListener('click', () => {
            console.log("jugador en este momento = " )
            fetch('/api/resultados-totales')
                .then(response => response.json())
                .then(resultados => {
                    const tableBody = document.querySelector('#resultadosTotalesTable tbody');
                    const tableHead = document.querySelector('#resultadosTotalesTable thead tr');
    
                    // Limpiar tabla
                    tableBody.innerHTML = '';
                    tableHead.innerHTML = '<th>Jugador</th>'; // Reiniciar encabezado
    
                    // Obtener las jornadas de los resultados
                    const ejemploJugador = Object.keys(resultados)[0]; // Tomamos el primer jugador como referencia
                    const jornadas = Object.keys(resultados[ejemploJugador]).filter(key => key !== 'total');
    
                    // Crear encabezados dinámicamente
                    jornadas.forEach(jornadaId => {
                        const th = document.createElement('th');
                        th.textContent = `Jornada ${jornadaId}`;
                        tableHead.appendChild(th);
                    });
    
                    // Añadir columna de puntuación total
                    const thTotal = document.createElement('th');
                    thTotal.textContent = 'Total';
                    tableHead.appendChild(thTotal);
    
                    // Añadir filas para cada jugador
                    Object.keys(resultados).forEach(jugador => {
                        const row = document.createElement('tr');
                        const nombreCell = document.createElement('td');
                        nombreCell.textContent = jugador;
                        row.appendChild(nombreCell);
    
                        // Añadir celdas de las jornadas y la puntuación total
                        jornadas.forEach(jornadaId => {
                            const cell = document.createElement('td');
                            cell.textContent = resultados[jugador][jornadaId];
                            row.appendChild(cell);
                        });
    
                        // Añadir la puntuación total
                        const cellTotal = document.createElement('td');
                        cellTotal.textContent = resultados[jugador].total;
                        row.appendChild(cellTotal);
    
                        tableBody.appendChild(row);
                    });
                });
        });

    

});
*/