import express from 'express';
import sendSMS from './sendSMS.js';
import {africastalking} from './sendSMS.js';

const app = express();

export default function smsServer() {
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));

    // Basic route for testing
    app.get('/', (req, res) => {
        res.send('SMS Server is running');
    });

    // TODO: Incoming messages route
    app.post('/new-message',(req, res) => {
        console.log("new message", req.body);
        //  res.send('SMS Server is running');
          africastalking.SMS.send({
            to: '+256742202619', 
            message: 'reply to the message that you sent',
            from: process.env.AFRICASTALKING_SENDER_ID
          });

        // res.sendStatus(200);
    });


    // TODO: Delivery reports route

    sendSMS();

    const port = process.env.PORT || 3013;


    app.listen(port, () => {
        console.log(`Server is s running on port ${port}`);

        // TODO: call sendSMS to send message after server starts

    });
};