const { Client } = require('pg');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };

    const userIdRaw = event.queryStringParameters.userId;
    if (!userIdRaw) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta userId' }) };
    const userId = userIdRaw.toLowerCase();

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
    });

    let isTransactionActive = false;

    try {
        await client.connect();

        if (event.httpMethod === 'DELETE') {
            // Borrado explícito de todas las tablas para asegurar limpieza total
            await client.query('DELETE FROM servicios WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM registros_drogas WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM registros_detenidos WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM users WHERE username = $1', [userId]);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ status: 'ok', message: 'Usuario y todos sus datos eliminados' })
            };
        }

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body);
            const { settings, servicios, drogas, detenidos } = body;

            await client.query('BEGIN');
            isTransactionActive = true;

            // 1. Asegurar Usuario
            await client.query(`
                INSERT INTO users (username, nombre, apellidos, empleo, unidad, subsector)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (username) DO UPDATE SET
                nombre = EXCLUDED.nombre, apellidos = EXCLUDED.apellidos,
                updated_at = CURRENT_TIMESTAMP`,
                [userId, settings?.nombre || '', settings?.apellidos || '', settings?.empleo || '', settings?.unidad || '', settings?.subsector || '']);

            // 2. Kilómetros
            if (Array.isArray(servicios)) {
                for (const s of servicios) {
                    await client.query(`
                        INSERT INTO servicios (user_id, fecha, servicio, horario_inicio, horario_fin, vehiculo, distancia, denuncias, motivo, observaciones)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT (user_id, fecha) DO UPDATE SET
                        servicio = EXCLUDED.servicio, distancia = EXCLUDED.distancia, denuncias = EXCLUDED.denuncias`,
                        [userId, s.fecha, s.servicio, s.horarioInicio, s.horarioFin, s.vehiculo, s.distancia, s.denuncias || 0, s.motivo, s.observaciones]);
                }
            }

            // 3. Drogas y 4. Detenidos (Limpieza y carga rápida)
            await client.query('DELETE FROM registros_drogas WHERE user_id = $1', [userId]);
            if (Array.isArray(drogas)) {
                for (const d of drogas) {
                    await client.query('INSERT INTO registros_drogas (user_id, fecha, dni, nombre, matricula, resultado, external_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
                        [userId, d.fecha, d.dni, d.nombre, d.matricula, d.resultado, d.id]);
                }
            }

            await client.query('DELETE FROM registros_detenidos WHERE user_id = $1', [userId]);
            if (Array.isArray(detenidos)) {
                for (const det of detenidos) {
                    await client.query('INSERT INTO registros_detenidos (user_id, fecha_timestamp, dni_nie, nombre_apellidos, matricula, external_id) VALUES ($1,$2,$3,$4,$5,$6)',
                        [userId, det.fecha, det.dniNie, det.nombreApellidosDetenido, det.matricula, det.id]);
                }
            }

            await client.query('COMMIT');
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok' }) };
        }

        if (event.httpMethod === 'GET') {
            // Nueva funcionalidad: Listar todos los usuarios para el Admin
            if (event.queryStringParameters.listAll === 'true') {
                const allUsers = await client.query('SELECT username FROM users ORDER BY username ASC');
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(allUsers.rows.map(r => r.username))
                };
            }

            const user = await client.query('SELECT * FROM users WHERE username = $1', [userId]);
            if (user.rows.length === 0) {
                return { statusCode: 200, headers, body: JSON.stringify({ settings: {}, servicios: [], drogas: [], detenidos: [] }) };
            }
            const s = await client.query('SELECT * FROM servicios WHERE user_id = $1', [userId]);
            const d = await client.query('SELECT * FROM registros_drogas WHERE user_id = $1', [userId]);
            const det = await client.query('SELECT * FROM registros_detenidos WHERE user_id = $1', [userId]);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    settings: user.rows[0],
                    servicios: s.rows.map(r => ({ ...r, horarioInicio: r.horario_inicio, horarioFin: r.horario_fin })),
                    drogas: d.rows.map(r => ({ ...r, id: r.external_id })),
                    detenidos: det.rows.map(r => ({ ...r, id: r.external_id, fecha: r.fecha_timestamp, nombreApellidosDetenido: r.nombre_apellidos, dniNie: r.dni_nie }))
                })
            };
        }
    } catch (err) {
        if (isTransactionActive) await client.query('ROLLBACK').catch(() => {});
        console.error("Fallo critico sync:", err.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    } finally {
        await client.end().catch(() => {});
    }
};
