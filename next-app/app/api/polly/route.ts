import { NextResponse } from "next/server";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";

const pollyClient = new PollyClient({
  region: "ap-southeast-1",
});

export async function GET(request: Request) {
  console.log("server receive get ", request);
  return NextResponse.json({ name: "haimtran get" });
}

export async function POST(request: Request) {
  // parse message from request
  const requestJson = await request.json();
  console.log("server receive post ", requestJson.message);

  // call polly service
  const respose = await pollyClient.send(
    new SynthesizeSpeechCommand({
      Engine: "standard",
      LanguageCode: "en-US",
      OutputFormat: "mp3",
      Text: requestJson.message,
      VoiceId: "Brian",
    })
  );

  // save audo stream to file
  const audio = await respose.AudioStream?.transformToByteArray();

  // file name
  const name = `${uuidv4()}.mp3`;

  if (audio?.buffer) {
    fs.writeFileSync(`./public/${name}`, Buffer.from(audio.buffer));
  } else {
    console.log("error audio buffer");
  }

  return NextResponse.json({ url: name });
}
