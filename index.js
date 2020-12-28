const { Client, MessageMedia } = require("whatsapp-web.js");
const { key, region } = require("./credentials.js");

var qrcode = require("qrcode-terminal");
var ffmpeg = require("fluent-ffmpeg");

const fs = require("fs");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
let speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
speechConfig.speechRecognitionLanguage = "ar-EG";

const client = new Client();
client.on("qr", (qr) => {
  // Generate and scan this code with your phone
  console.log("QR RECEIVED", qr);
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message", async (msg) => {
  if (msg.body == "!ping") {
    msg.reply("pong");
  }
  if (msg.hasMedia) {
    msg.reply("music to my ears");
    const vn = await msg.downloadMedia();
    await msg.downloadMedia()
      .then((vn) =>
        fs.writeFileSync("output.ogg", Buffer.from(vn.data, "base64")),
        convert("output.ogg", "output.wav", function (cb) {
          if (cb == "Done") {
            transcribeFromFile((trans) => msg.reply(trans));
          }
        })
        )
  }
});
client.initialize();

function transcribeFromFile(callback) {
  let pushStream = sdk.AudioInputStream.createPushStream();
  fs.createReadStream("output.wav")
    .on("data", function (arrayBuffer) {
      pushStream.write(arrayBuffer.slice());
      console.log("still uploading ...");
    })
    .on("end", function () {
      pushStream.close();
      console.log("done uploading");
    });

  let audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  let recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  recognizer.recognizing = (s, e) => {
    console.log(`RECOGNIZING: Text=${e.result.text}`);
  };

  recognizer.recognized = (s, e) => {
    if (e.result.reason == sdk.ResultReason.RecognizedSpeech) {
      console.log(`FINAL RECOGNIZED: Text=${e.result.text}`);
      callback(e.result.text);
      recognizer.StopContinuousRecognitionAsync();
    } else if (e.result.reason == sdk.ResultReason.NoMatch) {
      console.log("NOMATCH: Speech could not be recognized.");
    }
  };

  recognizer.canceled = (s, e) => {
    if(e.reason == 1) {
      console.log("No errors");
    } else {
      console.log(`CANCELED: Reason=${e.reason}`);
      console.log(e.errorCode);
      if (e.reason == sdk.CancellationReason.Error) {
        console.log(`"CANCELED: ErrorCode=${e.errorCode}`);
        console.log(`"CANCELED: ErrorDetails=${e.errorDetails}`);
        console.log("CANCELED: Did you update the subscription info?");
      }
    }
    recognizer.StopContinuousRecognitionAsync();
  };

  recognizer.sessionStopped = (s, e) => {
    console.log("\n    Done Transcription.");
    recognizer.StopContinuousRecognitionAsync();
  };

  recognizer.startContinuousRecognitionAsync(
    () => {
      console.log("Recognition started");
    },
    (err) => {
      console.trace("err - " + err);
      recognizer.close();
      recognizer = undefined;
    }
  );
}

function convert(input, output, callback) {
  ffmpeg()
    .input(input)
    .inputFormat("ogg")
    .format("wav")
    .audioCodec('pcm_s16le')
    .audioFrequency(16000)
    .save(output)
    .on("error", function (err) {
      console.log("error: ", err.code, err.msg);
      callback(err);
    })
    .on("end",function () {
      callback("Done");
    });
}