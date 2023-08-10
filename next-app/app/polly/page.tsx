"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import callPollyServerAction from "./action";

// option 1. call api
const callPolly = async ({ message }: { message: string }) => {
  const response = await axios({
    url: "/api/polly",
    method: "POST",
    data: { message: message },
  });

  console.log(response);
  console.log(response.data.url);

  return response.data.url;
};

// option 2. server action
export default function Counter() {
  const [url, setUrl] = useState("");

  useEffect(() => {}, [url]);

  return (
    <div>
      <h1>Write your message</h1>

      <textarea
        id="message"
        name="message"
        rows={12}
        placeholder="write your message ..."
        className="bg-gray-100 w-full p-5 mt-5 mb-5 border-solid border-black rounded-md"
      ></textarea>

      <button
        className="bg-orange-200 px-10 py-3 rounded-sm"
        onClick={async () => {
          const message = (
            document.getElementById("message") as HTMLInputElement
          ).value;
          // option 1 route handler
          // const url = await callPolly({ message: message });
          // option 2 server action
          const url = await callPollyServerAction({ message: message });
          setUrl(url);
          document.getElementById("modal")!.style.display = "block";
        }}
      >
        Submit
      </button>

      <div
        className="fixed top-0 bottom-0 left-0 right-0 bg-slate-500 bg-opacity-70 hidden"
        id="modal"
      >
        <div className="mx-auto max-w-5xl justify-center items-center flex bg-white py-20 px-10 rounded-lg relative">
          <audio controls key={url}>
            <source src={url}></source>
          </audio>
          <button
            className="bg-orange-300 px-10 py-3 rounded-sm absolute top-0 right-0"
            onClick={() => {
              document.getElementById("modal")!.style.display = "none";
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
