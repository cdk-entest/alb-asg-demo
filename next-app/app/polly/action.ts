"use server";

import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import {
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";

const pollyClient = new PollyClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN!,
  },
  region: process.env.REGION,
});

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN!,
  },
  region: process.env.REGION,
});

const callPollyServerAction = async ({ message }: { message: string }) => {
  // audio signed url
  var url = "";

  // call polly service
  const respose = await pollyClient.send(
    new SynthesizeSpeechCommand({
      Engine: "standard",
      LanguageCode: "en-US",
      OutputFormat: "mp3",
      Text: message,
      VoiceId: "Brian",
    })
  );
  // save audo stream to file
  const audio = await respose.AudioStream?.transformToByteArray();
  // file name
  const name = `${uuidv4()}.mp3`;
  // write file to public
  if (audio?.buffer) {
    fs.writeFileSync(`./public/${name}`, Buffer.from(audio.buffer));
  } else {
    console.log("error audio buffer");
  }
  // upload audio file to s3 and get signed url
  if (audio?.buffer) {
    // upload file to s3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: name,
        Body: Buffer.from(audio!.buffer),
      })
    );
    // get signed url
    url = await getSignedUrl(
      s3Client as any,
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: name,
      }),
      {
        expiresIn: 3600,
      }
    );
  }

  return url;
  // return name;
};

export default callPollyServerAction;
