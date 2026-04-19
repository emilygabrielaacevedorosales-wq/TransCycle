const QRCode = require("qrcode");

const url = "exp://localhost:8081";

QRCode.toString(url, { type: "terminal", width: 10 }, (err, string) => {
  if (err) {
    console.error("Error generando QR:", err);
    return;
  }

  console.log("\n📱 Escanea este código QR con Expo Go:\n");
  console.log(string);
  console.log("\n🔗 O usa directamente: " + url + "\n");
});
