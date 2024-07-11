// const path = require('path');

// const dotenv = require('dotenv');
// // Import required bot configuration.
// const ENV_FILE = path.join(__dirname, '.env');
// dotenv.config({ path: ENV_FILE });

// const restify = require('restify');

// // Import required bot services.
// // See https://aka.ms/bot-services to learn more about the different parts of a bot.
// const {
//     CloudAdapter,
//     ConfigurationServiceClientCredentialFactory,
//     createBotFrameworkAuthenticationFromConfiguration
// } = require('botbuilder');

// // This bot's main dialog.
// const { EchoBot } = require('./bot');

// // Create HTTP server
// const server = restify.createServer();
// server.use(restify.plugins.bodyParser());

// server.listen(process.env.port || process.env.PORT || 3978, () => {
//     console.log(`\n${ server.name } listening to ${ server.url }`);
//     console.log('\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator');
//     console.log('\nTo talk to your bot, open the emulator select "Open Bot"');
// });

// const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
//     MicrosoftAppId: process.env.MicrosoftAppId,
//     MicrosoftAppPassword: process.env.MicrosoftAppPassword,
//     MicrosoftAppType: process.env.MicrosoftAppType,
//     MicrosoftAppTenantId: process.env.MicrosoftAppTenantId
// });

// const botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);

// // Create adapter.
// // See https://aka.ms/about-bot-adapter to learn more about adapters.
// const adapter = new CloudAdapter(botFrameworkAuthentication);

// // Catch-all for errors.
// const onTurnErrorHandler = async (context, error) => {
//     // This check writes out errors to console log .vs. app insights.
//     // NOTE: In production environment, you should consider logging this to Azure
//     //       application insights.
//     console.error(`\n [onTurnError] unhandled error: ${ error }`);

//     // Send a trace activity, which will be displayed in Bot Framework Emulator
//     await context.sendTraceActivity(
//         'OnTurnError Trace',
//         `${ error }`,
//         'https://www.botframework.com/schemas/error',
//         'TurnError'
//     );

//     // Send a message to the user
//     await context.sendActivity('The bot encountered an error or bug.');
//     await context.sendActivity('To continue to run this bot, please fix the bot source code.');
// };

// // Set the onTurnError for the singleton CloudAdapter.
// adapter.onTurnError = onTurnErrorHandler;

// // Create the main dialog.
// const myBot = new EchoBot();

// // Listen for incoming requests.
// server.post('/api/messages', async (req, res) => {
//     // Route received a request to adapter for processing
//     await adapter.process(req, res, (context) => myBot.run(context));
// });

// // Listen for Upgrade requests for Streaming.
// server.on('upgrade', async (req, socket, head) => {
//     // Create an adapter scoped to this WebSocket connection to allow storing session data.
//     const streamingAdapter = new CloudAdapter(botFrameworkAuthentication);

//     // Set onTurnError for the CloudAdapter created for each connection.
//     streamingAdapter.onTurnError = onTurnErrorHandler;

//     await streamingAdapter.process(req, socket, head, (context) => myBot.run(context));
// });



const path = require('path');
const restify = require('restify');
const { BotFrameworkAdapter } = require('botbuilder');

// Create adapter
const adapter = new BotFrameworkAdapter({
    appId: '5a60cea2-3665-46bd-905c-d3cd8cc2a7e8',
    appPassword: 'Qvv8Q~Iqim9B7mbSD3m3kV77HZA26dKSr~wbRbWj'
});

// Create HTTP server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function() {
    console.log(`\n${server.name} listening to ${server.url}`);
});

// In-memory storage for punch-in data (for demonstration purposes)
const punchInData = {};

// Listen for incoming requests
server.post('/api/messages', async (req, res) => {
    await adapter.processActivity(req, res, async (context) => {
        if (context.activity.type === 'message') {
            const userId = context.activity.from.id;
            const text = context.activity.text.trim().toLowerCase();

            if (text === 'punch in') {
                const timestamp = new Date().toISOString();
                const punchId = `${userId}-${Date.now()}`;
                punchInData[punchId] = { userId, punchInTime: timestamp, punchOutTime: null };
                await context.sendActivity(`You have punched in at ${timestamp}. Your punch ID is ${punchId}.`);
            } else if (text.startsWith('punch out')) {
                const punchId = text.split(' ')[2];
                const timestamp = new Date().toISOString();

                if (punchInData[punchId] && punchInData[punchId].userId === userId) {
                    punchInData[punchId].punchOutTime = timestamp;
                    await context.sendActivity(`You have punched out at ${timestamp}.`);
                } else {
                    await context.sendActivity('Invalid punch ID or you are not authorized to punch out this ID.');
                }
            } else {
                await context.sendActivity('Please type "punch in" to punch in or "punch out <punch_id>" to punch out.');
            }
        }
    });
});
