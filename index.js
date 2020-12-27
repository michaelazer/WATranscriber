const { Client, MessageMedia } = require("whatsapp-web.js");
const { key, region } = require("./credentials.js");

var qrcode = require("qrcode-terminal");
var ffmpeg = require("fluent-ffmpeg");

const fs = require("fs");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
speechConfig.speechRecognitionLanguage = "en-US";

const client = new Client();
client.on("qr", (qr) => {
  // Generate and scan this code with your phone
  console.log("QR RECEIVED", qr);
  qrcode.generate(qr);
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
    msg
      .downloadMedia()
      .then((vn) =>
        convert(vn.data, "output.wav", function (err) {
          if (!err) {
            console.log("conversion complete");
            transcribeFromFile((trans) => msg.reply(trans));
          }
        })
      )
      .then(console.log("done"));
  }
});
client.initialize();

// transcribeFromFile();

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
  let text = "";
  recognizer.recognizing = (s, e) => {
    console.log(`RECOGNIZING: Text=${e.result.text}`);
  };

  recognizer.recognized = (s, e) => {
    if (e.result.reason == ResultReason.RecognizedSpeech) {
      console.log(`RECOGNIZED: Text=${e.result.text}`);
    } else if (e.result.reason == ResultReason.NoMatch) {
      console.log("NOMATCH: Speech could not be recognized.");
    }
  };

  recognizer.canceled = (s, e) => {
    console.log(`CANCELED: Reason=${e.reason}`);

    if (e.reason == CancellationReason.Error) {
      console.log(`"CANCELED: ErrorCode=${e.errorCode}`);
      console.log(`"CANCELED: ErrorDetails=${e.errorDetails}`);
      console.log("CANCELED: Did you update the subscription info?");
    }

    recognizer.stopContinuousRecognitionAsync();
  };

  recognizer.sessionStopped = (s, e) => {
    console.log("\n    Session stopped event.");
    recognizer.stopContinuousRecognitionAsync();
  };
}

function convert(input, output, callback) {
  console.log(input);
  ffmpeg()
    .input(input)
    .inputFormat("ogg")
    .format("wav")
    .save(output)
    .on("error", function (err) {
      console.log("error: ", err.code, err.msg);
      callback(err);
    });
}
