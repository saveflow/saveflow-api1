export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, user_id } = req.body;

    if (!url || !user_id) {
        return res.status(400).json({ error: 'Missing URL or user_id' });
    }

    res.status(200).json({
        message: `Received URL: ${url} from user_id: ${user_id}`,
    });
}
