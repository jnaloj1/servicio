const { Client } = require('pg');

exports.handler = async (event, context) => {
    // Solo permitir GET y POST
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST' && event.httpMethod !== 'OPTIONS') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

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
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing userId' }) };
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();

        // Asegurar que la tabla existe
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_sync (
                user_id VARCHAR(50) PRIMARY KEY,
                data JSONB NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        if (event.httpMethod === 'POST') {
            let data;
            try {
                data = JSON.parse(event.body);
            } catch (e) {
                data = event.body; // Fallback si ya es objeto o string simple
            }

            await client.query(`
                INSERT INTO user_sync (user_id, data, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id)
                DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
            `, [userId, data]);

            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ status: 'ok', message: 'Sincronizado con éxito' })
            };
        }

        if (event.httpMethod === 'GET') {
            const res = await client.query('SELECT data FROM user_sync WHERE user_id = $1', [userId]);
            if (res.rows.length > 0) {
                return {
                    statusCode: 200,
                    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                    body: JSON.stringify(res.rows[0].data)
                };
            } else {
                return {
                    statusCode: 200,
                    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ servicios: [], settings: {} })
                };
            }
        }

    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: err.message })
        };
    } finally {
        await client.end();
    }
};
