import { createClient } from '@supabase/supabase-js';
import youtubedl from 'yt-dlp-exec';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegPath);

// Supabase setup → you need to create these in Vercel later
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, user_id } = req.body;

    if (!url || !user_id) {
        return res.status(400).json({ error: 'Missing URL or user_id' });
    }

    try {
        const videoId = uuidv4();

        // Download video as mp4
        const videoPath = `/tmp/${videoId}.mp4`;
        await youtubedl(url, {
            output: videoPath,
            format: 'mp4',
        });

        // Extract thumbnail
        const thumbnailPath = `/tmp/${videoId}.jpg`;
        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .on('end', resolve)
                .on('error', reject)
                .screenshots({
                    count: 1,
                    filename: path.basename(thumbnailPath),
                    folder: path.dirname(thumbnailPath),
                });
        });

        // Upload video to Supabase
        const videoBuffer = fs.readFileSync(videoPath);
        const videoUpload = await supabase.storage
            .from('downloads')
            .upload(`${user_id}/${videoId}.mp4`, videoBuffer, {
                contentType: 'video/mp4',
            });

        // Upload thumbnail
        const thumbnailBuffer = fs.readFileSync(thumbnailPath);
        const thumbnailUpload = await supabase.storage
            .from('downloads')
            .upload(`${user_id}/${videoId}.jpg`, thumbnailBuffer, {
                contentType: 'image/jpeg',
            });

        // Get public URLs
        const { data: videoFileData } = supabase.storage
            .from('downloads')
            .getPublicUrl(`${user_id}/${videoId}.mp4`);

        const { data: thumbnailData } = supabase.storage
            .from('downloads')
            .getPublicUrl(`${user_id}/${videoId}.jpg`);

        res.status(200).json({
            video_file_url: videoFileData.publicUrl,
            thumbnail_url: thumbnailData.publicUrl,
        });
    } catch (error) {
        console.error('Error downloading video:', error);
        res.status(500).json({ error: 'Error downloading video' });
    }
}
