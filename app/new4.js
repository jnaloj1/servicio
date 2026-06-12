const { Client } = require('pg');

exports.handler = async (event, context) => {
    // Configuración de CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    const userId = event.queryStringParameters.userId;
    if (!userId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta userId' }) };
    }

    // Usamos la variable de entorno por seguridad
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // --- LÓGICA DE SUBIDA (POST) ---
        if (event.httpMethod === 'POST') {
            const { settings, servicios, drogas, detenidos } = JSON.parse(event.body);
            
            await client.query('BEGIN'); // Iniciamos transacción para que se guarde todo o nada

            // 1. Guardar/Actualizar Usuario y Ajustes
            await client.query(`
                INSERT INTO users (username, nombre, apellidos, empleo, unidad, subsector) 
                VALUES ($1, $2, $3, $4, $5, $6) 
                ON CONFLICT (username) DO UPDATE SET 
                nombre = EXCLUDED.nombre, apellidos = EXCLUDED.apellidos, 
                empleo = EXCLUDED.empleo, unidad = EXCLUDED.unidad, 
                subsector = EXCLUDED.subsector, updated_at = CURRENT_TIMESTAMP`, 
                [userId, settings.nombre, settings.apellidos, settings.empleo, settings.unidad, settings.subsector]);

            // 2. Sincronizar Servicios (App Kilómetros)
            await client.query('DELETE FROM servicios WHERE user_id = $1', [userId]);
            for (const s of servicios) {
                await client.query(`
                    INSERT INTO servicios (user_id, fecha, servicio, horario_inicio, horario_fin, vehiculo, distancia, motivo, observaciones)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, 
                    [userId, s.fecha, s.servicio, s.horarioInicio, s.horarioFin, s.vehiculo, s.distancia, s.motivo, s.observaciones]);
            }

            // 3. Sincronizar Registros de Drogas
            await client.query('DELETE FROM registros_drogas WHERE user_id = $1', [userId]);
            if (drogas && drogas.length > 0) {
                for (const d of drogas) {
                    await client.query(`
                        INSERT INTO registros_drogas (user_id, fecha, dni, nombre, matricula, resultado, external_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
                        [userId, d.fecha, d.dni, d.nombre, d.matricula, d.resultado, d.id]);
                }
            }

            // 4. Sincronizar Registros de Detenidos
            await client.query('DELETE FROM registros_detenidos WHERE user_id = $1', [userId]);
            if (detenidos && detenidos.length > 0) {
                for (const det of detenidos) {
                    await client.query(`
                        INSERT INTO registros_detenidos (user_id, fecha_timestamp, dni_nie, nombre_apellidos, matricula, external_id)
                        VALUES ($1, $2, $3, $4, $5, $6)`, 
                        [userId, det.fecha, det.dniNie, det.nombreApellidosDetenido, det.matricula, det.id]);
                }
            }

            await client.query('COMMIT');
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', message: 'Sincronización relacional exitosa' }) };
        }

        // --- LÓGICA DE DESCARGA (GET) ---
        if (event.httpMethod === 'GET') {
            const userRes = await client.query('SELECT * FROM users WHERE username = $1', [userId]);
            const servRes = await client.query('SELECT * FROM servicios WHERE user_id = $1', [userId]);
            const drogRes = await client.query('SELECT * FROM registros_drogas WHERE user_id = $1', [userId]);
            const detRes = await client.query('SELECT * FROM registros_detenidos WHERE user_id = $1', [userId]);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    settings: userRes.rows[0] || {},
                    servicios: servRes.rows.map(s => ({ ...s, horarioInicio: s.horario_inicio, horarioFin: s.horario_fin })),
                    drogas: drogRes.rows.map(d => ({ ...d, id: d.external_id })),
                    detenidos: detRes.rows.map(d => ({ ...d, id: d.external_id, fecha: d.fecha_timestamp, nombreApellidosDetenido: d.nombre_apellidos, dniNie: d.dni_nie }))
                })
            };
        }

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error en función sync:", err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    } finally {
        await client.end();
    }
};