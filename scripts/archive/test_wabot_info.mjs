const testPostInfo = async () => {
  const response = await fetch("http://localhost:3000/wabot/info", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.WA_BOT_API_KEY || "YOUR_API_KEY_HERE"
    },
    body: JSON.stringify({ botPhoneNumber: "628999999999" })
  });

  const data = await response.json();
  console.log("POST /wabot/info Status:", response.status);
  console.log("POST /wabot/info Response:", data);
};

const testGetInfo = async () => {
  const response = await fetch("http://localhost:3000/wabot/info");
  const data = await response.json();
  console.log("GET /wabot/info Status:", response.status);
  console.log("GET /wabot/info Response:", data);
};

const testLinkCommand = async () => {
  const response = await fetch("http://localhost:3000/wabot/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.WA_BOT_API_KEY || "YOUR_API_KEY_HERE"
    },
    body: JSON.stringify({
      type: "text",
      text: "!link 4V6UCDJJ",
      sender: "172662131298437@lid",
      timestamp: 1780368232
    })
  });

  const data = await response.json();
  console.log("POST /wabot/transactions (!link) Status:", response.status);
  console.log("POST /wabot/transactions (!link) Response:", data);
};

const run = async () => {
  await testPostInfo();
  await testGetInfo();
  await testLinkCommand();
};

run();
