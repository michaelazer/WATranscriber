const { Client, MessageMedia } = require("whatsapp-web.js");
var qrcode = require("qrcode-terminal");
var ffmpeg = require("fluent-ffmpeg");

const fs = require("fs");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const speechConfig = sdk.SpeechConfig.fromSubscription(
  "<paste-your-subscription-key>",
  "<paste-your-region>"
);

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

function transcribeFromFile(callback) {
  let pushStream = sdk.AudioInputStream.createPushStream();
  fs.createReadStream("output.wav")
    .on("data", function (arrayBuffer) {
      pushStream.write(arrayBuffer.slice());
    })
    .on("end", function () {
      pushStream.close();
    });

  let audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  let recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  recognizer.recognizeOnceAsync((result) => {
    console.log(`RECOGNIZED: Text=${result.text}`);
    recognizer.close();
    callback(result.text)
  });
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
