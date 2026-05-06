
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {readFileSync} from 'fs';
import { Meilisearch } from "meilisearch";
import {Client}from "pg";

const ACCESS_KEY_ID=process.env.ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY=process.env.SECRET_ACCESS_KEY!;
const ACCOUNT_ID=process.env.ACCOUNT_ID!;
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
    id:`${videoId}_${s.id}`,
    videoId:videoId,
    text:s.text.trim(),
    start:s.start
}))

await meili.index(`transcript_snippets`).addDocuments(snippets);

const r2url=`https://pub-69011fd091b04e43be7212bbe23d52e3.r2.dev/${videoId}.json`

const pg=new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true
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