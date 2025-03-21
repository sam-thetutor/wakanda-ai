export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import {
    Account,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";

import { AgentRuntime, LocalSigner, createAptosTools } from "move-agent-kit";
import { ChatAnthropic } from "@langchain/anthropic";

export async function initializeAgent(privateKey: string) {
    try {
      const llm = new ChatAnthropic({
        modelName: "claude-3-5-sonnet-20241022",
        temperature: 0.7,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      });
      const aptosConfig = new AptosConfig({
        network: Network.DEVNET,
      });
  
      const aptos = new Aptos(aptosConfig);
  
      // Validate and get private key from environment
      const privateKeyStr = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      if (!privateKeyStr) {
        throw new Error("Missing private key");
      }
  
      // Setup account and signer
      const account = await aptos.deriveAccountFromPrivateKey({
        privateKey: new Ed25519PrivateKey(
          PrivateKey.formatPrivateKey(privateKeyStr, PrivateKeyVariants.Ed25519)
        ),
      });
  
      const signer = new LocalSigner(account, Network.DEVNET);
      const aptosAgent = new AgentRuntime(signer, aptos, {
        PANORA_API_KEY: process.env.PANORA_API_KEY,
      });
      const tools = createAptosTools(aptosAgent);
      const memory = new MemorySaver();
      const config = { configurable: { thread_id: "userId" } };
      const agent = createReactAgent({
        llm,
        tools,
        checkpointSaver: memory,
        messageModifier: `
        You are a helpful agent that can interact onchain using the Move Agent Kit. 
        You are empowered to interact onchain using your tools. 
        If you ever need funds, you can request them from the testnet faucet. 
        If not, you can provide your wallet details and request funds from the user. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone asks you to do something you can't do with your currently available tools, you must say so, and encourage them to implement it themselves using the Move Agent Kit, recommend they go to the Aptos documentation for more information about Move development. Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless it is explicitly requested.
        `,
      });
      return { agent, config };
    } catch (error) {
      console.error("Failed to initialize agent:", error);
      throw error;
    }
  }


 export const activateAccount = async (newAccount: Account) => {
    const aptosConfig = new AptosConfig({
        network: Network.DEVNET,
      });

      const aptos = new Aptos(aptosConfig);
      //send some aptos to the address
      aptos.fundAccount({
        accountAddress: newAccount.accountAddress,
        amount: 10000000000
      })
      
  }