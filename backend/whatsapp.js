import { Client } from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'

// Create client instance with puppeteer configuration
const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
})

// Display QR code in terminal
client.on('qr', (qr) => {
    // Generate and display QR in terminal
    console.log('QR received', qr)
    qrcode.generate(qr, { small: true }, (qrcode) => {
        console.log('Scan this QR code in WhatsApp:')
        console.log(qrcode)
    })
})

// Add ready event handler
client.on('ready', () => {
    console.log('Client is ready!')
})

client.on('message', (message) => {
    console.log(message)
})

// Initialize client
client.initialize().catch(err => {
    console.error('Error initializing client:', err)
})

export default client

