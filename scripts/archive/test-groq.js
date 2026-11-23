import { Groq } from 'groq-sdk';
import 'dotenv/config';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function testGroq() {
    try {
        console.log("Testing Groq endpoint with model:", process.env.GROQ_MODEL || "llama3-70b-8192");
        const chatCompletion = await groq.chat.completions.create({
            "messages": [
                {
                    "role": "user",
                    "content": "hai"
                }
            ],
            "model": process.env.GROQ_MODEL || "llama3-70b-8192",
            "temperature": 0.7,
            "max_tokens": 50
        });

        console.log("\nResponse Content:");
        console.log(chatCompletion.choices[0].message.content);
        
        console.log("\nToken Usage:");
        console.log(JSON.stringify(chatCompletion.usage, null, 2));
    } catch (error) {
        console.error("Error:", error.message || error);
    }
}

testGroq();
