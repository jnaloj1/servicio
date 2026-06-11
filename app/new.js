const { Client } = require('pg');

exports.handler = async (event, context) => {
    // Soporte CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            }
        };
    }

    const userId = event.queryStringParameters.userId;
    if (!userId) {
        return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Falta ID de usuario' }) };
    }

    if (!process.env.DATABASE_URL) {
        return { 
            statusCode: 500, 
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'DATABASE_URL no encontrada en Netlify' }) 
        };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Crucial para Supabase/Neon
    });

    try {
        await client.connect();

        // Crear tabla si no existe
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_sync (
                user_id VARCHAR(50) PRIMARY KEY,
                data JSONB NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // LÓGICA GET (Comprobando nube)
        if (event.httpMethod === 'GET') {
            const res = await client.query('SELECT data FROM user_sync WHERE user_id = $1', [userId]);
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                body: JSON.stringify(res.rows.length > 0 ? res.rows[0].data : { servicios: [], settings: {} })
            };
        }

        // LÓGICA POST (Sincronizando...)
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            await client.query(`
                INSERT INTO user_sync (user_id, data, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id)
                DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
            `, [userId, data]);

            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ status: 'ok' })
            };
        }

    } catch (err) {
        console.error("Error DB:", err.message);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Error DB: ' + err.message })
        };
    } finally {
        await client.end();
    }
};