
import express from "express";
import whatsapp from "./whatsapp.js";

import dotenv from "dotenv";

dotenv.config();


const app = express();

app.use(express.json());


app.post('/message', (req, res) => {
    console.log("hahahhaha",req.body);
    res.send('Hello World');
})

app.get('/', (req, res) => {
    res.send('Hello World');
})

app.use(express.urlencoded({ extended: true }));

//intialize whatsapp client
// whatsapp.initialize();



app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});