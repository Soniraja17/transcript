import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFileSync } from 'fs';
import { Meilisearch } from "meilisearch";
import { Client } from "pg";

// 1. Environment Config
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const videoId = process.env.VIDEO_ID!;

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY
    }
});

const meili = new Meilisearch({
    host: process.env.MEILI_HOST!,
    apiKey: process.env.MEILI_KEY!
});

const pg = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        // 2. Load Data
        console.log("Reading transcript file...");
        const rawData = readFileSync('./transcripts/audio.json', 'utf-8');
        const transcriptData = JSON.parse(rawData);

        // 3. Upload to R2
        console.log("Uploading to Cloudflare R2...");
        await s3Client.send(new PutObjectCommand({
            Bucket: "transcript",
            Key: `${videoId}.json`,
            Body: JSON.stringify(transcriptData),
            ContentType: 'application/json',
        }));

        // 4. Index to Meilisearch
        console.log("Preparing Meilisearch segments...");
        const snippets = transcriptData.segments.map((s: any) => ({
            // Sanitize ID: Meilisearch only allows alphanumeric, hyphens, and underscores
            id: `${s.id}`.replace(/[^a-zA-Z0-9-_]/g, '_'),
            videoId: videoId,
            text: s.text.trim(),
            start: s.start
        }));

        const index = meili.index(`transcript_snippets`);
        const task = await index.addDocuments(snippets);
        
        console.log(`Task enqueued (UID: ${task.taskUid}). Waiting for indexing...`);
        
        // CORRECT WAIT LOGIC:
        // const taskResult = await meili.waitForTask(task.taskUid);
        
        // if (taskResult.status === 'failed') {
        //     console.error("❌ Meilisearch Indexing Failed:", taskResult.error);
        // } else {
        //     console.log("✅ Meilisearch Indexing Succeeded.");
        // }

        // 5. Update Postgres (Neon)
        const r2url = `https://pub-cfa1b38db72f46c097b4512d796dc17f.r2.dev/${videoId}.json`;

        console.log("Connecting to Postgres...");
        await pg.connect();
        
        const query = `
            INSERT INTO transcripts (id, videoid, object_url) 
            VALUES (gen_random_uuid(), $1, $2) 
            ON CONFLICT (videoid) 
            DO UPDATE SET object_url = EXCLUDED.object_url;
        `;
        
        await pg.query(query, [videoId, r2url]);
        console.log("✅ Successfully saved to Neon!");

    } catch (error) {
        console.error("❌ Script Execution Error:", error);
        process.exit(1); // Ensure GitHub Action fails on error
    } finally {
        // 6. Cleanup
        await pg.end();
        console.log("Database connection closed. Script finished.");
    }
}

run();