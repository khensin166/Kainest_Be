import fetch from "node-fetch";

async function testBot() {
  const payload = {
    type: "text",
    text: "makan 25k",
    sender: "172662131298437@lid",
    timestamp: 1780368232
  };

  try {
    const res = await fetch("http://localhost:3000/wabot/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.WA_BOT_API_KEY || "YOUR_API_KEY_HERE"
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", json);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testBot();
