import express, { Request, Response } from "express";
import { activateAccount, initializeAgent, summarizeResponse } from "./utils.js";
import { HumanMessage } from "@langchain/core/messages";
import User from "./models/User.js";
import { connectDB } from "./db/connect.js";
import { africastalking } from "./sendSMS.js";
import dotenv from "dotenv";
import { Account, SigningSchemeInput } from "@aptos-labs/ts-sdk";
dotenv.config();

const app = express();

export default async function smsServer(): Promise<void> {
  await connectDB();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get("/", (_req: Request, res: Response) => {
    res.send("SMS Server is running");
  });

  //ussd route
  app.post("/new-ussd", async (req: Request, res: Response) => {
    console.log("ussd come in", req.body);

    const { sessionId, serviceCode, phoneNumber, text, networkCode } = req.body;

    if (text === "") {
      //first time USSD
      let response = `CON Welcome to the Aptos Agent.`;
      response += `\n1. Create new account`;
      response += `\n2. Login to existing account`;
      return res.send(response);
    } else {


        // return res.send("CON " + "hhhhhh");
      let user = await User.findOne({ phoneNumber });
      if (!user) {
        const newAccount = Account.generate({
          scheme: SigningSchemeInput.Ed25519,
          legacy: false,
        });
        const privateKeyHex = newAccount.privateKey
          ?.toString()
          .replace("0x", ""); // Remove 0x prefix

        console.log("new account", newAccount);
        //foreach new account created, send some aptos to the address
        await activateAccount(newAccount);
        //save the new account to the user
        user = new User({
          phoneNumber,
          privateKey: privateKeyHex,
          publicKey: newAccount.publicKey?.toString(),
        });
        await user.save();

        await africastalking.SMS.send({
          to: phoneNumber,
          message:
            "CON New account created. Your address is " +
            newAccount.publicKey?.toString(),
          from: process.env.AFRICASTALKING_SENDER_ID as string,
        });
      }

      // Initialize agent with user's private key
      const { agent, config } = await initializeAgent(user.privateKey);

      const stream = await agent.stream(
        { messages: [new HumanMessage(req.body.text)] },
        config
      );

      let response = "";
      for await (const chunk of stream) {
        console.log("response from the agent:", chunk);
        if (chunk.agent?.messages?.[0]?.content) {
          const content = chunk.agent.messages[0].content;
          if (Array.isArray(content)) {
            // Handle array of content objects
            content.forEach((item) => {
              if (item.type === "text") {
                response += item.text;
              }
            });
          } else {
            // Handle string content
            response += content;
          }
        } else if (chunk.tools?.messages?.[0]?.content) {
          response += chunk.tools.messages[0].content;
        }
      }

      // Send response back to user
      if (response) {
        console.log("Original response:", response);
        // Summarize the response
        const summarizedResponse = await summarizeResponse(response, req.body.text);
        console.log("Summarized response:", summarizedResponse);
        return res.send("CON " + summarizedResponse);
      }
    }
  });


  //route to reset the database
  app.get("/reset-db", async (req: Request, res: Response) => {
    await User.deleteMany();
    res.send("Database reset");
  });

  app.post("/new-message", async (req: Request, res: Response) => {
    try {
      console.log("new message", req.body);
      const phoneNumber = req.body.from;

      // Check if user exists
      let user = await User.findOne({ phoneNumber });
      console.log("user", user);

      if (!user) {
        const newAccount = Account.generate({
          scheme: SigningSchemeInput.Ed25519,
          legacy: false,
        });
        const privateKeyHex = newAccount.privateKey
          ?.toString()
          .replace("0x", ""); // Remove 0x prefix

        console.log("new account", newAccount);
        //foreach new account created, send some aptos to the address
        await activateAccount(newAccount);
        //save the new account to the user
        user = new User({
          phoneNumber,
          privateKey: privateKeyHex,
          publicKey: newAccount.publicKey?.toString(),
        });
        await user.save();

        await africastalking.SMS.send({
          to: phoneNumber,
          message:
            "New account created. Your address is " +
            newAccount.publicKey?.toString(),
          from: process.env.AFRICASTALKING_SENDER_ID as string,
        });
      }

      // Initialize agent with user's private key
      const { agent, config } = await initializeAgent(user.privateKey);

      const stream = await agent.stream(
        { messages: [new HumanMessage(req.body.text)] },
        config
      );

      let response = "";
      for await (const chunk of stream) {
        console.log("response from the agent:", chunk);
        if (chunk.agent?.messages?.[0]?.content) {
          const content = chunk.agent.messages[0].content;
          if (Array.isArray(content)) {
            // Handle array of content objects
            content.forEach((item) => {
              if (item.type === "text") {
                response += item.text;
              }
            });
          } else {
            // Handle string content
            response += content;
          }
        } else if (chunk.tools?.messages?.[0]?.content) {
          response += chunk.tools.messages[0].content;
        }
      }

      // Send response back to user
      if (response) {
        await africastalking.SMS.send({
          to: phoneNumber,
          message: response.trim(),
          from: process.env.AFRICASTALKING_SENDER_ID as string,
        });
      }

      return res.status(200).json({ message: "Message processed" });
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  const port = process.env.PORT || 3013;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
