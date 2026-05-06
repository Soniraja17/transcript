
import express from "express";
import bcrypt from "bcrypt"
import cors from "cors";
import {prisma} from './db'
import * as z from "zod/v4";
import type { Request, Response } from "express";
const jwt =require("jsonwebtoken");
import {authmiddleware }from "./middleware/authmiddleware.ts"
import{optionalouth} from "./middleware/optionalouth.ts"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client,ListBucketsCommand,ListObjectsV2Command,GetObjectCommand,PutObjectCommand } from "@aws-sdk/client-s3";
import starttranscoding from "./starttranscoding.ts";
import transcripting from "./transcripting.ts";



const ACCESS_KEY_ID=process.env.ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY=process.env.SECRET_ACCESS_KEY!;
const ACCOUNT_ID=process.env.ACCOUNT_ID!;

const s3=new S3Client({
    region: "auto", 
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    
   
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey:SECRET_ACCESS_KEY,
    },
})



const endpoint = process.env.BUCKET_ENDPOINT; // "https://s3.us-east-005.backblazeb2.com"
const region = process.env.BUCKET_REGION; // "us-east-005"
const bucket = process.env.BUCKET_NAME;
const client=new S3Client({
    endpoint,
    region,
    credentials: {
        accessKeyId: "0050f3151c6e9970000000001",
        secretAccessKey: "K005OqUVygd/otsB65B/3skVupHGNaM"
    }
})



const app= express();

app.use(cors());

app.use(express.json());
interface valid{
    userid:string
}
const signupzod=z.object({
    username:z.string(),
    password:z.string().min(8),
    gender:z.enum(["male","female","others"]),
    channelname:z.string()
})

const signinzod=z.object({
    username:z.string(),
    password:z.string()
})

const uploads=z.object({
    video_url:z.string(),
    thumbnail_url:z.string(),
    title:z.string(),
    type:z.enum(["private","public","unlisted"]),


})
enum role{
    "private","public","unlisted"
}
interface Types{
    video_url:string,
    thumbnail_url:string,
    title:string,
    type:role,
}


app.post("/api/signup",async(req,res)=>{
    const parsed=signupzod.safeParse(req.body);
    if(!parsed.success){return res.status(400).json({message:"signup zod fails",error:parsed.error})};
    const {password,username,gender,channelname}=parsed.data;

    const found=await prisma.user.findFirst({ where:{username}});
    const hashpassword=await bcrypt.hash(password,8);
    if(found){return res.status(400).json({message:"usern already exist" });}
    await prisma.user.create({
        data:{password:hashpassword,username,gender,channelname},
    })
    res.status(200).json({message:"user signup succesfully"})

})

app.post("/api/signin",async(req,res)=>{
    const parsed= signinzod.safeParse(req.body);
    if(!parsed.success){ return res.status(400).json({message:"plz provide correct credentials"})};
    const {username,password}=parsed.data;

    const user=await prisma.user.findFirst({where:{username}});
    if(!user){return res.status(400).json({message:"user doest not exist"})};

    const valid=await bcrypt.compare(password,user.password);
    if(!valid){return res.status(400).json({message:"invalid creadentials"})};
    
    const token=jwt.sign({userid:user.id },"SECRECT");

    res.status(200).json({
        token:token,
        message:"sigin in succesfully"
    });


});



app.post("/api/getsignedurl",async(req,res)=>{
    try {
    
        const expiresIn=7 * 24 * 60 * 60;
        const filename=Math.random()+".mp4"
        const imagename=Math.random()+".jpg";
        const comand1=new PutObjectCommand({
            Bucket:bucket,
            Key:filename,
            ContentType:"video/mp4"
        })
        const comand2=new PutObjectCommand({
            Bucket:bucket,
            Key:imagename,
            ContentType:"image/jpg"
        })
        
        
        const signedurl2=await getSignedUrl(client,comand2,{expiresIn});
        
        const signedurl1=await getSignedUrl(client,comand1,{expiresIn});
        const pubVideourl=`${endpoint}/${bucket}/${filename}`;
        const pubImageurl=`${endpoint}/${bucket}/${imagename}`;



        res.status(200).json({
            video_url:signedurl1,
            image_url:signedurl2,
            pubVideourl:pubVideourl,
            pubImageurl:pubImageurl
        });
        
    } catch (error) {
        console.log(error);
        res.status(400).json({message:"geturl went wrong"})
    }
    

})

app.post("/api/getpresignurl",async(req,res)=>{
    try {
        const key=Math.random()+"mp4";
        const key2=Math.random()+"jpg"
        const videopresignurl=await getSignedUrl(s3,
        new PutObjectCommand({
            Bucket:"youtube",
            Key:key,
            ContentType:"video/mp4"
        }),{expiresIn:3600})
    const imgaepresignedurl=await getSignedUrl(s3,new PutObjectCommand({
        Bucket:"youtube",
        Key:key2,
        ContentType:"img/jpg"
       }),{expiresIn:3600},)

       const pubVideourl=`https://pub-69011fd091b04e43be7212bbe23d52e3.r2.dev/${key}`;
       const pubImageurl=`https://pub-69011fd091b04e43be7212bbe23d52e3.r2.dev/${key2}`;

      res.status(200).json({
        videopresignurl,
        imgaepresignedurl,
        pubVideourl,
        pubImageurl
        
      })
        
    } catch (error) {
        console.log(error);
        res.status(400).json({message:"something went wrong"})

    }
   
})










app.post("/api/uploads",authmiddleware,async (req,res)=>{
    try {
        
        const userid=req.userid;
        const parsed=uploads.safeParse(req.body);
        if (!parsed.success) {
            console.log(parsed.error); // debug
            return res.status(400).json({
              message: "Invalid input",
              errors: parsed.error.issues
            });
          }
        
        const {video_url,thumbnail_url,title,type}=parsed.data;
    
        const rest=await prisma.uploads.create({
            data:{
                video_url,thumbnail:thumbnail_url,title,type,userid
            }
        })

        
        res.status(200).json({
            message:"uplaads succesfully"
        })
        starttranscoding(video_url,rest.id);
        transcripting(rest.id,video_url);
    } catch (error) {
        console.log(error);
        res.status(400).json({message:"something went wrogn"})
    }

  


    
})


app.get("/api/allvideos",async (req,res)=>{
    const id=req.query.id;
 
    try{
        const rest=await prisma.uploads.findFirst({
            where:{
                id:id
            },
            include:{
                user:{
                     select:{

                            id:true,channelname:true,profilepicture:true,
                            subscount:true,username:true,
                        }
                }
            }
            
        })
        res.status(200).json({rest});
    }catch(error){
        console.log(error);

      res.status(400).json({message:"something went wring"});
    }

    

   

})

app.get("/api/uploads",async(req,res)=>{
    const rest=await prisma.uploads.findMany({
        include:{
            user:{
                 select:{

                        id:true,channelname:true,profilepicture:true,
                        subscount:true,username:true,
                    }
            }
        }
        
    })
    res.status(200).json({rest})

})

app.post("/api/webhooks/video-ready",async(req,res)=>{
    const { videoId, status } = req.body;
  const incomingSecret = req.headers['x-webhook-secret'];

  // 1. Security Check: Ensure only your GitHub Action can hit this
  if (incomingSecret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // 2. Construct the URL based on your R2 public domain
    // Pattern: https://<your-public-url>/processed/<videoId>/master.m3u8
    const R2_PUBLIC_DOMAIN = "https://pub-your-id.r2.dev"; 
    const finalHlsUrl = `${R2_PUBLIC_DOMAIN}/processed/${videoId}/master.m3u8`;

    // 3. Update Prisma
    await prisma.uploads.update({
      where: { id: videoId },
      data: {
        status: "READY",
        hls_url: finalHlsUrl,
      },
    });

    return res.status(200).json({ message: "Database updated successfully" });
  } catch (error) {
    console.error("Webhook Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
})





app.listen(3000);



