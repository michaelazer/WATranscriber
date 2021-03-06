const { Client, MessageMedia } = require("whatsapp-web.js");
const { key, region } = require("./credentials.js");

var qrcode = require("qrcode-terminal");
var ffmpeg = require("fluent-ffmpeg");

const fs = require("fs");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
let speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
var autoDetectConfig = sdk.AutoDetectSourceLanguageConfig.fromLanguages(["en-US", "ar-EG"]);


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
    const vn = await msg.downloadMedia();
    console.log(msg.id.id);
    // console.log(msg.)
    const fileName = "audioFile_"+msg.id.id;
    console.log(fileName);
    fs.writeFileSync(`${fileName}.ogg`, Buffer.from(vn.data, "base64"));
    convert(`${fileName}.ogg`, `${fileName}.wav`, function (cb) {
      if (cb == "Done") {
        transcribeFromFile(fileName,(trans) => msg.reply(trans));

      }
    })
  }
});
client.initialize();

function transcribeFromFile(fileName, callback) {
  let pushStream = sdk.AudioInputStream.createPushStream();
  fs.createReadStream(`${fileName}.wav`)
    .on("data", function (arrayBuffer) {
      pushStream.write(arrayBuffer.slice());
      console.log("still uploading ...");
    })
    .on("end", function () {
      pushStream.close();
      console.log("done uploading");
    });

  let audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  let recognizer = new sdk.SpeechRecognizer.FromConfig(speechConfig, autoDetectConfig, audioConfig);
  // var speechRecognizer = SpeechSDK.SpeechRecognizer.FromConfig(speechConfig, autoDetectConfig, audioConfig);

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
  // TODO: callback object
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