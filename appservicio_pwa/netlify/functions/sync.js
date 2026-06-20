const { Client } = require('pg');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };

    const userId = event.queryStringParameters.userId;
    if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta userId' }) };

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000, // 10 segundos de timeout para conectar
    });

    let isTransactionActive = false;

    try {
        await client.connect();

        // --- LÓGICA DELETE (Eliminar Usuario) ---
        if (event.httpMethod === 'DELETE') {
            await client.query('DELETE FROM users WHERE username = $1', [userId]);
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', message: 'Usuario y datos eliminados' }) };
        }

        if (event.httpMethod === 'POST') {
            const { settings, servicios, drogas, detenidos } = JSON.parse(event.body);

            await client.query('BEGIN');
            isTransactionActive = true;

            // 1. Usuarios
            if (settings) {
                await client.query(`INSERT INTO users (username, nombre, apellidos, empleo, unidad, subsector)
                    VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (username) DO UPDATE SET
                    nombre = EXCLUDED.nombre, apellidos = EXCLUDED.apellidos, empleo = EXCLUDED.empleo, unidad = EXCLUDED.unidad, subsector = EXCLUDED.subsector, updated_at = CURRENT_TIMESTAMP`,
                    [userId, settings.nombre, settings.apellidos, settings.empleo, settings.unidad, settings.subsector]);
            }

            // 2. Kilómetros (Usamos ON CONFLICT, no hace falta el DELETE previo que ralentiza)
            if (servicios && servicios.length > 0) {
                for (const s of servicios) {
                    await client.query(`
                        INSERT INTO servicios (user_id, fecha, servicio, horario_inicio, horario_fin, vehiculo, distancia, denuncias, motivo, observaciones)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT (user_id, fecha)
                        DO UPDATE SET
                            servicio = EXCLUDED.servicio,
                            horario_inicio = EXCLUDED.horario_inicio,
                            horario_fin = EXCLUDED.horario_fin,
                            vehiculo = EXCLUDED.vehiculo,
                            distancia = EXCLUDED.distancia,
                            denuncias = EXCLUDED.denuncias,
                            motivo = EXCLUDED.motivo,
                            observaciones = EXCLUDED.observaciones
                    `, [userId, s.fecha, s.servicio, s.horarioInicio, s.horarioFin, s.vehiculo, s.distancia, s.denuncias || 0, s.motivo, s.observaciones]);
                }
            }

            // 3. Drogas
            await client.query('DELETE FROM registros_drogas WHERE user_id = $1', [userId]);
            if (drogas && drogas.length > 0) {
                for (const d of drogas) {
                    await client.query(`INSERT INTO registros_drogas (user_id, fecha, dni, nombre, matricula, resultado, external_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`, [userId, d.fecha, d.dni, d.nombre, d.matricula, d.resultado, d.id]);
                }
            }

            // 4. Detenidos
            await client.query('DELETE FROM registros_detenidos WHERE user_id = $1', [userId]);
            if (detenidos && detenidos.length > 0) {
                for (const det of detenidos) {
                    await client.query(`INSERT INTO registros_detenidos (user_id, fecha_timestamp, dni_nie, nombre_apellidos, matricula, external_id)
                        VALUES ($1, $2, $3, $4, $5, $6)`, [userId, det.fecha, det.dniNie, det.nombreApellidosDetenido, det.matricula, det.id]);
                }
            }

            await client.query('COMMIT');
            isTransactionActive = false;
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok' }) };
        }

        if (event.httpMethod === 'GET') {
            const userRes = await client.query('SELECT * FROM users WHERE username = $1', [userId]);
            const servRes = await client.query('SELECT * FROM servicios WHERE user_id = $1', [userId]);
            const drogRes = await client.query('SELECT * FROM registros_drogas WHERE user_id = $1', [userId]);
            const detRes = await client.query('SELECT * FROM registros_detenidos WHERE user_id = $1', [userId]);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    settings: userRes.rows[0] || {},
                    servicios: servRes.rows.map(s => ({ ...s, horarioInicio: s.horario_inicio, horarioFin: s.horario_fin })),
                    drogas: drogRes.rows.map(d => ({ ...d, id: d.external_id })),
                    detenidos: detRes.rows.map(d => ({ ...d, id: d.external_id, fecha: d.fecha_timestamp, nombreApellidosDetenido: d.nombre_apellidos, dniNie: d.dni_nie }))
                })
            };
        }
    } catch (err) {
        console.error("Error en sync.js:", err.message);
        if (isTransactionActive) {
            try { await client.query('ROLLBACK'); } catch (e) { /* Ignorar error en rollback */ }
        }
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    } finally {
        try { await client.end(); } catch (e) { /* Ignorar error al cerrar */ }
    }
};
