import AfricasTalking from 'africastalking';
import dotenv from 'dotenv';
import { initializeAgent } from './utils';
import { HumanMessage } from '@langchain/core/messages';

dotenv.config();

// Updated interface to match actual API response
interface SMSMessageData {
    message: string;
    to: string;
    from:number
}


const africastalking = AfricasTalking({
    apiKey: process.env.AFRICASTALKING_API_KEY as string,
    username: process.env.AFRICASTALKING_USERNAME as string
});


export async function invokeAgent(){
    const userId = "12345";

    const { agent, config } = await initializeAgent(userId);

    const stream = await agent.stream(
        { messages: [new HumanMessage("how many wallets do i have?")] },
        config
      );
      for await (const chunk of stream) {
        console.log("response from the agent :",chunk);
      }
}




export default  async function sendSMS(): Promise<void> {
    try {
        const result = await  africastalking.SMS.send({
            to: '+256742202619',
            message: 'Hey AT Ninja! Wassup...',
            from: process.env.AFRICASTALKING_SENDER_ID
        }) as unknown as SMSMessageData;
        
        console.log("SMS sent",result);
    } catch(ex) {
        console.error(ex);
    }
}

export { africastalking }; 