var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var builder_cognitiveservices = require("botbuilder-cognitiveservices");
var Promise = require('bluebird');



// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector, function (session) {

    var msg = session.message;
    if (msg.attachments.length) {

        // Message with attachment, proceed to download it.
        // Skype & MS Teams attachment URLs are secured by a JwtToken, so we need to pass the token from our bot.
        var attachment = msg.attachments[0];                                                                                                                                                                                       
        var http = require('http');
        
        var options = {
            uri: "https://southcentralus.api.cognitive.microsoft.com/customvision/v1.1/Prediction/d7e288bf-ceb7-414a-a6b3-06132e2a61d9/url?iterationId=2bb3f492-1a75-427d-ab36-9c670d8c6f6d",
            header: {
                'Content-Type': "application/json",
                'Prediction-Key': "c338010d1ff64fcf89d6c65f09cb7381",
                "Authorization": "9b4c15e5933c462990195fd1ca13b905"
            },
            body:{
                "Url": attachment.contentUrl
            }  
        };
        session.send('Ah! You sent me a VR headset. This is one of new entertainment technologies');
        session.send('Let me introduce you with Oculus');
        session.beginDialog('Oculus');
        }
});

bot.set('storage', tableStorage);

// Twilio:
var twilio = require('twilio');
var sms_client = new twilio('ACf9fe59ece13f84e413829471cfcfd824', 'd5ef62117fec5a184fb42679774cc91a');

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

var luisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

var Intent_recognizer = new builder.LuisRecognizer(luisModelUrl);
bot.recognizer(Intent_recognizer);

// Greeting
bot.dialog('GreetingDialog',
    (session) => {
        const getGreetings = require('./getGreeting.js');
        session.send(getGreetings());
        session.endDialog();
    }
).triggerAction({
    matches: 'greeting'
})

bot.dialog('What',
    function (session, args, next){
        var Rintent = args.intent;
        var product = builder.EntityRecognizer.findEntity(Rintent.entities, 'Product');
        if (product.entity == 'facebook'){
            session.send("Facebook is a [social networking site](https://en.wikipedia.org/wiki/Social_networking_service) that makes it easy for you to connect and share with your family and friends online.");
            session.beginDialog('Facebook');
        }
        if (product.entity == 'oculus'){
            session.send("Oculus Rift is a [virtual reality](https://www.vrs.org.uk/virtual-reality/what-is-virtual-reality.html) headset that is designed to connect to a high-powered PC to enable advanced computations and graphics rendering.");
            session.beginDialog('Oculus')
        }
    }
).triggerAction({
    matches: 'What'
})

bot.dialog('Facebook',[
    function (session){
        builder.Prompts.choice(session, "Do you want to explore Facebook?", "Open your account|Ask a nearby expert|No, thanks", { listStyle: builder.ListStyle.button });
    },
    function (session, result){
        if (result.response.entity == 'Open your account'){
            session.send("To create a Facebook account");
            session.send({
                text: "Go to www.facebook.com/r.php. Click on [here](https://www.facebook.com/)",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/g5pBrc/facebook1.jpg',
                        name: 'fb1.jpg'
                    }
                ]
            });
            session.send({
                text: "Click Create an Account.",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/mpXWrc/facebook2.jpg',
                        name: 'fb2.jpg' 
                    }
                ]
            });
            session.send({
                text: "To finish creating your account, you need to confirm your email or mobile phone number.\n A message will be sent to your phone or your email.",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/hQ1kHH/facebook_3.jpg',
                        name: 'fb3.jpg'
                    }
                ]
            });
            session.beginDialog('Continue');
        }
        if (result.response.entity == 'Ask a nearby expert'){
            session.beginDialog('AskExpert');
        }

        if (result.response.entity == 'No, thanks'){
            session.beginDialog('endConversation');
        }
    }
])

bot.dialog('Continue', [
    function (session){
        builder.Prompts.text(session, "Do you want explore anything else? Just send me a picture, type 'yes' or 'no' ");
    },
    function (session, result){
        if (result.response === "no"){
            session.send('endConversation');
        }
        if (result.response === "yes"){
            session.send("Ok. Type a question or send me a picture");
        }
    }
])

bot.dialog('AskExpert', [
    function (session){
        session.send("Provide the location of nearby experts.");
        session.send("Click [here](https://arcg.is/1GHCLe) to view on map.")
        builder.Prompts.choice(session, "Please select an expert", "Mike|John|Joe|David", { listStyle: builder.ListStyle.button });
    },
    function (session, result){
        builder.Prompts.time(session, "What time would you like to set an appointment with " + result.response.entity +" ?");
    },
    function (session, result){
        var time = builder.EntityRecognizer.resolveTime([result.response]);
        var reply = 'An appointment has been set up for technical support at ' + time;
        session.send(reply);
        sms_client.messages.create({
            to: '+12023161318',
            from: '+12406247729',
            body: 'An appointment has been set up for technical support at ' + time
            });
        session.beginDialog('Continue');
    }
]).triggerAction({
    matches: 'help'
})

bot.dialog('endConversation',
    (session) => {
        const ends = require('./end.js');
        session.send(ends());
        session.endDialog();
    }
).triggerAction({
    matches: 'end'
})

bot.dialog('Oculus', [
    function (session){
        builder.Prompts.choice(session, "Do you want to explore a new world with VR?", "Try a VR Example|Ask a nearby expert|No, thanks", { listStyle: builder.ListStyle.button });
    },
    function (session, result){
        if (result.response.entity == 'Ask a nearby expert'){
            session.beginDialog('AskExpert');
        }
        else if (result.response.entity == 'No, thanks'){
            session.beginDialog('endConversation');
        }
        else{
            session.send('Please click on [here](http://skyvr.azurewebsites.net/)');
            session.send("That's one example of VR experience.");
            session.beginDialog('Continue');
        }
    }
])

bot.dialog('Send', [
    function(session, args, next){
        var Sintent = args.intent;
        var product = builder.EntityRecognizer.findEntity(Sintent.entities, 'Product');

        if (product != 'email'){
            builder.Prompts.choice(session, "Which type of email are you using?", "Outlook|Gmail|I don't have emails", { listStyle: builder.ListStyle.button });
        }
    },
    function(session, result){
        if (result.response.entity == 'Outlook'){
            session.beginDialog('Outlook');
        }
        else if (result.response.entity == 'Gmail'){
            session.beginDialog('Gmail');
        }
        else{
            session.beginDialog('Create');
        }
    }
]).triggerAction({
    matches: 'SendEmail'
})

bot.dialog('Outlook', [
    function (session){
        builder.Prompts.choice(session, "Select your method:", "Step by Step (Tutorial)|Ask a nearby expert", { listStyle: builder.ListStyle.button });
    },
    function (session, result){
        if (result.response.entity == 'Step by Step (Tutorial)'){
            session.send('Open Outlook Express')
            session.send({
                text: "Click on New Email",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/mkO1Px/outlook_1.jpg',
                        name: 'ol1.jpg'
                    }
                ]
            });
            session.send({
                text: "Type the email of receiver",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/ieRcxH/outlook_2.jpg',
                        name: 'ol2.jpg'
                    }
                ]
            });
            session.send({
                text: "Enter your email content",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/c9FRrc/outlook3.jpg',
                        name: 'ol3.jpg'
                    }
                ]
            });
            session.send({
                text: "Click Send after you finish typing your email",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/b8J1Px/outlook4.jpg',
                        name: 'ol4.jpg'
                    }
                ]
            });
            session.beginDialog('Continue');
        }
        else {
            session.beginDialog('AskExpert');
        }
    }
])

bot.dialog('Gmail',[
    function (session){
        builder.Prompts.choice(session, "Select your method:", "Step by Step (Tutorial)|Ask a nearby expert", { listStyle: builder.ListStyle.button });
    },
    function (session, result){
        if (result.response.entity == 'Step by Step (Tutorial)'){
            session.send('Log In to Gmail')
            session.send({
                text: "Click on Compose",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/bYjGPx/gmail_1.png',
                        name: 'gm1.jpg'
                    }
                ]
            });
            session.send({
                text: "Type the email address of receiver",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/f7FecH/gmail2.png',
                        name: 'gm2.jpg'
                    }
                ]
            });
            session.send({
                text: "Enter your email content",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/dMX34x/gmail3.png',
                        name: 'gm3.jpg'
                    }
                ]
            });
            session.send({
                text: "Click Send after you finish typing your email",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/ju6kHH/gmail4.png',
                        name: 'gm4.jpg'
                    }
                ]
            });
            session.beginDialog('Continue');
        }
        else {
            session.beginDialog('AskExpert');
        }
    }
])

bot.dialog('Create', [
    function (session){
        builder.Prompts.choice(session, "Select your method:", "Step by Step (Tutorial)|Ask a nearby expert", { listStyle: builder.ListStyle.button });
    },
    function (session, result){
        if (result.response.entity == 'Step by Step (Tutorial)'){
            session.send({
                text: "Access [Gmail.com](https://mail.google.com)then hit on Create an account.",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/jExQHH/cg1.png',
                        name: 'cg1.jpg'
                    }
                ]
            });
            session.send({
                text: "Enter your information.",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/gkmVjx/cg2.png',
                        name: 'cg2.jpg'
                    }
                ]
            });
            session.send({
                text: "Verify your account.",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/b2fO4x/cg4.jpg',
                        name: 'cg4.jpg'
                    }
                ]
            });
            session.send({
                text: "Your Result: ",
                attachments: [
                    {
                        contentType: 'image/png',
                        contentUrl: 'https://image.ibb.co/dikCxH/cg5.jpg',
                        name: 'cg4.jpg'
                    }
                ]
            });
            session.send('Next step, I will show you how to send an email');
            session.beginDialog('Gmail');
        }
        else {
            session.beginDialog('AskExpert');
        }
    }
])