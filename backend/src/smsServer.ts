import express, { Request, Response } from "express";
import { activateAccount, initializeAgent, summarizeResponse } from "./utils.js";
import { HumanMessage } from "@langchain/core/messages";
import User from "./models/User.js";
import { connectDB } from "./db/connect.js";
import { africastalking } from "./sendSMS.js";
import dotenv from "dotenv";
import { Account, SigningSchemeInput } from "@aptos-labs/ts-sdk";
import { EventEmitter } from 'events';
dotenv.config();

const app = express();

const responseEmitter = new EventEmitter();

// Add PIN to User model first
interface MenuState {
    level: number;
    action?: string;
    pin?: string;
}

export default async function smsServer(): Promise<void> {
  await connectDB();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));


  //ussd route
  app.post("/new-ussd", async (req: Request, res: Response) => {
    const { phoneNumber, text } = req.body;

    console.log("new ussd", req.body);
    //only split the text if it contains the *
    let textArray = [];
    if (text?.includes('*')) {
        textArray = text.split('*');
    } else {
        textArray = [text];
    }


    const level = textArray.length;
    const currentInput = textArray[textArray.length - 1];

    try {
        let user = await User.findOne({ phoneNumber });
        
        // Main menu - remove balance option
        if (text === "") {
            let response = "CON Welcome to Aptos Wallet\n";
            response += "1. Create Account\n";
            response += "2. View Private Key\n";
            response += "3. Set PIN\n";
            response += "4. Delete Account";
            return res.send(response);
        }

        // Handle menu options
        switch(textArray[0]) {
            case "1": // Create Account
                if (!user) {
                    const newAccount = Account.generate({
                        scheme: SigningSchemeInput.Ed25519,
                        legacy: false,
                    });
                    const privateKeyHex = newAccount.privateKey?.toString().replace("0x", "");
                    

                    if (level === 1) {
                        return res.send("CON Enter a PIN for your account (4 digits):");
                    } else if (level === 2) {
                        if (!/^\d{4}$/.test(currentInput)) {
                            return res.send("END Invalid PIN. Please try again with 4 digits.");
                        }
                        user = new User({
                            phoneNumber,
                            privateKey: privateKeyHex,
                            publicKey: newAccount.publicKey?.toString(),
                            pin: currentInput
                        });
                        await user.save();
                        await activateAccount(newAccount);
                        return res.send("END Account created successfully!");
                    }
                } else {
                    return res.send("END Account already exists!");
                }
                break;

            case "2": // View Private Key
                if (!user) {
                    return res.send("END Please create an account first");
                }
                if (level === 1) {
                    return res.send("CON Enter your PIN:");
                } else if (level === 2) {
                    if (currentInput !== user.pin) {
                        return res.send("END Invalid PIN");
                    }
                    // Send private key via SMS for security
                    await africastalking.SMS.send({
                        to: phoneNumber,
                        message: `Your private key is: ${user.privateKey}`,
                        from: process.env.AFRICASTALKING_SENDER_ID as string
                    });
                    return res.send("END Your private key has been sent via SMS");
                }
                break;

            case "3": // Set PIN
                if (!user) {
                    return res.send("END Please create an account first");
                }
                if (level === 1) {
                    return res.send("CON Enter your current PIN:");
                } else if (level === 2) {
                    if (currentInput !== user.pin) {
                        return res.send("END Invalid PIN");
                    }
                    return res.send("CON Enter new PIN (4 digits):");
                } else if (level === 3) {
                    if (!/^\d{4}$/.test(currentInput)) {
                        return res.send("END Invalid PIN format. Use 4 digits.");
                    }
                    user.pin = currentInput;
                    await user.save();
                    return res.send("END PIN updated successfully!");
                }
                break;

            case "4": // Delete Account
                if (!user) {
                    return res.send("END No account to delete");
                }
                if (level === 1) {
                    return res.send("CON Enter PIN to confirm account deletion:");
                } else if (level === 2) {
                    if (currentInput !== user.pin) {
                        return res.send("END Invalid PIN");
                    }
                    await User.deleteOne({ phoneNumber });
                    return res.send("END Account deleted successfully");
                }
                break;

            default:
                return res.send("END Invalid option");
        }
    } catch (error) {
        console.error("Error:", error);
        return res.send("END An error occurred. Please try again.");
    }
  });

  app.post("/notifications", async (req: Request, res: Response) => {
    console.log("notifications have come in", req.body);
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

      if (!user) {
        // Send setup instructions via SMS
        await africastalking.SMS.send({
          to: phoneNumber,
          message: `Welcome to Wakanda AI! To get started:
1. Dial *483*1# to access the USSD menu
2. Select option 1 to create your account
3. Set up your 4-digit PIN
4. Once complete, you can start sending SMS queries

Need help? Contact support@wakandaai.com`,
          from: process.env.AFRICASTALKING_SENDER_ID as string
        });
        return res.status(200).json({ message: "Setup instructions sent" });
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

        //summarize the response
        const summarizedResponse = await summarizeResponse(response, req.body.text);




        await africastalking.SMS.send({
          to: phoneNumber,
          message: summarizedResponse,
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
