const restify = require('restify');
const { BotFrameworkAdapter, CardFactory} = require('botbuilder');

const {
    getUserByAadObjectId,
    callAuthAPI,
    callPunchStatusAPI,
    callPunchInAPI,
    callPunchOutResponse,
    callPunchOutAPI,
    fetchProjects
} = require('./nms');

const workModeSelectionCard = require('./cards/punchlocation');
const  projectSelectionCard= require('./cards/worklocation');
const taskInputCard = require('./cards/taskinput');
const PunchOutCard = require('./cards/punchout');

(async () => {
    const fetch = (await import('node-fetch')).default;

    globalThis.fetch = fetch;

    const adapter = new BotFrameworkAdapter({
        appId: 'f0abc9ea-46c5-48fa-9d78-07ef6e468e15',
        appPassword: 'RRn8Q~aAiahjHjQ86uiQo3-D6cgq65nfmIoPibSn'
    });

    const server = restify.createServer();
    server.listen(process.env.port || process.env.PORT || 3978, function () {
        console.log(`\n${server.name} listening to ${server.url}`);
    });


    const userSelections = {};
    server.post('/api/messages', async (req, res) => {
        await adapter.processActivity(req, res, async (context) => {
            if (context.activity.type === 'message') {
                const userId = context.activity.from.id;
                const aadObjectId = context.activity.from.aadObjectId;
                await context.sendActivity('Welcome to Punch BOT');
    
                if (aadObjectId) {
                        const user = await getUserByAadObjectId(aadObjectId);
                        await context.sendActivity('2');
                        if (user) {
                            const authResponse = await callAuthAPI(userId, user.mail);
                            if (authResponse) {
                                await context.sendActivity('3');
                                const accessToken = authResponse.accessToken;
                                const decodedToken = authResponse.decodedToken;
                                const punchStatus = await callPunchStatusAPI(decodedToken.userId, accessToken);
                                
                                // Handle different cases based on user input
                                if (context.activity.text === 'punch in') {
                                    await context.sendActivity('4');
                                    console.log(punchStatus);
                                    userSelections[userId] = { initiated: true };
    
                                    if (punchStatus && punchStatus.data === "OUT") {
                                        const projectsResponse = await fetchProjects(accessToken);
    
                                        if (projectsResponse.ok) {
                                            const projectsData = await projectsResponse.json();
                                            if (projectsData.status === 200 && projectsData.data.length > 0) {
                                                const card = projectSelectionCard(projectsData.data);
                                                await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
                                            } else {
                                                await context.sendActivity('No projects available to punch in.');
                                            }
                                        } else {
                                            await context.sendActivity('Failed to fetch projects. Please try again later.');
                                        }
                                    } else {
                                        await context.sendActivity('You are already punched in.');
                                    }
                                } else if (context.activity.value && context.activity.value.action === 'selectProject') {
                                    if (userSelections[userId]?.initiated) {
                                        const selectedProjectCode = context.activity.value.projectCode;
                                        const workModeCard = workModeSelectionCard(selectedProjectCode);
                                        await context.sendActivity({ attachments: [CardFactory.adaptiveCard(workModeCard)] });
                                    } else {
                                        await context.sendActivity('Please start the process by typing "punch in" before selecting a project.');
                                    }
                                } else if (context.activity.value && context.activity.value.action === 'selectWorkMode') {
                                    if (userSelections[userId]?.initiated) {
                                        const selectedWorkMode = context.activity.value.workMode;
                                        const projectCode = context.activity.value.projectCode;
    
                                        // Show task input card
                                        const taskCard = taskInputCard(projectCode, selectedWorkMode);
                                        await context.sendActivity({ attachments: [CardFactory.adaptiveCard(taskCard)] });
                                    } else {
                                        await context.sendActivity('Please start the process by typing "punch in" before selecting a work mode.');
                                    }
                                } else if (context.activity.value && context.activity.value.action === 'submitTask') {
                                    if (userSelections[userId]?.initiated) {
                                        const task = context.activity.value.task;
                                        const projectCode = context.activity.value.projectCode;
                                        const selectedWorkMode = context.activity.value.selectedWorkMode;
    
                                        const punchInResponse = await callPunchInAPI(decodedToken.userId, accessToken, projectCode, selectedWorkMode, task);
                                        if (punchInResponse) {
                                            await context.sendActivity(`You have successfully Punched In`);
                                        } else {
                                            await context.sendActivity('Failed to punch in.');
                                        }
                                        userSelections[userId] = { initiated: false };
                                    } else {
                                        await context.sendActivity('Please start the process by typing "punch in" before submitting a task.');
                                    }
                                } else if (context.activity.text === 'punch out') {
                                    if (punchStatus && punchStatus.data === "IN") {
                                        try {
                                            const punchOutResponses = await callPunchOutResponse(accessToken, decodedToken.userId);
                                            
                                            if (punchOutResponses.ok) {
                                                const punchOutData = await punchOutResponses.json();
                                                console.log('Punch Out Data:', punchOutData);
    
                                                const outCard = PunchOutCard(punchOutData);
                                                await context.sendActivity({ attachments: [CardFactory.adaptiveCard(outCard)] });
                                            } else {
                                                await context.sendActivity('Failed to retrieve punch-out information. Please try again later.');
                                            }
                                        } catch (error) {
                                            console.error('Punch Out Error:', error);
                                            await context.sendActivity(`An error occurred while trying to punch out. Error details: ${error.message || error.toString()}`);
                                        }
                                    } else {
                                        await context.sendActivity('You are already punched in.');
                                    }
                                } else if (context.activity.value && context.activity.value.action === 'confirmPunchOut') {
                                    const punchOutData = context.activity.value.punchOutData;
                                    console.log(punchOutData);
    
                                    const punchOutResponse = await callPunchOutAPI(accessToken, punchOutData);
                                    if (punchOutResponse) {
                                        await context.sendActivity(`Successfully punched Out`);
                                    } else {
                                        await context.sendActivity('Failed to punch out.');
                                    }
                                } else if (context.activity.value && context.activity.value.action === 'cancelPunchOut') {
                                    await context.sendActivity('Punch-out process canceled.');
                                }
                            } else {
                                await context.sendActivity('Authentication failed. Unable to call external API.');
                            }
                        } else {
                            await context.sendActivity('User not found.');
                        }
                } else {
                    await context.sendActivity('AAD Object ID not found.');
                }
            } else {
                await context.sendActivity('Unhandled activity type.');
            }
        });
    });    

})();