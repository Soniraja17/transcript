
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {readFileSync} from 'fs';
import { Meilisearch } from "meilisearch";
import {Client}from "pg";

const ACCESS_KEY_ID=process.env.R2_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY=process.env.R2_SECRET_ACCESS_KEY!;
const ACCOUNT_ID=process.env.R2_ACCOUNT_ID!;
const client=new S3Client({
    region:"auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials:{
        accessKeyId:ACCESS_KEY_ID,
        secretAccessKey:SECRET_ACCESS_KEY
    }
})

const videoId = process.env.VIDEO_ID!;
const transcriptData = JSON.parse(readFileSync('./transcripts/audio.json', 'utf-8'));
const transcript=new PutObjectCommand({
    Bucket:"transcript",
    Key:`${videoId}.json`,
    Body:JSON.stringify(transcriptData),
    ContentType:'application/json',

})
await client.send(transcript);


const meili= new Meilisearch({
    host: process.env.MEILI_HOST!, apiKey: process.env.MEILI_KEY!
})
const snippets= transcriptData.segments.map((s:any)=>({
    id:`${videoId}_${s.id}`.replace(/[^a-zA-Z0-9-_]/g, '_'),
    videoId:videoId,
    text:s.text.trim(),
    start:s.start
}))

await meili.index(`transcript_snippets`).addDocuments(snippets).waitTask();
 

const r2url=`https://pub-cfa1b38db72f46c097b4512d796dc17f.r2.dev/${videoId}.json`

const pg=new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
})

try{
    await pg.connect();
    const query=`INSERT INTO transcripts (id, videoid, object_url) 
      VALUES (gen_random_uuid(), $1, $2) 
      ON CONFLICT (videoid) 
      DO UPDATE SET object_url = EXCLUDED.object_url;`;
    const values=[videoId,r2url];
    await pg.query(query,values);
    console.log("Successfully saved to Neon!");

}catch(error){
    console.error("Error saving to Neon:", error);

}