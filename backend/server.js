import express from "express";
import { verifyPayment } from "./verifyPayment.js";


const app = express();
app.use(express.json());


const SERVICE_ID = "0x" + Buffer.from("price-feed-v1").toString("hex");


app.post("/price", async (req, res) => {
const tx = req.headers["x-payment-tx"];


if (!tx) {
return res.status(402).json({
error: "payment_required",
x402: {
service: { name: "Crypto Price Feed", id: SERVICE_ID },
payment: { amount: "500000", token: "USDC" }
}
});
}


const ok = await verifyPayment(tx, SERVICE_ID);
if (!ok) return res.status(403).json({ error: "invalid payment" });


res.json({ symbol: "BTC", price: "43250.12" });
});


app.listen(3000, () => console.log("x402 API running"));