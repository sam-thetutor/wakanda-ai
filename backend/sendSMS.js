import AfricasTalking from 'africastalking';
import dotenv from 'dotenv';

dotenv.config();
// TODO: Initialize Africa's Talking

const africastalking = AfricasTalking({
    apiKey: process.env.AFRICASTALKING_API_KEY, 
    username: process.env.AFRICASTALKING_USERNAME
  });

// Changed to ES module export
export default async function sendSMS() {
    
    // TODO: Send message
    try {
        const result=await africastalking.SMS.send({
          to: '+256742202619', 
          message: 'Hey AT Ninja! Wassup...',
          from: process.env.AFRICASTALKING_SENDER_ID
        });
        console.log(result);
      } catch(ex) {
        console.error(ex);
      } 

};

export {africastalking};